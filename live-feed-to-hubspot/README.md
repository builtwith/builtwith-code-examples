# BuiltWith Live Feed to HubSpot

Stream newly detected domains from the [BuiltWith Live Feed](https://api.builtwith.com), enrich each domain with the Domain API, map the profile to a HubSpot Contact, and upsert it via the HubSpot CRM REST API.

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- A **HubSpot Private App** access token with `crm.objects.contacts.read` and `crm.objects.contacts.write` scopes — create one at [https://app.hubspot.com/private-apps](https://app.hubspot.com/private-apps)
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
   HUBSPOT_ACCESS_TOKEN=your-hubspot-access-token-here
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
   HUBSPOT_ACCESS_TOKEN=your-hubspot-access-token-here
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
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Private App access token |
| `HUBSPOT_UPSERT_BY_WEBSITE` | `true` to update an existing contact when `website` already matches |
| `HUBSPOT_LEAD_SOURCE` | Value written into `lead_source` (default: `BuiltWith Live Feed`) |

## Contact Mapping

Each live feed domain is enriched via `GET /v22/api.json` and mapped to a HubSpot Contact:

| HubSpot property | Source |
|---|---|
| `lastname` | `Meta.CompanyName` or domain |
| `firstname` | `"Unknown"` |
| `company` | `Meta.CompanyName` or domain |
| `website` | `https://{domain}` |
| `email` | First item from `Meta.Emails` |
| `phone` | First item from `Meta.Telephones` |
| `industry` | `Meta.Vertical` |
| `city` | `Meta.City` |
| `state` | `Meta.State` |
| `country` | `Meta.Country` |
| `description` | Channel, top technologies, spend, and timestamps |
| `hs_lead_status` | `NEW` |
| `lifecyclestage` | `lead` |
| `lead_source` | `HUBSPOT_LEAD_SOURCE` env var |

## Project Structure

```
live-feed-to-hubspot/
  nodejs/
    config.js      Loads and validates environment variables
    http.js        Generic HTTPS request helper
    websocket.js   WebSocket connection with auto-reconnect
    domain-api.js  Domain API enrichment calls
    mapper.js      Maps BuiltWith data to HubSpot Contact properties
    hubspot.js     Search, create, and update contacts via HubSpot REST
    index.js       Entry point that wires everything together
  python/
    main.py        Single-file implementation
  .env.example     Shared environment template
  README.md
```
