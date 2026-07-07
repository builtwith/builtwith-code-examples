import os
import sys
import json
import time
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv("BUILTWITH_API_KEY")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

domain_list = [d.strip() for d in os.getenv("BULK_DOMAINS", "builtwith.com,google.com").split(",") if d.strip()]

if not domain_list:
    print("Error: Set BULK_DOMAINS in your .env file (comma-separated list).", file=sys.stderr)
    sys.exit(1)

options = {
    "noMeta": os.getenv("NOMETA") == "true",
    "noPii": os.getenv("NOPII") == "true",
    "hideText": os.getenv("HIDETEXT") == "true",
    "hideDL": os.getenv("HIDEDL") == "true",
    "liveOnly": os.getenv("LIVEONLY") == "true",
}

poll_interval = int(os.getenv("POLL_INTERVAL", "10000")) / 1000  # convert ms to seconds

print("BuiltWith Bulk Domain API")
print(f"Domains: {', '.join(domain_list)} ({len(domain_list)} total)")
print("---")

# Submit bulk request
print("Submitting bulk request...")
submit_url = "https://api.builtwith.com/v23/domain/bulk"
res = requests.post(submit_url, params={"KEY": api_key}, json={"lookups": domain_list, "options": options})

if res.status_code != 200:
    print(f"HTTP {res.status_code}: {json.dumps(res.json(), indent=2)}", file=sys.stderr)
    sys.exit(1)

data = res.json()

# Check if synchronous response (small batch — no job_id)
if "job_id" not in data:
    print("Received synchronous response:")
    print(json.dumps(data, indent=2))
    sys.exit(0)

# Asynchronous response — poll for completion
job_id = data["job_id"]
print(f"Job queued: {job_id}")
print(f"Batch size: {data.get('count', '?')} domains (sync_max: {data.get('sync_max', '?')})")
print(f"Polling every {poll_interval}s...")

while True:
    time.sleep(poll_interval)

    status_res = requests.get(f"https://api.builtwith.com/v23/domain/bulk/{job_id}", params={"KEY": api_key})
    if status_res.status_code != 200:
        print(f"Status check failed (HTTP {status_res.status_code}): {json.dumps(status_res.json(), indent=2)}", file=sys.stderr)
        sys.exit(1)

    status = status_res.json()
    print(f"Status: {status.get('status')}")

    if status.get("status") == "complete":
        print("---")
        print("Fetching results (one-time download)...")
        result_res = requests.get(f"https://api.builtwith.com/v23/domain/bulk/{job_id}/result", params={"KEY": api_key})
        if result_res.status_code != 200:
            print(f"Result fetch failed (HTTP {result_res.status_code}): {json.dumps(result_res.json(), indent=2)}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result_res.json(), indent=2))
        break

    if status.get("status") in ("error", "failed"):
        print(f"Job failed: {json.dumps(status, indent=2)}", file=sys.stderr)
        sys.exit(1)
