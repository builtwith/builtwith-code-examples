# BuiltWith VAT API

Look up VAT, GST, CNPJ, ABN, and other publicly displayed company registration numbers for websites.

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
   LOOKUP=builtwith.com
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
   LOOKUP=builtwith.com
   ```

4. Run:

   ```bash
   python main.py
   ```

## Configuration

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `LOOKUP` | 1 to 16 comma-separated domains to look up (default: `builtwith.com`) |

## API Reference

- **Endpoint**: `https://api.builtwith.com/vat1/api.json`
- **Method**: GET
- **Parameters**: `KEY`, `LOOKUP`
- **Cost**: 1 API credit for each domain that returns registration data; domains with no results use no credit
- **Response**: flat `Domain`, `Type`, `Number` records; a domain can have multiple records or none

See also the [VAT Types API](../vat-types-api) for the reference list of possible `Type` values.
