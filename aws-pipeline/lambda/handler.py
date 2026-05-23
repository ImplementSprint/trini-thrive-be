"""
Lambda entry point — S3-triggered, debounced via SQS.

Flow:
  S3 object created (raw Hopecard Parquet)
    → EventBridge rule
    → SQS queue  (BatchWindow = 120 s to absorb burst writes)
    → This Lambda

For each batch of SQS messages the Lambda:
  1. Parses which source tables landed in S3.
  2. Resolves which PowerBI result tables depend on those source tables.
  3. For each result table that needs refreshing:
     a. DROP TABLE in Glue catalog.
     b. Delete existing Parquet objects from S3 results prefix.
     c. Run CTAS to recreate the table from live Athena data.
  4. Triggers a Power BI dataset refresh once all Athena jobs complete.

Environment variables (set via CloudFormation / Lambda config):
  ATHENA_DATABASE        — Glue database name (e.g. "results_db")
  ATHENA_RESULTS_S3      — s3://bucket/athena-query-results/
  RESULTS_BUCKET         — S3 bucket for PowerBI-ready Parquet
  POWERBI_SECRET_NAME    — Secrets Manager key for PowerBI credentials
  AWS_REGION_NAME        — e.g. "ap-southeast-1"
  FORCE_REFRESH_ALL      — "true" to refresh every table regardless of trigger
"""

from __future__ import annotations

import json
import logging
import os

from athena_runner import AthenaRunner
from powerbi_client import PowerBIClient
from queries import CTAS_REGISTRY, SOURCE_TO_RESULT_TABLES
from s3_helper import delete_prefix, extract_source_table

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s — %(message)s',
)
logger = logging.getLogger(__name__)

# ── Config from environment ───────────────────────────────────────────────────
DATABASE       = os.environ['ATHENA_DATABASE']      # e.g. "results_db"
RESULTS_S3     = os.environ['ATHENA_RESULTS_S3']    # s3://bucket/athena-query-results/
RESULTS_BUCKET = os.environ['RESULTS_BUCKET']       # just the bucket name
PBI_SECRET     = os.environ['POWERBI_SECRET_NAME']  # Secrets Manager key
REGION         = os.environ.get('AWS_REGION_NAME', 'ap-southeast-1')
FORCE_ALL      = os.environ.get('FORCE_REFRESH_ALL', '').lower() == 'true'

# ── Singletons (reused across warm Lambda invocations) ────────────────────────
_athena = AthenaRunner(database=DATABASE, s3_output=RESULTS_S3, region=REGION)
_pbi    = PowerBIClient(secret_name=PBI_SECRET, region=REGION)


