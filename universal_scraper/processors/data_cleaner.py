"""Data cleaning and enrichment utilities."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, List

import pandas as pd

from utils import dedupe_records


def merge_and_clean(records: Iterable[dict]) -> pd.DataFrame:
    rows: List[dict] = list(records)
    rows = dedupe_records(rows)
    for row in rows:
        row.setdefault("scrape_date", datetime.utcnow().date().isoformat())
        row.setdefault("confidence_score", 0.3)
    if not rows:
        return pd.DataFrame(columns=[
            "query_timestamp",
            "source",
            "name",
            "title",
            "company",
            "location",
            "email",
            "phone",
            "website",
            "linkedin",
            "bio",
            "skills",
            "experience",
            "contact_page_url",
            "confidence_score",
            "raw_html_snippet",
            "scrape_date",
            "query",
        ])
    df = pd.DataFrame(rows)
    df = df.fillna("")
    df = df.sort_values(by=["confidence_score", "source"], ascending=[False, True])
    df.reset_index(drop=True, inplace=True)
    return df


__all__ = ["merge_and_clean"]
