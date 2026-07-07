# BuiltWith Domain API

Look up the full technology stack, metadata, and history for any domain. Includes a bulk lookup script for multiple domains.

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

### Bulk domain lookup (Node.js)

```bash
npm run bulk
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

### Bulk domain lookup (Python)

```bash
python bulk.py
```

## Configuration

### Single lookup

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `LOOKUP` | Domain to look up (default: `builtwith.com`) |
| `LIVEONLY` | Set to `true` to return only live/current technologies |
| `NOPII` | Set to `true` to exclude personally identifiable information |
| `NOMETA` | Set to `true` to exclude meta data |
| `NOATTR` | Set to `true` to exclude technology attributes |

### Bulk lookup

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `BULK_DOMAINS` | Comma-separated list of domains (default: `builtwith.com,google.com`) |
| `LIVEONLY` | Set to `true` to return only live/current technologies |
| `NOPII` | Set to `true` to exclude personally identifiable information |
| `NOMETA` | Set to `true` to exclude meta data |
| `HIDETEXT` | Set to `true` to hide text content |
| `HIDEDL` | Set to `true` to hide download links |
| `POLL_INTERVAL` | Milliseconds between status checks for async jobs (default: `10000`) |

## How bulk processing works

1. **Submit** — POST a JSON list of domains with options
2. **Small batches** — If the batch is within the sync limit, results come back immediately in the same response
3. **Large batches** — The API returns a `job_id` with status `queued`. The script then:
   - Polls `GET /v23/domain/bulk/{job_id}` until status is `complete`
   - Downloads results from `GET /v23/domain/bulk/{job_id}/result`
4. **Results are deleted after first access** — save the output if you need it

## API Reference

### Single lookup

- **Endpoint**: `https://api.builtwith.com/v23/api.json`
- **Method**: GET
- **Parameters**: `KEY`, `LOOKUP`, `LIVEONLY`, `NOPII`, `NOMETA`, `NOATTR`, `FDRANGE`, `LDRANGE`

### Bulk lookup

- **Submit**: `POST https://api.builtwith.com/v23/domain/bulk?KEY=...`
- **Check status**: `GET https://api.builtwith.com/v23/domain/bulk/{job_id}?KEY=...`
- **Get results**: `GET https://api.builtwith.com/v23/domain/bulk/{job_id}/result?KEY=...`
