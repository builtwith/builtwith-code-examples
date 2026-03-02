# BuiltWith Bulk Domain Enrichment

Read a plain CSV of domains, enrich each row with technology and company data from the BuiltWith API, and write an enriched CSV with `bw_*` columns appended. All original columns are preserved.

Two enrichment modes:

- **`free`** (default) — uses the [Free API](https://api.builtwith.com/free-api) for a quick, low-cost summary of technology category counts per domain
- **`full`** — uses the [Domain API](https://api.builtwith.com/domain-api) for the complete tech stack, company metadata, spend score, and contact details

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   INPUT_FILE=../sample-domains.csv
   API_MODE=free
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

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   INPUT_FILE=../sample-domains.csv
   API_MODE=free
   ```

4. Run:

   ```bash
   python main.py
   ```

A `sample-domains.csv` is included to test with immediately.

## Output columns

### Free API mode (`API_MODE=free`)

| Column | Description |
|---|---|
| `bw_tech_live` | Total count of currently live technologies detected |
| `bw_tech_dead` | Total count of no-longer-live technologies |
| `bw_groups` | Technology categories with live counts, e.g. `CMS:1 \| Analytics:3` |
| `bw_first_seen` | Earliest date the domain was detected |
| `bw_last_seen` | Most recent detection date |

### Domain API mode (`API_MODE=full`)

| Column | Description |
|---|---|
| `bw_company` | Company name |
| `bw_vertical` | Industry vertical |
| `bw_country` | Country code |
| `bw_email` | First detected email address |
| `bw_phone` | First detected phone number |
| `bw_spend` | Estimated technology spend |
| `bw_technologies` | Top 25 technology names (pipe-separated) |
| `bw_tech_categories` | Unique technology categories (pipe-separated) |
| `bw_mj_rank` | Majestic rank |
| `bw_first_seen` | First indexed date |
| `bw_last_seen` | Last indexed date |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BUILTWITH_API_KEY` | — | Your BuiltWith API key |
| `INPUT_FILE` | — | Path to the input CSV |
| `DOMAIN_COLUMN` | `domain` | Column name containing domains |
| `API_MODE` | `free` | `free` for category counts, `full` for complete stack |
| `OUTPUT_FILE` | `<input>-enriched.csv` | Output CSV path |
| `LIVEONLY` | `true` | Filter to live-only technologies (full mode only) |
| `ENRICH_DELAY` | `0.5` | Seconds to wait between API calls |

## Project structure

```
bulk-domain-enrichment/
  nodejs/
    index.js          Entry point — read CSV, enrich, write CSV
    package.json
  python/
    main.py           Entry point — read CSV, enrich, write CSV
    requirements.txt
  sample-domains.csv  Example input file
  .env.example        Environment template
  README.md
```
