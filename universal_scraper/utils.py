"""Utility helpers shared across scrapers."""

from __future__ import annotations

import json
import random
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional

import requests
from bs4 import BeautifulSoup

from config import DEFAULT_HEADERS, DELAY_RANGE, REQUEST_TIMEOUT

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

HTTP_OK = 200


def timestamp() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def random_delay() -> None:
    low, high = DELAY_RANGE
    time.sleep(random.uniform(low, high))


def fetch_html(url: str, *, headers: Optional[dict] = None) -> Optional[str]:
    merged = {**DEFAULT_HEADERS}
    merged["User-Agent"] = random.choice(USER_AGENTS)
    if headers:
        merged.update(headers)
    try:
        response = requests.get(url, headers=merged, timeout=REQUEST_TIMEOUT)
        if response.status_code == HTTP_OK:
            return response.text
    except requests.RequestException:
        return None
    return None


def soup_from_html(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def extract_links(html: str, limit: int = 10) -> List[str]:
    soup = soup_from_html(html)
    links: List[str] = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if href.startswith("http"):
            links.append(href)
        if len(links) >= limit:
            break
    return links


QUERY_PATTERNS = {
    "legal": re.compile(r"(law|attorney|legal|advocate|firm)", re.IGNORECASE),
    "finance": re.compile(r"(vc|venture|fund|finance|bank)", re.IGNORECASE),
    "tech": re.compile(r"(tech|software|startup|engineering)", re.IGNORECASE),
}


def detect_query_domain(query: str) -> str:
    for label, pattern in QUERY_PATTERNS.items():
        if pattern.search(query):
            return label
    return "general"


EMAIL_REGEX = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_REGEX = re.compile(r"\+?[0-9][0-9\-()\s]{6,}")


def capture_emails(text: str) -> List[str]:
    return EMAIL_REGEX.findall(text or "")


def capture_phones(text: str) -> List[str]:
    return [match.strip() for match in PHONE_REGEX.findall(text or "")]


def dedupe_records(records: Iterable[dict]) -> List[dict]:
    seen: set[str] = set()
    output: List[dict] = []
    for record in records:
        key_parts = [record.get("email", "").lower(), record.get("name", "").lower()]
        key = "::".join(key_parts)
        if key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output


def save_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


__all__ = [
    "timestamp",
    "random_delay",
    "fetch_html",
    "soup_from_html",
    "extract_links",
    "detect_query_domain",
    "capture_emails",
    "capture_phones",
    "dedupe_records",
    "save_json",
]
