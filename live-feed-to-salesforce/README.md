# BuiltWith Live Feed to Salesforce

Stream newly detected domains from the [BuiltWith Live Feed](https://api.builtwith.com), enrich each domain with the Domain API, map the profile into a Salesforce Lead, and save it through Salesforce REST.

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- A **Salesforce Connected App** with API access
- A Salesforce user with permission to create and update Leads
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

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   BUILTWITH_CHANNELS=new,Shopify
   SF_LOGIN_URL=https://login.salesforce.com
   SF_CLIENT_ID=your-connected-app-client-id
   SF_CLIENT_SECRET=your-connected-app-client-secret
   SF_USERNAME=your-salesforce-username
   SF_PASSWORD=your-salesforce-password
   SF_SECURITY_TOKEN=your-salesforce-security-token
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

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   BUILTWITH_CHANNELS=new,Shopify
   SF_LOGIN_URL=https://login.salesforce.com
   SF_CLIENT_ID=your-connected-app-client-id
   SF_CLIENT_SECRET=your-connected-app-client-secret
   SF_USERNAME=your-salesforce-username
   SF_PASSWORD=your-salesforce-password
   SF_SECURITY_TOKEN=your-salesforce-security-token
   ```

4. Run:

   ```bash
   python main.py
   ```

## Configuration

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `BUILTWITH_CHANNELS` | Comma-separated channel list for the live feed |
| `DOMAIN_API_LIVEONLY` | `true` to keep only currently detected technologies |
| `DOMAIN_API_NOPII` | `true` to exclude personally identifiable information |
| `DOMAIN_API_NOMETA` | `true` to exclude domain metadata |
| `DOMAIN_API_NOATTR` | `true` to exclude attributes block |
| `SF_LOGIN_URL` | Salesforce login endpoint (`https://login.salesforce.com` or `https://test.salesforce.com`) |
| `SF_API_VERSION` | Salesforce REST API version, e.g. `v61.0` |
| `SF_CLIENT_ID` | Salesforce Connected App client id |
| `SF_CLIENT_SECRET` | Salesforce Connected App client secret |
| `SF_USERNAME` | Salesforce username for password grant |
| `SF_PASSWORD` | Salesforce password for password grant |
| `SF_SECURITY_TOKEN` | Salesforce security token appended to password during auth |
| `SF_UPSERT_BY_WEBSITE` | `true` to update an existing lead when `Website` already matches the domain |
| `SF_LEAD_SOURCE` | Value written into `LeadSource` |

## Lead Mapping

Each live feed domain is enriched via `GET /v23/api.json` and mapped to a Salesforce Lead payload:

- `LastName`: first discovered contact name (`Meta.Names[0].Name`) or domain fallback
- `Company`: `Meta.CompanyName` or domain fallback
- `Website`: `https://{domain}`
- `Email`: first item from `Meta.Emails`
- `Phone`: first item from `Meta.Telephones`
- `City`, `State`, `Country`: values from `Meta`
- `LeadSource`: `SF_LEAD_SOURCE` (default: `BuiltWith Live Feed`)
- `Description`: channel, top technologies, spend, rank, vertical, and timestamps

## Project Structure

```
live-feed-to-salesforce/
  nodejs/
    config.js      - Loads and validates environment variables
    websocket.js   - WebSocket connection with auto-reconnect
    domain-api.js  - Domain API enrichment calls
    mapper.js      - Maps BuiltWith + Domain API data into Salesforce Lead fields
    salesforce.js  - OAuth + Lead create/update via Salesforce REST
    index.js       - Entry point that wires everything together
  python/
    main.py        - Single-file implementation
  .env.example     - Shared environment template
  README.md
```
