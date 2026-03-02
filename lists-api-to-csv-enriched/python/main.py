import os
import sys
import csv
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("BUILTWITH_API_KEY")
TECH = os.getenv("TECH", "Shopify")
MAX_DOMAINS = int(os.getenv("MAX_DOMAINS", "50"))
COUNTRY = os.getenv("COUNTRY", "")
SINCE = os.getenv("SINCE", "")
LIVEONLY = os.getenv("LIVEONLY", "true").lower() in ("1", "true", "y", "yes")
ENRICH_DELAY = float(os.getenv("ENRICH_DELAY", "0.5"))

safe_tech_name = TECH.lower().replace(" ", "-")
default_output = f"{safe_tech_name}-enriched.csv"
OUTPUT_FILE = os.getenv("OUTPUT_FILE", default_output)

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

CSV_FIELDS = [
    "domain", "company", "website", "vertical", "country", "city", "state",
    "email", "phone", "linkedin", "twitter",
    "technologies", "tech_categories",
    "mj_rank", "spend_estimate", "bw_rank",
    "first_indexed", "last_indexed", "first_detected_tech", "last_detected_tech",
]


def fmt_epoch(ms):
    if not ms:
        return ""
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError):
        return ""


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


def find_social(meta, keyword):
    for entry in meta.get("Social", []):
        url = entry if isinstance(entry, str) else entry.get("URL") or entry.get("Handle") or ""
        if keyword in url.lower():
            return url
    return ""


def fetch_domains(tech, max_domains, country, since):
    domains = []
    params = {"KEY": API_KEY, "TECH": tech}
    if country:
        params["COUNTRY"] = country
    if since:
        params["SINCE"] = since

    offset = ""
    page = 1

    while len(domains) < max_domains:
        page_params = dict(params)
        if offset:
            page_params["OFFSET"] = offset

        print(f"  Lists API page {page}...")
        res = requests.get("https://api.builtwith.com/lists12/api.json", params=page_params, timeout=30)
        res.raise_for_status()
        data = res.json()

        entries = data.get("Results", [])
        for entry in entries:
            if len(domains) >= max_domains:
                break
            domains.append(entry)

        next_offset = data.get("NextOffset")
        if not next_offset or next_offset == "END" or len(domains) >= max_domains:
            break

        offset = next_offset
        page += 1

    return domains


def enrich_domain(domain):
    params = {"KEY": API_KEY, "LOOKUP": domain}
    if LIVEONLY:
        params["LIVEONLY"] = "y"

    res = requests.get("https://api.builtwith.com/v22/api.json", params=params, timeout=30)
    res.raise_for_status()
    data = res.json()

    results = data.get("Results", [])
    return results[0] if results else None


def build_row(list_entry, profile):
    domain = list_entry.get("D", "")

    if profile:
        result = profile.get("Result", {})
        meta = profile.get("Meta", {})
        attrs = profile.get("Attributes", {})

        tech_names = collect_tech_names(result)
        tech_cats = collect_tech_categories(result)

        emails = meta.get("Emails") or []
        phones = meta.get("Telephones") or []

        company = meta.get("CompanyName", "")
        vertical = meta.get("Vertical", "")
        country = meta.get("Country", "")
        city = meta.get("City", "")
        state = meta.get("State", "")
        email = emails[0] if emails else ""
        phone = phones[0] if phones else ""
        linkedin = find_social(meta, "linkedin")
        twitter = find_social(meta, "twitter")
        mj_rank = attrs.get("MJRank", "")
    else:
        company = vertical = country = city = state = ""
        email = phone = linkedin = twitter = ""
        tech_names = []
        tech_cats = []
        mj_rank = ""

    return {
        "domain": domain,
        "company": company,
        "website": f"https://{domain}" if domain else "",
        "vertical": vertical,
        "country": country,
        "city": city,
        "state": state,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "twitter": twitter,
        "technologies": " | ".join(tech_names),
        "tech_categories": " | ".join(tech_cats),
        "mj_rank": mj_rank,
        "spend_estimate": list_entry.get("S", ""),
        "bw_rank": list_entry.get("R", ""),
        "first_indexed": fmt_epoch(list_entry.get("FI")),
        "last_indexed": fmt_epoch(list_entry.get("LI")),
        "first_detected_tech": fmt_epoch(list_entry.get("FD")),
        "last_detected_tech": fmt_epoch(list_entry.get("LD")),
    }


print("BuiltWith Lists API → CSV Enriched")
print(f"Technology:   {TECH}")
print(f"Max domains:  {MAX_DOMAINS}")
print(f"Output file:  {OUTPUT_FILE}")
if COUNTRY:
    print(f"Country:      {COUNTRY}")
if SINCE:
    print(f"Since:        {SINCE}")
print(f"Live only:    {LIVEONLY}")
print("---")

print("Step 1: Fetching domain list...")
list_entries = fetch_domains(TECH, MAX_DOMAINS, COUNTRY, SINCE)
print(f"  Fetched {len(list_entries)} domains")

print("Step 2: Enriching with Domain API...")
rows = []
for i, entry in enumerate(list_entries, 1):
    domain = entry.get("D", "")
    print(f"  [{i}/{len(list_entries)}] {domain}")

    profile = None
    try:
        profile = enrich_domain(domain)
    except Exception as e:
        print(f"    Warning: enrichment failed — {e}")

    rows.append(build_row(entry, profile))

    if ENRICH_DELAY > 0 and i < len(list_entries):
        time.sleep(ENRICH_DELAY)

print("Step 3: Writing CSV...")
with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
    writer.writeheader()
    writer.writerows(rows)

print("---")
print(f"Done. {len(rows)} rows written to {OUTPUT_FILE}")
