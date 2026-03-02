# BuiltWith Bulk Domain API — Async CLI

A clean CLI wrapper for the [BuiltWith async bulk Domain API](https://api.builtwith.com). Submit a batch of domains, poll for completion with live progress, and download the results — with built-in support for resuming interrupted jobs.

The standard single-domain examples cover one lookup at a time. This example handles the full async lifecycle: submit → poll → download.

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your key and input:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   INPUT_FILE=domains.txt
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

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your key and input:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   INPUT_FILE=domains.txt
   ```

4. Run:

   ```bash
   python main.py
   ```

## Providing domains

**From a file** (one domain per line):

```
INPUT_FILE=domains.txt
```

**From an env var** (comma-separated):

```
DOMAINS=shopify.com,stripe.com,vercel.com
```

**From stdin** (pipe directly):

```bash
# Node.js
cat domains.txt | node index.js

# Python
cat domains.txt | python main.py
```

## Resuming a job

If the process is interrupted after submission, the job ID is saved to `JOB_ID_FILE` (default: `bulk-job-id.txt`). Resume polling with:

```
JOB_ID=<your-job-id>
```

The script skips submission and goes straight to polling.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BUILTWITH_API_KEY` | — | Your BuiltWith API key |
| `INPUT_FILE` | — | Path to a file with one domain per line |
| `DOMAINS` | — | Comma-separated domain list (alternative to `INPUT_FILE`) |
| `OUTPUT_FILE` | `bulk-results.json` | Where to write JSON results |
| `JOB_ID_FILE` | `bulk-job-id.txt` | Where to save the job ID for resumption |
| `JOB_ID` | — | Resume an existing job (skips submission) |
| `POLL_INTERVAL` | `10000` | Milliseconds between status checks |
| `LIVEONLY` | `false` | Keep only currently live technologies |
| `NOMETA` | `false` | Exclude domain metadata |
| `NOPII` | `false` | Exclude personally identifiable information |

## How it works

1. **Load** domains from file, env var, or stdin
2. **Submit** `POST /v22/domain/bulk` with the domain list and options
3. **Sync response** — if the batch is small enough, the API returns results immediately; the script saves them and exits
4. **Async response** — for larger batches, the API returns a `job_id`; the script saves it to `JOB_ID_FILE` and polls `GET /v22/domain/bulk/{job_id}` until `status == complete`
5. **Download** results from `GET /v22/domain/bulk/{job_id}/result` (one-time endpoint) and write to `OUTPUT_FILE`

## Project structure

```
bulk-domain-api-async/
  nodejs/
    index.js          Entry point — load, submit, poll, download
    package.json
  python/
    main.py           Entry point — load, submit, poll, download
    requirements.txt
  .env.example        Environment template
  README.md
```
