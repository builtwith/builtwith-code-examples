# BuiltWith Change API Examples

Get technology additions and removals for one or more domains, with categories, importance, and business context.

## Endpoint

`GET https://api.builtwith.com/change1/api.json`

| Parameter | Required | Description |
|-----------|----------|-------------|
| KEY | Yes | Your BuiltWith API key |
| LOOKUP | Yes | Domain or comma-separated domains |
| SINCE | No | Natural language date such as `last month`; defaults to 3 months |

Domains with detected changes use 1 API credit each. Domains with no change history do not consume credits.

## Setup

Copy `.env.example` to `.env` and add your API key:

```
BUILTWITH_API_KEY=your-api-key-here
LOOKUP=builtwith.com
SINCE=last month
```

## Node.js

```bash
cd nodejs
npm install
node index.js
```

## Python

```bash
cd python
pip install requests python-dotenv
python main.py
```
