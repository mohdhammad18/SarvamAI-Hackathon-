"""Shared HTTP client for Sarvam APIs: auth header, timeouts and bounded
exponential backoff for 429/5xx responses. The API key never leaves the
backend and is never logged."""

from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import settings

log = logging.getLogger("bolobuddy.sarvam")
RETRY_STATUS = {429, 500, 502, 503, 504}


class SarvamError(Exception):
    def __init__(self, message: str, status: int | None = None, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code


async def sarvam_request(
    method: str,
    path: str,
    *,
    json: dict | None = None,
    data: dict | None = None,
    files: dict | None = None,
    timeout: float = 30.0,
    retries: int = 2,
    client: httpx.AsyncClient | None = None,
) -> dict:
    if not settings.sarvam_api_key:
        raise SarvamError("Sarvam API key is not configured", code="missing_key")
    headers = {"api-subscription-key": settings.sarvam_api_key}
    url = f"{settings.sarvam_base_url}{path}"
    own = client is None
    client = client or httpx.AsyncClient(timeout=timeout)
    try:
        for attempt in range(retries + 1):
            try:
                resp = await client.request(method, url, headers=headers, json=json, data=data, files=files)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt < retries:
                    await asyncio.sleep(0.5 * 2**attempt)
                    continue
                raise SarvamError(f"Network error contacting Sarvam: {type(exc).__name__}") from exc
            if resp.status_code in RETRY_STATUS and attempt < retries:
                await asyncio.sleep(0.5 * 2**attempt)
                continue
            if resp.status_code >= 400:
                try:
                    err = resp.json().get("error", {})
                except Exception:
                    err = {}
                log.warning("Sarvam %s %s -> %s %s", method, path, resp.status_code, err.get("code"))
                raise SarvamError(err.get("message") or f"Sarvam API error {resp.status_code}", resp.status_code, err.get("code"))
            return resp.json()
        raise SarvamError("Sarvam request failed after retries")
    finally:
        if own:
            await client.aclose()
