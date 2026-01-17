"""Google search scraper for discovering candidate websites."""

from __future__ import annotations

import urllib.parse
from typing import List

from bs4 import BeautifulSoup

from config import MAX_RESULTS
from scrapers.serp_client import SERP_CLIENT
from utils import fetch_html, random_delay, timestamp

GOOGLE_TEMPLATE = "https://www.google.com/search?q={query}&num=10&start={start}"


class GoogleScraper:
    def __init__(self, query: str, *, depth: int = 1) -> None:
        self.query = query
        self.depth = depth

    def run(self) -> List[dict]:
        if SERP_CLIENT.enabled:
            serp_results = self._run_via_serpapi()
            if serp_results:
                return serp_results
        urls: List[str] = []
        results: List[dict] = []
        for page in range(self.depth):
            start = page * 10
            url = GOOGLE_TEMPLATE.format(query=urllib.parse.quote_plus(self.query), start=start)
            html = fetch_html(url)
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            for g in soup.select("div.g"):
                link_tag = g.select_one("a")
                snippet = g.select_one("div.VwiC3b")
                title = g.select_one("h3")
                if not link_tag:
                    continue
                href = link_tag.get("href", "")
                urls.append(href)
                results.append(
                    {
                        "query_timestamp": timestamp(),
                        "source": "google",
                        "name": title.text.strip() if title else "",
                        "title": "",
                        "company": "",
                        "location": "",
                        "email": "",
                        "phone": "",
                        "website": href,
                        "linkedin": "",
                        "bio": snippet.text.strip() if snippet else "",
                        "skills": "",
                        "experience": "",
                        "contact_page_url": href,
                        "confidence_score": 0.4,
                        "raw_html_snippet": g.decode() if hasattr(g, "decode") else str(g),
                        "scrape_date": timestamp(),
                        "query": self.query,
                    }
                )
                if len(results) >= MAX_RESULTS:
                    return results
            random_delay()
        return results

    def discover_urls(self) -> List[str]:
        collected = self.run()
        return [row["website"] for row in collected if row.get("website")]

    def _run_via_serpapi(self) -> List[dict]:
        params = {
            "engine": "google",
            "q": self.query,
            "num": min(10 * self.depth, 100),
        }
        response = SERP_CLIENT.get(params)
        if not response.ok:
            return []
        organic = response.payload.get("organic_results", [])
        results: List[dict] = []
        for item in organic:
            link = item.get("link")
            if not link:
                continue
            results.append(
                {
                    "query_timestamp": timestamp(),
                    "source": "google",
                    "name": item.get("title", ""),
                    "title": "",
                    "company": "",
                    "location": "",
                    "email": "",
                    "phone": "",
                    "website": link,
                    "linkedin": "",
                    "bio": item.get("snippet", ""),
                    "skills": "",
                    "experience": "",
                    "contact_page_url": link,
                    "confidence_score": 0.4,
                    "raw_html_snippet": item.get("snippet", ""),
                    "scrape_date": timestamp(),
                    "query": self.query,
                }
            )
            if len(results) >= MAX_RESULTS:
                break
        return results


__all__ = ["GoogleScraper"]
