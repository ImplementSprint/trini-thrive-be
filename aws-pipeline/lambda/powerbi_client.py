"""
Power BI REST API client.
- Fetches an Azure AD access token via OAuth2 client-credentials flow.
- Triggers a dataset refresh so PowerBI picks up the new Parquet snapshots.

Credentials are stored in AWS Secrets Manager under the key configured
in the POWERBI_SECRET_NAME environment variable.

Secret JSON shape:
{
  "tenant_id":     "<Azure AD tenant ID>",
  "client_id":     "<App registration client ID>",
  "client_secret": "<App registration client secret>",
  "dataset_id":    "<Power BI dataset ID>",
  "group_id":      "<Power BI workspace / group ID>"
}
"""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request

import boto3

logger = logging.getLogger(__name__)

_TOKEN_URL_TEMPLATE = (
    'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
)
_REFRESH_URL_TEMPLATE = (
    'https://api.powerbi.com/v1.0/myorg/groups/{group_id}'
    '/datasets/{dataset_id}/refreshes'
)


class PowerBIClient:
    def __init__(self, secret_name: str, region: str = 'ap-southeast-1') -> None:
        self._secret_name = secret_name
        self._region      = region
        self._creds: dict | None = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def trigger_refresh(self) -> None:
        """
        Trigger an on-demand dataset refresh in Power BI.
        This is a fire-and-forget call — Power BI processes it asynchronously.
        """
        creds   = self._load_creds()
        token   = self._get_token(creds)
        url     = _REFRESH_URL_TEMPLATE.format(
            group_id=creds['group_id'],
            dataset_id=creds['dataset_id'],
        )

        body = json.dumps({
            'notifyOption': 'NoNotification',
            # 'mailOnFailure' | 'MailOnCompletion' | 'NoNotification'
        }).encode()

        req = urllib.request.Request(
            url,
            data=body,
            method='POST',
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type':  'application/json',
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.status
                logger.info('Power BI refresh triggered — HTTP %d', status)
                # 202 Accepted is the expected success response
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode(errors='replace')
            # 400 with "ResourceNotFound" means the dataset ID is wrong
            # 429 means refresh quota hit (8/day on Pro, 48/day on Premium)
            if exc.code == 429:
                logger.warning(
                    'Power BI refresh quota exceeded (HTTP 429). '
                    'Consider upgrading to Premium or reducing trigger frequency. '
                    'Response: %s', body_text
                )
            else:
                raise RuntimeError(
                    f'Power BI refresh failed HTTP {exc.code}: {body_text}'
                ) from exc

    # ── Internal ───────────────────────────────────────────────────────────────

    def _load_creds(self) -> dict:
        if self._creds:
            return self._creds

        sm = boto3.client('secretsmanager', region_name=self._region)
        raw = sm.get_secret_value(SecretId=self._secret_name)['SecretString']
        self._creds = json.loads(raw)

        required = {'tenant_id', 'client_id', 'client_secret', 'dataset_id', 'group_id'}
        missing  = required - self._creds.keys()
        if missing:
            raise ValueError(
                f'Power BI secret {self._secret_name!r} is missing keys: {missing}'
            )
        return self._creds

    @staticmethod
    def _get_token(creds: dict) -> str:
        url  = _TOKEN_URL_TEMPLATE.format(tenant_id=creds['tenant_id'])
        data = urllib.parse.urlencode({
            'grant_type':    'client_credentials',
            'client_id':     creds['client_id'],
            'client_secret': creds['client_secret'],
            'scope':         'https://analysis.windows.net/powerbi/api/.default',
        }).encode()

        req = urllib.request.Request(url, data=data, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode(errors='replace')
            raise RuntimeError(
                f'Failed to obtain Azure AD token HTTP {exc.code}: {body_text}'
            ) from exc

        token = payload.get('access_token')
        if not token:
            raise RuntimeError(
                f'Azure AD token response missing access_token: {payload}'
            )
        logger.debug('Azure AD token obtained (expires_in=%s)', payload.get('expires_in'))
        return token
