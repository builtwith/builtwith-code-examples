"""
BuiltWith Bulk Domain Enrichment

Reads a CSV of domains, enriches each one with the Free API (quick, low-cost)
or the full Domain API, and writes an enriched CSV with bw_* columns appended.
"""

import os
import sys
import csv
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("BUILTWITH_API_KEY")
INPUT_FILE = os.getenv("INPUT_FILE", "")
DOMAIN_COLUMN = os.getenv("DOMAIN_COLUMN", "domain")
API_MODE = os.getenv("API_MODE", "free").lower()   # "free" or "full"
LIVEONLY = os.getenv("LIVEONLY", "true").lower() in ("1", "true", "y", "yes")
ENRICH_DELAY = float(os.getenv("ENRICH_DELAY", "0.5"))

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

if not INPUT_FILE:
    print("Error: Set INPUT_FILE to the path of your input CSV.", file=sys.stderr)
    sys.exit(1)

if not os.path.exists(INPUT_FILE):
    print(f"Error: INPUT_FILE not found: {INPUT_FILE}", file=sys.stderr)
    sys.exit(1)

if API_MODE not in ("free", "full"):
    print("Error: API_MODE must be 'free' or 'full'.", file=sys.stderr)
    sys.exit(1)

# Default output path: input file with -enriched suffix
base, ext = os.path.splitext(INPUT_FILE)
OUTPUT_FILE = os.getenv("OUTPUT_FILE", f"{base}-enriched{ext or '.csv'}")

# Columns added in each mode
FREE_COLUMNS = [
    "bw_tech_live",
    "bw_tech_dead",
    "bw_groups",
    "bw_first_seen",
    "bw_last_seen",
]

FULL_COLUMNS = [
    "bw_company",
    "bw_vertical",
    "bw_country",
    "bw_email",
    "bw_phone",
    "bw_spend",
    "bw_technologies",
    "bw_tech_categories",
    "bw_mj_rank",
    "bw_first_seen",
    "bw_last_seen",
]

ENRICH_COLUMNS = FREE_COLUMNS if API_MODE == "free" else FULL_COLUMNS


def fmt_epoch(ms):
    if not ms:
        return ""
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError):
        return ""


# ── Free API enrichment ───────────────────────────────────────────────────────

def enrich_free(domain):
    res = requests.get(
        "https://api.builtwith.com/free1/api.json",
        params={"KEY": API_KEY, "LOOKUP": domain},
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()

    groups = data.get("groups") or data.get("Groups") or []
    total_live = sum(g.get("live", g.get("Live", 0)) for g in groups)
    total_dead = sum(g.get("dead", g.get("Dead", 0)) for g in groups)

    group_parts = []
    for g in groups:
        name = g.get("name") or g.get("Name") or ""
        live = g.get("live", g.get("Live", 0))
        if name and live:
            group_parts.append(f"{name}:{live}")

    return {
        "bw_tech_live": total_live,
        "bw_tech_dead": total_dead,
        "bw_groups": " | ".join(group_parts),
        "bw_first_seen": fmt_epoch(data.get("first") or data.get("First")),
        "bw_last_seen": fmt_epoch(data.get("last") or data.get("Last")),
    }


# ── Domain API enrichment ─────────────────────────────────────────────────────

def collect_tech_names(result, max_techs=25):
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


def collect_tech_categories(result):
    seen = set()
    cats = []
    for path in result.get("Paths", []):
        for tech in path.get("Technologies", []):
            tag = tech.get("Tag")
            if tag and tag not in seen:
                seen.add(tag)
                cats.append(tag)
    return cats


def enrich_full(domain):
    params = {"KEY": API_KEY, "LOOKUP": domain}
    if LIVEONLY:
        params["LIVEONLY"] = "y"

    res = requests.get("https://api.builtwith.com/v22/api.json", params=params, timeout=30)
    res.raise_for_status()
    data = res.json()

    results = data.get("Results", [])
    if not results:
        return {col: "" for col in FULL_COLUMNS}

    profile = results[0]
    result = profile.get("Result", {})
    meta = profile.get("Meta", {})
    attrs = profile.get("Attributes", {})

    emails = meta.get("Emails") or []
    phones = meta.get("Telephones") or []
    spend = profile.get("SalesRevenue") or result.get("Spend") or ""

    return {
        "bw_company": meta.get("CompanyName", ""),
        "bw_vertical": meta.get("Vertical", ""),
        "bw_country": meta.get("Country", ""),
        "bw_email": emails[0] if emails else "",
        "bw_phone": phones[0] if phones else "",
        "bw_spend": spend,
        "bw_technologies": " | ".join(collect_tech_names(result)),
        "bw_tech_categories": " | ".join(collect_tech_categories(result)),
        "bw_mj_rank": attrs.get("MJRank", ""),
        "bw_first_seen": fmt_epoch(profile.get("FirstIndexed")),
        "bw_last_seen": fmt_epoch(profile.get("LastIndexed")),
    }


def enrich(domain):
    return enrich_free(domain) if API_MODE == "free" else enrich_full(domain)


# ── Main ──────────────────────────────────────────────────────────────────────

print("BuiltWith Bulk Domain Enrichment")
print(f"Input file:    {INPUT_FILE}")
print(f"Output file:   {OUTPUT_FILE}")
print(f"API mode:      {API_MODE}")
print(f"Domain column: {DOMAIN_COLUMN}")
print("---")

# Read input CSV
with open(INPUT_FILE, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    if DOMAIN_COLUMN not in (reader.fieldnames or []):
        print(f"Error: column '{DOMAIN_COLUMN}' not found in {INPUT_FILE}.", file=sys.stderr)
        print(f"Available columns: {', '.join(reader.fieldnames or [])}", file=sys.stderr)
        sys.exit(1)
    rows = list(reader)
    original_fields = list(reader.fieldnames or [])

output_fields = original_fields + [c for c in ENRICH_COLUMNS if c not in original_fields]

print(f"Rows to enrich: {len(rows)}")
print("Enriching...")

enriched_rows = []
for i, row in enumerate(rows, 1):
    domain = row.get(DOMAIN_COLUMN, "").strip()
    if not domain:
        print(f"  [{i}/{len(rows)}] skipped (empty domain)")
        enriched_rows.append({**row, **{col: "" for col in ENRICH_COLUMNS}})
        continue

    print(f"  [{i}/{len(rows)}] {domain}")
    extra = {col: "" for col in ENRICH_COLUMNS}
    try:
        extra = enrich(domain)
    except Exception as e:
        print(f"    Warning: enrichment failed — {e}")

    enriched_rows.append({**row, **extra})

    if ENRICH_DELAY > 0 and i < len(rows):
        time.sleep(ENRICH_DELAY)

print(f"Writing {OUTPUT_FILE}...")
with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=output_fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(enriched_rows)

print("---")
print(f"Done. {len(enriched_rows)} rows written to {OUTPUT_FILE}")
