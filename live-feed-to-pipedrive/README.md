# BuiltWith Live Feed to Pipedrive

Stream newly detected domains from the [BuiltWith Live Feed](https://api.builtwith.com), enrich each domain with the Domain API, and upsert an Organization in Pipedrive CRM with a tech-stack note attached.

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- A **Pipedrive personal API token** — find yours at [https://app.pipedrive.com/settings/api](https://app.pipedrive.com/settings/api)
- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Copy the example environment file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   BUILTWITH_CHANNELS=new,Shopify
   PIPEDRIVE_API_TOKEN=your-pipedrive-api-token-here
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

2. Copy the example environment file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   BUILTWITH_CHANNELS=new,Shopify
   PIPEDRIVE_API_TOKEN=your-pipedrive-api-token-here
   ```

4. Run:

   ```bash
   python main.py
   ```

## Configuration

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `BUILTWITH_CHANNELS` | Comma-separated channel list (e.g. `new,Shopify`) |
| `DOMAIN_API_LIVEONLY` | `true` to keep only currently detected technologies |
| `DOMAIN_API_NOPII` | `true` to exclude personally identifiable information |
| `DOMAIN_API_NOMETA` | `true` to exclude domain metadata |
| `DOMAIN_API_NOATTR` | `true` to exclude attributes block |
| `PIPEDRIVE_API_TOKEN` | Pipedrive personal API token |
| `PIPEDRIVE_UPSERT_BY_NAME` | `true` to update an existing organization when `name` matches exactly |
| `PIPEDRIVE_ADD_NOTE` | `true` to attach a tech-stack note to each organization |

## Organization Mapping

Each live feed domain is enriched via `GET /v22/api.json` and mapped to a Pipedrive Organization:

| Pipedrive field | Source |
|---|---|
| `name` | `Meta.CompanyName` or domain |
| `address` | `Meta.City`, `Meta.State`, `Meta.Country` joined |

A Note is attached to the organization (when `PIPEDRIVE_ADD_NOTE=true`) containing:

- Live Feed channel
- Domain link
- Industry vertical
- Spend estimate
- First and last indexed dates
- Top 25 detected technologies

## Project Structure

```
live-feed-to-pipedrive/
  nodejs/
    config.js      Loads and validates environment variables
    http.js        Generic HTTPS request helper
    websocket.js   WebSocket connection with auto-reconnect
    domain-api.js  Domain API enrichment calls
    mapper.js      Maps BuiltWith data to Pipedrive Organization fields and note
    pipedrive.js   Search, create, update organizations and create notes via Pipedrive REST
    index.js       Entry point that wires everything together
  python/
    main.py        Single-file implementation
  .env.example     Shared environment template
  README.md
```
