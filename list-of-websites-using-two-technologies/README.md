# List of Websites Using Two Technologies

Find websites that use a primary technology and also use one or more additional technologies with the BuiltWith Lists API `OTHERTECHS` parameter.

This example defaults to websites using both `Google-Analytics` and `Meta-Pixel`.

## Setup - Node.js

```bash
cd nodejs
npm install
cp ../.env.example ../.env
npm start
```

## Setup - Python

```bash
cd python
pip install -r requirements.txt
cp ../.env.example ../.env
python main.py
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `BUILTWITH_API_KEY` | Yes | - | Your BuiltWith API key |
| `TECH` | Yes | `Google-Analytics` | Primary technology |
| `OTHERTECHS` | Yes | `Meta-Pixel` | Additional required technology names, comma-separated, max 16 |
| `MAX_DOMAINS` | No | `100` | Maximum number of domains to print |
| `COUNTRY` | No | - | ISO 3166-1 alpha-2 country code(s), comma-separated |
| `SINCE` | No | - | Only return sites detected since a date or relative time |

## API Reference

- **Endpoint**: `https://api.builtwith.com/lists12/api.json`
- **Method**: GET
- **Parameters**: `KEY`, `TECH`, `OTHERTECHS`, `COUNTRY`, `SINCE`, `OFFSET`
