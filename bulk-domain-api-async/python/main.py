"""
BuiltWith Bulk Domain API — async CLI

Accepts domains from a file (one per line), the DOMAINS env var, or stdin.
Submits a bulk job, polls until complete, and writes JSON results to OUTPUT_FILE.
Resume an in-flight job by setting JOB_ID without re-submitting.
"""

import os
import sys
import json
import time
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("BUILTWITH_API_KEY")
INPUT_FILE = os.getenv("INPUT_FILE", "")
DOMAINS_ENV = os.getenv("DOMAINS", "")
JOB_ID = os.getenv("JOB_ID", "")
OUTPUT_FILE = os.getenv("OUTPUT_FILE", "bulk-results.json")
JOB_ID_FILE = os.getenv("JOB_ID_FILE", "bulk-job-id.txt")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10000")) / 1000
LIVEONLY = os.getenv("LIVEONLY", "false").lower() in ("1", "true", "y", "yes")
NOMETA = os.getenv("NOMETA", "false").lower() in ("1", "true", "y", "yes")
NOPII = os.getenv("NOPII", "false").lower() in ("1", "true", "y", "yes")

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://api.builtwith.com"


def load_domains():
    """Load domain list from INPUT_FILE, DOMAINS env var, or stdin."""
    if INPUT_FILE:
        if not os.path.exists(INPUT_FILE):
            print(f"Error: INPUT_FILE not found: {INPUT_FILE}", file=sys.stderr)
            sys.exit(1)
        with open(INPUT_FILE, encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]

    if DOMAINS_ENV:
        return [d.strip() for d in DOMAINS_ENV.split(",") if d.strip()]

    if not sys.stdin.isatty():
        return [line.strip() for line in sys.stdin if line.strip()]

    print("Error: Provide domains via INPUT_FILE, DOMAINS env var, or stdin.", file=sys.stderr)
    sys.exit(1)


def submit_job(domains):
    options = {}
    if LIVEONLY:
        options["liveOnly"] = True
    if NOMETA:
        options["noMeta"] = True
    if NOPII:
        options["noPii"] = True

    payload = {"lookups": domains}
    if options:
        payload["options"] = options

    res = requests.post(
        f"{BASE_URL}/v22/domain/bulk",
        params={"KEY": API_KEY},
        json=payload,
        timeout=30,
    )

    if res.status_code != 200:
        print(f"Submission failed (HTTP {res.status_code}):", file=sys.stderr)
        print(json.dumps(res.json(), indent=2), file=sys.stderr)
        sys.exit(1)

    return res.json()


def check_status(job_id):
    res = requests.get(
        f"{BASE_URL}/v22/domain/bulk/{job_id}",
        params={"KEY": API_KEY},
        timeout=30,
    )
    if res.status_code != 200:
        raise RuntimeError(f"Status check failed (HTTP {res.status_code}): {res.text}")
    return res.json()


def fetch_results(job_id):
    res = requests.get(
        f"{BASE_URL}/v22/domain/bulk/{job_id}/result",
        params={"KEY": API_KEY},
        timeout=60,
    )
    if res.status_code != 200:
        raise RuntimeError(f"Result fetch failed (HTTP {res.status_code}): {res.text}")
    return res.json()


def save_results(data):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Results written to {OUTPUT_FILE}")


def save_job_id(job_id):
    if JOB_ID_FILE:
        with open(JOB_ID_FILE, "w", encoding="utf-8") as f:
            f.write(job_id)
        print(f"Job ID saved to {JOB_ID_FILE} (resume with JOB_ID={job_id})")


def poll(job_id):
    print(f"Polling every {POLL_INTERVAL:.0f}s...")
    poll_count = 0
    while True:
        time.sleep(POLL_INTERVAL)
        poll_count += 1
        status = check_status(job_id)
        current = status.get("status", "unknown")
        progress = status.get("progress")
        progress_str = f" ({progress}%)" if progress is not None else ""
        print(f"  [{poll_count}] status: {current}{progress_str}")

        if current == "complete":
            return
        if current in ("error", "failed"):
            print(f"Job failed: {json.dumps(status, indent=2)}", file=sys.stderr)
            sys.exit(1)


print("BuiltWith Bulk Domain API")
print("---")

# ── Resume path ──────────────────────────────────────────────────────────────
if JOB_ID:
    print(f"Resuming job: {JOB_ID}")
    poll(JOB_ID)
    print("Fetching results (one-time download)...")
    results = fetch_results(JOB_ID)
    save_results(results)
    sys.exit(0)

# ── Submit path ───────────────────────────────────────────────────────────────
domains = load_domains()
print(f"Domains loaded: {len(domains)}")

print("Submitting bulk request...")
data = submit_job(domains)

# Synchronous response (small batch — no job_id returned)
if "job_id" not in data:
    print("Received synchronous response.")
    save_results(data)
    sys.exit(0)

# Asynchronous response
job_id = data["job_id"]
print(f"Job queued: {job_id}")
print(f"Batch size: {data.get('count', '?')} domains (sync_max: {data.get('sync_max', '?')})")
save_job_id(job_id)

poll(job_id)

print("---")
print("Fetching results (one-time download)...")
results = fetch_results(job_id)
save_results(results)
print(f"Done. {len(results.get('Results', results) if isinstance(results, dict) else results)} result(s).")
