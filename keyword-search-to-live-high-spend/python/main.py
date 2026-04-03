import os
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("BUILTWITH_API_KEY")
KEYWORD = os.getenv("KEYWORD", "perfume")
MIN_SPEND = int(os.getenv("MIN_SPEND", "1000"))
MAX_RESULTS = int(os.getenv("MAX_RESULTS", "20"))
ENRICH_DELAY = float(os.getenv("ENRICH_DELAY", "0.5"))

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)


def collect_tech_names(result, max_techs=10):
    seen = set()
    names = []
    for path in result.get("Paths", []):
        for tech in path.get("Technologies", []):
            name = tech.get("Name")
            if name and name not in seen:
                seen.add(name)
                names.append(name)
                if len(names) >= max_techs:
                    return names
    return names


def fmt_spend(n):
    return f"${int(n):,}"


def fetch_keyword_sites(keyword, max_results):
    entries = []
    offset = ""

    while len(entries) < max_results:
        limit = min(max_results - len(entries), 100)
        params = {"KEY": API_KEY, "KEYWORD": keyword, "LIMIT": limit}
        if offset:
            params["OFFSET"] = offset

        res = requests.get("https://api.builtwith.com/kws1/api.json", params=params, timeout=30)
        res.raise_for_status()
        data = res.json()

        for entry in data.get("Results", []):
            if len(entries) >= max_results:
                break
            entries.append(entry)

        next_offset = data.get("NextOffset")
        if not next_offset or next_offset == "END" or len(entries) >= max_results:
            break
        offset = next_offset

    return entries


def enrich_domain(domain):
    params = {"KEY": API_KEY, "LOOKUP": domain, "LIVEONLY": "y"}
    res = requests.get("https://api.builtwith.com/v22/api.json", params=params, timeout=30)
    res.raise_for_status()
    data = res.json()
    results = data.get("Results", [])
    return results[0] if results else None


print("BuiltWith Keyword Search → Live High-Spend Sites")
print(f"Keyword:     {KEYWORD}")
print(f"Min spend:   {fmt_spend(MIN_SPEND)}/mo")
print(f"Max results: {MAX_RESULTS}")
print("---")

print(f'Step 1: Searching for "{KEYWORD}"...')
entries = fetch_keyword_sites(KEYWORD, MAX_RESULTS)
print(f"  Found {len(entries)} sites")

if not entries:
    print("No sites found for this keyword.")
    sys.exit(0)

print("Step 2: Enriching with Domain API (live only)...")
matches = []

for i, entry in enumerate(entries):
    domain = entry.get("D") or entry.get("domain") or str(entry)
    print(f"  [{i + 1}/{len(entries)}] {domain} ... ", end="", flush=True)

    profile = None
    try:
        profile = enrich_domain(domain)
    except Exception as e:
        print(f"failed ({e})")
        if ENRICH_DELAY > 0 and i < len(entries) - 1:
            time.sleep(ENRICH_DELAY)
        continue

    spend = (profile or {}).get("Result", {}).get("Spend") or 0
    if spend >= MIN_SPEND:
        print(f"{fmt_spend(spend)}/mo \u2713")
        matches.append({"domain": domain, "profile": profile, "spend": spend})
    else:
        print(f"{fmt_spend(spend)}/mo (below threshold, skipped)")

    if ENRICH_DELAY > 0 and i < len(entries) - 1:
        time.sleep(ENRICH_DELAY)

print("---")
label = "site" if len(matches) == 1 else "sites"
print(f"Found {len(matches)} live {label} with spend >= {fmt_spend(MIN_SPEND)}:\n")

for match in matches:
    domain = match["domain"]
    profile = match["profile"] or {}
    spend = match["spend"]
    meta = profile.get("Meta", {})
    result = profile.get("Result", {})
    company = meta.get("CompanyName", "")
    techs = collect_tech_names(result)

    print(f"  {domain}")
    if company:
        print(f"    Company: {company}")
    print(f"    Spend:   {fmt_spend(spend)}/mo")
    if techs:
        print(f"    Techs:   {' | '.join(techs)}")
    print()
