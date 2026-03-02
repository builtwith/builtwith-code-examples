# BuiltWith Lists API → CSV Enriched

Pull a list of websites using a specific technology from the [BuiltWith Lists API](https://api.builtwith.com), enrich each domain with full tech-stack and company metadata via the Domain API, and export a sales-ready CSV.

## What you get

Each row in the output CSV covers one domain with the following columns:

| Column | Source | Description |
|---|---|---|
| `domain` | Lists API | Domain name |
| `company` | Domain API Meta | Company name |
| `website` | — | `https://<domain>` |
| `vertical` | Domain API Meta | Industry vertical |
| `country` | Domain API Meta | Country code |
| `city` | Domain API Meta | City |
| `state` | Domain API Meta | State / region |
| `email` | Domain API Meta | First detected email |
| `phone` | Domain API Meta | First detected phone number |
| `linkedin` | Domain API Meta | LinkedIn profile URL |
| `twitter` | Domain API Meta | Twitter / X profile URL |
| `technologies` | Domain API Result | Top 25 technology names (pipe-separated) |
| `tech_categories` | Domain API Result | Technology categories (pipe-separated) |
| `mj_rank` | Domain API Attributes | Majestic rank |
| `spend_estimate` | Lists API | Estimated ad / technology spend |
| `bw_rank` | Lists API | BuiltWith rank |
| `first_indexed` | Lists API | Date domain was first indexed |
| `last_indexed` | Lists API | Date domain was last indexed |
| `first_detected_tech` | Lists API | Date the searched technology was first detected |
| `last_detected_tech` | Lists API | Date the searched technology was last detected |

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Copy the example environment file and fill in your key:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   TECH=Shopify
   MAX_DOMAINS=50
   ```

4. Run:

   ```bash
   npm start
   ```

## Setup — Python

1. Install dependencies:

   ```bash
   cd python
   pip install -r requirements.txt
   ```

2. Copy the example environment file and fill in your key:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   TECH=Shopify
   MAX_DOMAINS=50
   ```

4. Run:

   ```bash
   python main.py
   ```

The CSV is written to `<tech>-enriched.csv` (e.g. `shopify-enriched.csv`) in the directory where you run the script.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `BUILTWITH_API_KEY` | Yes | — | Your BuiltWith API key |
| `TECH` | Yes | `Shopify` | Technology name to search — use dashes for spaces |
| `MAX_DOMAINS` | No | `50` | Maximum number of domains to fetch and enrich |
| `OUTPUT_FILE` | No | `<tech>-enriched.csv` | CSV output filename |
| `COUNTRY` | No | — | ISO 3166-1 alpha-2 country code(s), comma-separated (use `UK` not `GB`) |
| `SINCE` | No | — | Only return sites detected since a date or relative time, e.g. `2024-01-01`, `30 Days Ago` |
| `LIVEONLY` | No | `true` | Keep only currently live technologies in the Domain API response |
| `ENRICH_DELAY` | No | `0.5` | Seconds to wait between Domain API calls |

## How it works

1. **Fetch** — pages through the Lists API until `MAX_DOMAINS` entries are collected, capturing per-domain spend, rank, and detection timestamps.
2. **Enrich** — calls the Domain API for each domain to retrieve the full technology stack, company metadata, and contact details.
3. **Export** — merges the two data sources into a flat CSV row per domain.

## Project structure

```
lists-api-to-csv-enriched/
  nodejs/
    index.js        Entry point — fetch, enrich, write CSV
    package.json
  python/
    main.py         Entry point — fetch, enrich, write CSV
    requirements.txt
  .env.example      Shared environment template
  README.md
```
