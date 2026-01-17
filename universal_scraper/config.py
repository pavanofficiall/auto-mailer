"""Configuration and selectors for the YourCase universal scraper."""

from datetime import timedelta

UNIVERSAL_SELECTORS = {
    "name": ["h1", "h2", ".name", "[itemprop=\"name\"]", ".profile-name"],
    "email": ["a[href^=\"mailto:\"]", "[type=\"email\"]"],
    "phone": ["a[href^=\"tel:\"]", ".phone", "[itemprop=\"telephone\"]", ".contact-phone"],
    "linkedin": ["a[href*=\"linkedin.com/in\"]", "a[href*=\"linkedin.com/company\"]"],
    "bio": [".bio", ".about", "[itemprop=\"description\"]", "p"],
}

REQUEST_TIMEOUT = 15

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

MAX_RESULTS = 200

DELAY_RANGE = (1.5, 3.5)

SCRAPE_DEPTH_LIMIT = 5

CACHE_TTL = timedelta(hours=1)
