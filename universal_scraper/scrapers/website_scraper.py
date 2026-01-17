"""Generic website scraper that applies universal selectors."""

from __future__ import annotations

from typing import Dict, Iterable, List

from bs4 import BeautifulSoup

from config import REQUEST_TIMEOUT, UNIVERSAL_SELECTORS
from utils import capture_emails, capture_phones, fetch_html, soup_from_html, timestamp


class WebsiteScraper:
    def __init__(self, urls: Iterable[str], *, depth: int = 1) -> None:
        self.urls = list(urls)
        self.depth = max(1, depth)

    def run(self) -> List[dict]:
        results: List[dict] = []
        for url in self.urls[:50]:
            page_html = fetch_html(url)
            if not page_html:
                continue
            soup = soup_from_html(page_html)
            record = self._extract_from_soup(url, soup)
            results.append(record)
        return results

    def _extract_from_soup(self, url: str, soup: BeautifulSoup) -> dict:
        data: Dict[str, str] = {
            "name": "",
            "title": "",
            "company": "",
            "location": "",
            "email": "",
            "phone": "",
            "website": url,
            "linkedin": "",
            "bio": "",
            "skills": "",
            "experience": "",
            "contact_page_url": "",
            "confidence_score": 0.3,
            "raw_html_snippet": "",
        }
        data.update(self._select_fields(soup))
        text_dump = soup.get_text(" ")[:2000]
        emails = capture_emails(text_dump)
        phones = capture_phones(text_dump)
        if emails:
            data["email"] = emails[0]
            data["confidence_score"] += 0.1
        if phones:
            data["phone"] = phones[0]
        data["raw_html_snippet"] = text_dump[:500]
        data["scrape_date"] = timestamp()
        data["source"] = "website"
        data["query_timestamp"] = timestamp()
        data["contact_page_url"] = url
        return data

    def _select_fields(self, soup: BeautifulSoup) -> Dict[str, str]:
        extracted: Dict[str, str] = {}
        for field, selectors in UNIVERSAL_SELECTORS.items():
            for selector in selectors:
                nodes = soup.select(selector) if "[" in selector or selector.startswith(".") else soup.find_all(selector)
                for node in nodes:
                    text = node.get_text(" ", strip=True)
                    if text:
                        extracted.setdefault(field, text)
                        break
                if field in extracted:
                    break
        return extracted


__all__ = ["WebsiteScraper"]
