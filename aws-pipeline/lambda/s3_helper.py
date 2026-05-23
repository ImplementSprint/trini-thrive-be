"""
S3 helpers.
- delete_prefix: wipe all objects under a prefix before CTAS rewrites it.
- extract_source_table: parse source Hopecard table name from an S3 key.
"""

from __future__ import annotations

import logging
import re

import boto3

logger = logging.getLogger(__name__)

# Expected S3 key pattern written by the Kafka-to-S3 consumer:
# raw/hopecard-events/<source_table>/year=YYYY/month=MM/day=DD/<file>.parquet
_SOURCE_TABLE_RE = re.compile(r'raw/hopecard-events/([^/]+)/')


def delete_prefix(bucket: str, prefix: str) -> int:
    """
    Delete all S3 objects under *prefix*.
    Returns the number of objects deleted.
    Athena CTAS fails if objects already exist at external_location,
    so this must run after DROP TABLE and before CREATE TABLE.
    """
    s3      = boto3.client('s3')
    deleted = 0

    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = page.get('Contents', [])
        if not objects:
            continue

        keys = [{'Key': obj['Key']} for obj in objects]
        s3.delete_objects(
            Bucket=bucket,
            Delete={'Objects': keys, 'Quiet': True},
        )
        deleted += len(keys)
        logger.info('Deleted %d objects from s3://%s/%s', len(keys), bucket, prefix)

    if deleted == 0:
        logger.info('No existing objects at s3://%s/%s — clean slate', bucket, prefix)
    else:
        logger.info('Total deleted from s3://%s/%s: %d objects', bucket, prefix, deleted)

    return deleted


def extract_source_table(s3_key: str) -> str | None:
    """
    Parse the Hopecard source table name from an S3 object key.

    Example key:
      raw/hopecard-events/hopecard_purchases/year=2026/month=05/day=23/part-0.parquet
    Returns:
      'hopecard_purchases'
    """
    match = _SOURCE_TABLE_RE.search(s3_key)
    return match.group(1) if match else None
