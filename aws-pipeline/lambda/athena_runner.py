"""
Athena execution helper.
Runs a query, polls until complete, logs data scanned and cost estimate.
"""

from __future__ import annotations

import logging
import time

import boto3

logger = logging.getLogger(__name__)

# Athena charges $5 per TB scanned (as of 2026).
# Used only for cost logging — not enforced.
_ATHENA_COST_PER_TB = 5.0
_MIN_BILLED_BYTES   = 10 * 1024 * 1024  # Athena bills minimum 10 MB per query


class AthenaRunner:
    def __init__(
        self,
        database:        str,
        s3_output:       str,
        region:          str = 'ap-southeast-1',
        poll_interval_s: float = 3.0,
        max_wait_s:      float = 600.0,
    ) -> None:
        self._client        = boto3.client('athena', region_name=region)
        self.database       = database
        self.s3_output      = s3_output
        self.poll_interval  = poll_interval_s
        self.max_wait       = max_wait_s

    # ── Public API ─────────────────────────────────────────────────────────────

    def run(self, sql: str, label: str = '') -> dict:
        """
        Execute *sql* and block until Athena reports a terminal state.
        Returns the full QueryExecution dict on success.
        Raises RuntimeError on failure or timeout.
        """
        qid = self._start(sql)
        logger.info('[%s] Started Athena query %s', label or 'query', qid)
        return self._wait(qid, label)

    def drop_table_if_exists(self, table: str) -> None:
        """Drop a Glue-catalogued table without touching S3 data."""
        self.run(
            f'DROP TABLE IF EXISTS {self.database}.{table}',
            label=f'DROP {table}',
        )

    # ── Internal ───────────────────────────────────────────────────────────────

    def _start(self, sql: str) -> str:
        resp = self._client.start_query_execution(
            QueryString=sql,
            QueryExecutionContext={'Database': self.database},
            ResultConfiguration={'OutputLocation': self.s3_output},
            # Reuse results if the identical query ran in the last 60 min.
            # This is a safety net — CTAS with DROP always differs.
            ResultReuseConfiguration={
                'ResultReuseByAgeConfiguration': {
                    'Enabled': False,
                }
            },
        )
        return resp['QueryExecutionId']

    def _wait(self, qid: str, label: str) -> dict:
        deadline = time.time() + self.max_wait
        backoff   = self.poll_interval

        while time.time() < deadline:
            resp  = self._client.get_query_execution(QueryExecutionId=qid)
            exec_ = resp['QueryExecution']
            state = exec_['Status']['State']

            if state == 'SUCCEEDED':
                stats = exec_.get('Statistics', {})
                self._log_cost(label, stats)
                return exec_

            if state in ('FAILED', 'CANCELLED'):
                reason = exec_['Status'].get('StateChangeReason', 'no reason given')
                raise RuntimeError(
                    f'Athena query {qid} ({label}) ended with {state}: {reason}'
                )

            logger.debug('[%s] query %s → %s, waiting %.0fs', label, qid, state, backoff)
            time.sleep(backoff)
            # Gentle exponential back-off, capped at 15 s
            backoff = min(backoff * 1.5, 15.0)

        raise TimeoutError(
            f'Athena query {qid} ({label}) did not finish within {self.max_wait}s'
        )

    @staticmethod
    def _log_cost(label: str, stats: dict) -> None:
        scanned = stats.get('DataScannedInBytes', 0)
        billed  = max(scanned, _MIN_BILLED_BYTES)
        cost    = billed / 1e12 * _ATHENA_COST_PER_TB
        runtime = stats.get('TotalExecutionTimeInMillis', 0) / 1000

        logger.info(
            '[%s] ✅ SUCCEEDED — scanned: %.2f MB | billed: %.2f MB '
            '| estimated cost: $%.5f | runtime: %.1fs',
            label,
            scanned / 1e6,
            billed  / 1e6,
            cost,
            runtime,
        )
