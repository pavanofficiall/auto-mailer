# YourCase Universal Data Collector

Streamlit application that unifies prospect discovery across LinkedIn, Google, and arbitrary websites. Feed it any profession/location query and receive a deduplicated CSV.

## Features
- Streamlit UI with progress messaging and one-click downloads (CSV, JSON, Excel).
- Lightweight LinkedIn discovery using public search result parsing.
- Google SERP crawler that harvests candidate websites.
- Generic website scraper that extracts names, emails, phones, and bios with configurable selectors.
- Deduplication, confidence scoring, and domain detection heuristics.
- Modular architecture for quickly plugging in new sources.

## Project Layout
```
universal_scraper/
├── app.py
├── config.py
├── requirements.txt
├── utils.py
├── scrapers/
│   ├── linkedin_scraper.py
│   ├── google_scraper.py
│   └── website_scraper.py
├── processors/
│   ├── data_cleaner.py
│   └── csv_exporter.py
├── sample_data/
│   └── demo_results.csv
└── README.md
```

## Getting Started
1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run Streamlit:
   ```bash
   streamlit run app.py
   ```
4. Open the provided localhost URL (default http://localhost:8501) and enter any free-form query, then hit **COLLECT DATA**.

### Configure SerpAPI (recommended)
- Create an account at https://serpapi.com and grab an API key.
- Export it in your shell or add a `.env` file alongside `app.py`:
  ```bash
  export SERPAPI_KEY="your-key"
  ```
- With the key present, Google and LinkedIn scrapers use SerpAPI for reliable results. Without it, the app falls back to lightweight HTML scraping, which often yields empty responses due to rate limiting.

## Notes & Best Practices
- Respect robots.txt and target-site terms when deploying at scale.
- Consider rotating proxies or headless browsers for production-grade scraping.
- Update `config.py` to refine selectors for niche data types.
- `sample_data/demo_results.csv` provides a mock dataset for quick UI testing.

## Roadmap
- Add asynchronous execution for faster multi-source coverage.
- Integrate directory-specific scrapers (Avvo, Justia, etc.) based on query domain.
- Persist runs to a database for audit history and replays.