# ── Entry point ───────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context) -> dict:
    """
    SQS-triggered Lambda handler.
    Each SQS message body contains an EventBridge S3 Object Created event.
    """
    logger.info('Received %d SQS record(s)', len(event.get('Records', [])))

    # ── Step 1: collect which source tables arrived ────────────────────────
    source_tables: set[str] = _extract_source_tables(event)
    logger.info('Source tables detected: %s', source_tables or '(none)')

    # ── Step 2: resolve which result tables need refreshing ───────────────
    if FORCE_ALL or not source_tables:
        result_tables = set(CTAS_REGISTRY.keys())
        logger.info('Refreshing ALL result tables (force=%s, empty_source=%s)',
                    FORCE_ALL, not source_tables)
    else:
        result_tables = _resolve_result_tables(source_tables)
        logger.info('Result tables to refresh: %s', result_tables)

    if not result_tables:
        logger.info('No result tables require refreshing — exiting early.')
        return {'status': 'skipped', 'reason': 'no matching result tables'}

    # ── Step 3: refresh each result table ─────────────────────────────────
    refreshed: list[str] = []
    failed:    list[str] = []

    for table in sorted(result_tables):       # sorted for deterministic log order
        try:
            _refresh_table(table)
            refreshed.append(table)
        except Exception as exc:              # noqa: BLE001
            logger.exception('Failed to refresh %s: %s', table, exc)
            failed.append(table)

    # ── Step 4: trigger Power BI refresh if at least one table succeeded ──
    if refreshed:
        try:
            _pbi.trigger_refresh()
        except Exception as exc:              # noqa: BLE001
            logger.exception('Power BI refresh trigger failed: %s', exc)
            # Don't fail the Lambda — Athena data is already updated.
            # PowerBI will pick it up on next scheduled dataset refresh.

    result = {
        'status':    'partial_failure' if failed else 'success',
        'refreshed': refreshed,
        'failed':    failed,
    }
    logger.info('Done: %s', result)

    # Re-raise if everything failed so SQS retries / sends to DLQ.
    if failed and not refreshed:
        raise RuntimeError(f'All refresh jobs failed: {failed}')

    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_source_tables(event: dict) -> set[str]:
    """
    Walk the SQS batch and pull out every distinct Hopecard source table
    that appeared in the S3 object keys.
    """
    source_tables: set[str] = set()

    for record in event.get('Records', []):
        # SQS body can be a plain S3 notification or an EventBridge envelope.
        try:
            body = json.loads(record.get('body', '{}'))
        except json.JSONDecodeError:
            logger.warning('Could not parse SQS record body — skipping.')
            continue

        # EventBridge wraps the S3 event inside a "detail" key.
        # Direct S3→SQS puts it inside "Records"[].
        s3_keys = _extract_s3_keys(body)

        for key in s3_keys:
            table = extract_source_table(key)
            if table:
                source_tables.add(table)
                logger.debug('Source table from key %r → %r', key, table)

    return source_tables


def _extract_s3_keys(body: dict) -> list[str]:
    """
    Handle both EventBridge S3 Object Created format and
    native S3 → SQS notification format.
    """
    keys: list[str] = []

    # EventBridge format: { "detail": { "object": { "key": "..." } } }
    if 'detail' in body:
        detail = body.get('detail', {})
        key    = detail.get('object', {}).get('key')
        if key:
            keys.append(key)
        return keys

    # Native S3 notification format: { "Records": [{ "s3": { "object": { "key": "..." } } }] }
    for rec in body.get('Records', []):
        key = rec.get('s3', {}).get('object', {}).get('key')
        if key:
            keys.append(key)

    return keys


def _resolve_result_tables(source_tables: set[str]) -> set[str]:
    """Map source table names → the set of result tables that depend on them."""
    result_tables: set[str] = set()
    for src in source_tables:
        dependents = SOURCE_TO_RESULT_TABLES.get(src, set())
        if not dependents:
            logger.debug('Source table %r has no registered result table dependencies.', src)
        result_tables.update(dependents)
    return result_tables


def _refresh_table(table: str) -> None:
    """
    Full refresh cycle for one result table:
      1. Drop Glue catalog entry.
      2. Wipe S3 results prefix (CTAS fails if objects exist).
      3. Run CTAS to recreate.
    """
    cfg         = CTAS_REGISTRY[table]
    s3_prefix   = f'powerbi-ready/{table}/'
    create_sql  = cfg['sql'].format(database=DATABASE, bucket=RESULTS_BUCKET)

    logger.info('── Refreshing %s ──', table)

    # 1. Drop table (removes Glue entry, not S3 data)
    logger.info('[%s] Dropping existing Glue table...', table)
    _athena.drop_table_if_exists(table)

    # 2. Delete S3 objects so CTAS can write fresh
    logger.info('[%s] Wiping S3 prefix s3://%s/%s ...', table, RESULTS_BUCKET, s3_prefix)
    deleted = delete_prefix(RESULTS_BUCKET, s3_prefix)
    logger.info('[%s] Deleted %d stale objects from S3.', table, deleted)

    # 3. CTAS — writes new Parquet files and re-registers in Glue
    logger.info('[%s] Running CTAS...', table)
    _athena.run(create_sql, label=table)
    logger.info('[%s] ✅ Refresh complete.', table)
