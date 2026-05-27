# BuiltWith Ask API

Natural language website list lookups. Ask plain-English questions and get back a list of matching websites.

**Examples:**
- `Magento websites in Spain`
- `React e-commerce sites with high revenue`
- `Shopify stores selling pet products`

Without `COMMIT=true` every request returns a sample result (great for previewing). Set `COMMIT=true` to run a full report returning up to 1,000 results.

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

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   QUERY=Magento websites in Spain
   # COMMIT=true        # uncomment for full report (up to 1000 results)
   # NEXTOFFSET=...     # paste NextOffset from a previous response to paginate
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

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   QUERY=Magento websites in Spain
   # COMMIT=true        # uncomment for full report (up to 1000 results)
   # NEXTOFFSET=...     # paste NextOffset from a previous response to paginate
   ```

4. Run:

   ```bash
   python main.py
   ```

## Configuration

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `QUERY` | Natural language query (default: `Magento websites in Spain`) |
| `COMMIT` | Set to `true` to run a full report (up to 1,000 results) |
| `NEXTOFFSET` | Pagination token from the previous response's `NextOffset` field |

## API Reference

- **Endpoint**: `https://api.builtwith.com/ask1/api.json`
- **Method**: GET
- **Required parameters**: `KEY`, `QUERY`
- **Optional parameters**: `COMMIT`, `NEXTOFFSET`, `META`
- **Cost**: 1 API credit per request

### Response fields

| Field | Description |
|---|---|
| `Explanation` | Human-readable description of what was matched |
| `NextOffset` | Opaque pagination token; `END` means no more pages |
| `Results[].D` | Domain name |
| `Results[].FI` | First indexed (Unix timestamp) |
| `Results[].LI` | Last indexed (Unix timestamp) |
| `Results[].Country` | Country code (ISO 3166-1 alpha-2) |
| `Results[].Q` | Quantified score |
| `Results[].S` | Sequence / rank |

### Pagination example

```
# Page 1
GET /ask1/api.json?KEY=...&QUERY=Magento+websites+in+Spain&COMMIT=true

# Page 2 (use NextOffset from page 1 response)
GET /ask1/api.json?KEY=...&QUERY=Magento+websites+in+Spain&COMMIT=true&NEXTOFFSET=<token>
```
