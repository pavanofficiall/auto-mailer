"""SerpAPI client helper used by the universal scrapers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

SERP_API_ENDPOINT = "https://serpapi.com/search.json"


@dataclass
class SerpAPIResponse:
    payload: Dict[str, Any]
    status_code: int
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.error is None and 200 <= self.status_code < 300


class SerpAPIClient:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("SERPAPI_KEY")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def get(self, params: Dict[str, Any]) -> SerpAPIResponse:
        if not self.enabled:
            return SerpAPIResponse(payload={}, status_code=0, error="SERPAPI_KEY missing")
        payload = {"api_key": self.api_key, **params}
        try:
            response = requests.get(SERP_API_ENDPOINT, params=payload, timeout=20)
        except requests.RequestException as exc:
            return SerpAPIResponse(payload={}, status_code=0, error=str(exc))
        if response.status_code != 200:
            return SerpAPIResponse(payload={}, status_code=response.status_code, error=response.text[:200])
        return SerpAPIResponse(payload=response.json(), status_code=response.status_code)


SERP_CLIENT = SerpAPIClient()


__all__ = ["SerpAPIClient", "SerpAPIResponse", "SERP_CLIENT"]
