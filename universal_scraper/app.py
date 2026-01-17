"""Streamlit UI for the YourCase Universal Data Collector."""

from __future__ import annotations

from functools import lru_cache
from typing import List

import pandas as pd
import streamlit as st

from processors.csv_exporter import make_download_buffers
from processors.data_cleaner import merge_and_clean
from scrapers.google_scraper import GoogleScraper
from scrapers.linkedin_scraper import LinkedInScraper
from scrapers.serp_client import SERP_CLIENT
from scrapers.website_scraper import WebsiteScraper
from utils import detect_query_domain

st.set_page_config(page_title="YourCase Universal Data Collector", layout="wide")


@lru_cache(maxsize=32)
def scrape_universe(query: str, depth: int, manual_urls: tuple[str, ...]) -> pd.DataFrame:
    linkedin_scraper = LinkedInScraper(query, depth=depth)
    linkedin_records = linkedin_scraper.run()

    google_scraper = GoogleScraper(f"{query} contact", depth=depth)
    google_records = google_scraper.run()
    discovered_urls = [row.get("website") for row in google_records if row.get("website")]

    manual_url_list = list(manual_urls)

    all_urls = list({*discovered_urls, *manual_url_list})
    website_scraper = WebsiteScraper(all_urls, depth=min(depth, 3))
    website_records = website_scraper.run()

    combined = linkedin_records + google_records + website_records
    if not combined:
        return merge_and_clean([])
    return merge_and_clean(combined)


def render_ui() -> None:
    st.title("🔍 YourCase Universal Data Collector")
    st.caption("Search any profession, location, or data type. The collector merges LinkedIn, Google, and site data into a unified sheet.")

    query = st.text_area("What do you need?", "employment lawyers California", height=96)
    depth = st.slider("Search Depth", 1, 5, 2, help="Controls how many result pages to explore per source.")

    if not SERP_CLIENT.enabled:
        st.warning("Add SERPAPI_KEY to your environment or .env file for live Google and LinkedIn results. Currently using fallback HTML scraping which may return few results.")

    manual_urls_input: List[str] = []
    with st.expander("Advanced options"):
        st.write("Provide specific websites or directories to prioritise.")
        urls_input = st.text_area("Seed Website URLs (optional)", placeholder="https://example.com\nhttps://another.com")
        manual_urls_input = [item.strip() for item in urls_input.splitlines() if item.strip().startswith("http")]
        st.write("Detected domain:", detect_query_domain(query))

    if st.button("🚀 COLLECT DATA", type="primary"):
        if not query.strip():
            st.warning("Please enter a search query.")
            return
        with st.spinner("Hunting data..."):
            results_df = scrape_universe(query.strip(), depth, tuple(manual_urls_input))
            if results_df.empty:
                st.info("No data found yet. Try broadening the query or reducing the depth.")
                return
            st.success(f"Collected {len(results_df)} rows")
            st.dataframe(results_df.head(50), use_container_width=True, height=420)

            csv_buffer, json_buffer, excel_buffer = make_download_buffers(results_df)
            st.download_button("📥 Download CSV", csv_buffer, file_name="yourcase_universal.csv", mime="text/csv")
            st.download_button("📄 Download JSON", json_buffer, file_name="yourcase_universal.json", mime="application/json")
            st.download_button("📊 Download Excel", excel_buffer, file_name="yourcase_universal.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


if __name__ == "__main__":
    render_ui()
