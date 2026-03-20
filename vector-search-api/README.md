# BuiltWith Vector Search API Examples

Search technologies and categories by text using semantic similarity.

## Endpoint

`GET https://api.builtwith.com/vector/v1/api.json`

| Parameter | Required | Description |
|-----------|----------|-------------|
| KEY | Yes | Your BuiltWith API key |
| QUERY | Yes | Text search query (e.g. "react framework") |
| LIMIT | No | Number of results (default 10, max 100) |

**Cost:** 1 API credit per search

## Setup

Copy `.env.example` to `.env` and add your API key:

```
BUILTWITH_API_KEY=your-api-key-here
QUERY=react framework
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
