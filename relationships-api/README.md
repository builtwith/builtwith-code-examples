# BuiltWith Relationships API

Discover connections and relationships between websites.

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
| `LOOKUP` | Domain to look up relationships for (default: `builtwith.com`) |

## API Reference

- **Endpoint**: `https://api.builtwith.com/rv5/api.json`
- **Method**: GET
- **Parameters**: `KEY`, `LOOKUP`

Set `PAGE=1` and optionally `IP=yes` in `.env`. These examples fetch one page. Repeat with `PAGE` set to the returned `next_page` while `more_results` is true, keeping `LOOKUP` and `IP` unchanged. Each page has up to 1000 records; merge identifiers by Type/Value and matches by Domain. A domain costs one credit across pages while its renewable 10-minute server cache remains active.
