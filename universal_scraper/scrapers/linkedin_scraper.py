"""Lightweight LinkedIn profile discovery using public search results."""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from typing import List

from bs4 import BeautifulSoup

from config import MAX_RESULTS
from scrapers.serp_client import SERP_CLIENT
from utils import fetch_html, random_delay, timestamp


SEARCH_TEMPLATE = "https://www.google.com/search?q={query}"
LINKEDIN_SITE_FILTER = "site:linkedin.com/in"


@dataclass
class LinkedInProfile:
    name: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    linkedin: str = ""
    website: str = ""
    email: str = ""
    phone: str = ""
    bio: str = ""
    raw_html_snippet: str = ""

    def to_record(self, query: str) -> dict:
        return {
            "query_timestamp": timestamp(),
            "source": "linkedin",
            "name": self.name,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "email": self.email,
            "phone": self.phone,
            "website": self.website,
            "linkedin": self.linkedin,
            "bio": self.bio,
            "skills": "",
            "experience": "",
            "contact_page_url": "",
            "confidence_score": 0.6,
            "raw_html_snippet": self.raw_html_snippet,
            "scrape_date": timestamp(),
            "query": query,
        }


class LinkedInScraper:
    def __init__(self, query: str, *, depth: int = 1) -> None:
        self.query = query
        self.depth = depth

    def run(self) -> List[dict]:
        if SERP_CLIENT.enabled:
            serp_results = self._run_via_serpapi()
            if serp_results:
                return serp_results
        results: List[dict] = []
        for page in range(self.depth):
            start = page * 10
            query = f"{LINKEDIN_SITE_FILTER} {self.query}"
            encoded = urllib.parse.quote_plus(query)
            url = f"{SEARCH_TEMPLATE.format(query=encoded)}&start={start}"
            html = fetch_html(url)
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            for g in soup.select("div.g"):
                title = g.select_one("h3")
                summary = g.select_one("div.VwiC3b")
                link_tag = g.select_one("a")
                if not link_tag:
                    continue
                link = link_tag.get("href", "")
                record = LinkedInProfile(
                    name=title.text.strip() if title else "",
                    title="",
                    company="",
                    location="",
                    linkedin=link,
                    bio=summary.text.strip() if summary else "",
                    raw_html_snippet=g.decode() if hasattr(g, "decode") else str(g),
                )
                results.append(record.to_record(self.query))
                if len(results) >= MAX_RESULTS:
                    return results
            random_delay()
        return results

    def _run_via_serpapi(self) -> List[dict]:
        query = f"{LINKEDIN_SITE_FILTER} {self.query}"
        params = {
            "engine": "google",
            "q": query,
            "num": min(10 * self.depth, 100),
        }
        response = SERP_CLIENT.get(params)
        if not response.ok:
            return []
        organic = response.payload.get("organic_results", [])
        results: List[dict] = []
        for item in organic:
            link = item.get("link")
            if not link or "linkedin.com" not in link:
                continue
            results.append(
                LinkedInProfile(
                    name=item.get("title", ""),
                    bio=item.get("snippet", ""),
                    linkedin=link,
                    raw_html_snippet=item.get("snippet", ""),
                ).to_record(self.query)
            )
            if len(results) >= MAX_RESULTS:
                break
        return results


__all__ = ["LinkedInScraper"]
