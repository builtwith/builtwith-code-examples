import os
import sys
import json
import asyncio
from datetime import datetime, timezone

import requests
import websockets
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("BUILTWITH_API_KEY")
CHANNELS = [ch.strip() for ch in os.getenv("BUILTWITH_CHANNELS", "new").split(",") if ch.strip()]

DOMAIN_API_LIVEONLY = os.getenv("DOMAIN_API_LIVEONLY", "true").lower() in ("1", "true", "y", "yes")
DOMAIN_API_NOPII = os.getenv("DOMAIN_API_NOPII", "false").lower() in ("1", "true", "y", "yes")
DOMAIN_API_NOMETA = os.getenv("DOMAIN_API_NOMETA", "false").lower() in ("1", "true", "y", "yes")
DOMAIN_API_NOATTR = os.getenv("DOMAIN_API_NOATTR", "true").lower() in ("1", "true", "y", "yes")

SF_LOGIN_URL = os.getenv("SF_LOGIN_URL", "https://login.salesforce.com").rstrip("/")
SF_API_VERSION = os.getenv("SF_API_VERSION", "v61.0")
SF_CLIENT_ID = os.getenv("SF_CLIENT_ID")
SF_CLIENT_SECRET = os.getenv("SF_CLIENT_SECRET")
SF_USERNAME = os.getenv("SF_USERNAME")
SF_PASSWORD = os.getenv("SF_PASSWORD")
SF_SECURITY_TOKEN = os.getenv("SF_SECURITY_TOKEN", "")
SF_UPSERT_BY_WEBSITE = os.getenv("SF_UPSERT_BY_WEBSITE", "true").lower() in ("1", "true", "y", "yes")
SF_LEAD_SOURCE = os.getenv("SF_LEAD_SOURCE", "BuiltWith Live Feed")

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

if not SF_CLIENT_ID or not SF_CLIENT_SECRET or not SF_USERNAME or not SF_PASSWORD:
    print(
        "Error: Set SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, and SF_PASSWORD in your .env file.",
        file=sys.stderr,
    )
    sys.exit(1)

WEBSOCKET_URL = f"wss://sync.builtwith.com/wss/new?KEY={API_KEY}"
RECONNECT_DELAY = 5

_sf_access_token = None
_sf_instance_url = None


def fmt_epoch_date(epoch_ms):
    if not epoch_ms:
        return ""
    try:
        return datetime.fromtimestamp(int(epoch_ms) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError):
        return ""


def first_or_none(items):
    return items[0] if isinstance(items, list) and items else None


def collect_tech_names(result):
    seen = set()
    names = []
    for path in result.get("Paths", []):
        for tech in path.get("Technologies", []):
            name = tech.get("Name")
            if not name or name in seen:
                continue
            seen.add(name)
            names.append(name)
            if len(names) >= 25:
                return names
    return names


def derive_last_name(meta, domain):
    names = meta.get("Names", [])
    if names and names[0].get("Name"):
        parts = names[0]["Name"].strip().split()
        if parts:
            return parts[-1]
    return domain


def get_domain_profile(domain):
    params = {
        "KEY": API_KEY,
        "LOOKUP": domain,
    }
    if DOMAIN_API_LIVEONLY:
        params["LIVEONLY"] = "y"
    if DOMAIN_API_NOPII:
        params["NOPII"] = "y"
    if DOMAIN_API_NOMETA:
        params["NOMETA"] = "y"
    if DOMAIN_API_NOATTR:
        params["NOATTR"] = "y"

    response = requests.get("https://api.builtwith.com/v23/api.json", params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    results = data.get("Results", [])
    if not results:
        raise RuntimeError(f"No Results returned for domain: {domain}")
    return results[0]


def map_to_lead(live_feed_message, profile):
    domain = live_feed_message.get("D") or live_feed_message.get("domain") or profile.get("Lookup") or "unknown"
    channel = live_feed_message.get("C") or live_feed_message.get("channel") or ""
    result = profile.get("Result", {})
    meta = profile.get("Meta", {})

    company = meta.get("CompanyName") or domain
    email = first_or_none(meta.get("Emails", []))
    phone = first_or_none(meta.get("Telephones", []))
    tech_names = collect_tech_names(result)
    first_indexed = fmt_epoch_date(profile.get("FirstIndexed"))
    last_indexed = fmt_epoch_date(profile.get("LastIndexed"))
    last_name = derive_last_name(meta, domain)

    description = "\n".join(
        [
            f"BuiltWith Live Feed channel: {channel or '(unknown)'}",
            f"Lookup domain: {domain}",
            f"Vertical: {meta.get('Vertical', 'unknown')}",
            f"ARank: {meta.get('ARank', 'n/a')}, QRank: {meta.get('QRank', 'n/a')}",
            f"Spend estimate: {profile.get('SalesRevenue', result.get('Spend', 0))}",
            f"FirstIndexed: {first_indexed or 'n/a'}, LastIndexed: {last_indexed or 'n/a'}",
            f"Top technologies: {', '.join(tech_names) if tech_names else '(none)'}",
        ]
    )

    lead = {
        "LastName": last_name,
        "Company": company,
        "Website": f"https://{domain}",
        "LeadSource": SF_LEAD_SOURCE,
        "Description": description,
    }

    if email:
        lead["Email"] = email
    if phone:
        lead["Phone"] = phone
    if meta.get("City"):
        lead["City"] = meta["City"]
    if meta.get("State"):
        lead["State"] = meta["State"]
    if meta.get("Country"):
        lead["Country"] = meta["Country"]

    return lead


def sf_auth():
    global _sf_access_token, _sf_instance_url

    response = requests.post(
        f"{SF_LOGIN_URL}/services/oauth2/token",
        data={
            "grant_type": "password",
            "client_id": SF_CLIENT_ID,
            "client_secret": SF_CLIENT_SECRET,
            "username": SF_USERNAME,
            "password": f"{SF_PASSWORD}{SF_SECURITY_TOKEN}",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    _sf_access_token = data["access_token"]
    _sf_instance_url = data["instance_url"]


def sf_headers():
    if not _sf_access_token or not _sf_instance_url:
        sf_auth()
    return {
        "Authorization": f"Bearer {_sf_access_token}",
        "Content-Type": "application/json",
    }


def sf_find_lead_by_website(website):
    escaped_website = website.replace("'", "\\'")
    soql = f"SELECT Id FROM Lead WHERE Website = '{escaped_website}' ORDER BY CreatedDate DESC LIMIT 1"
    response = requests.get(
        f"{_sf_instance_url}/services/data/{SF_API_VERSION}/query",
        params={"q": soql},
        headers=sf_headers(),
        timeout=30,
    )
    response.raise_for_status()
    records = response.json().get("records", [])
    if not records:
        return None
    return records[0].get("Id")


def sf_create_lead(lead):
    response = requests.post(
        f"{_sf_instance_url}/services/data/{SF_API_VERSION}/sobjects/Lead",
        json=lead,
        headers=sf_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("id")


def sf_update_lead(lead_id, lead):
    response = requests.patch(
        f"{_sf_instance_url}/services/data/{SF_API_VERSION}/sobjects/Lead/{lead_id}",
        json=lead,
        headers=sf_headers(),
        timeout=30,
    )
    response.raise_for_status()


def save_lead(lead):
    if SF_UPSERT_BY_WEBSITE and lead.get("Website"):
        lead_id = sf_find_lead_by_website(lead["Website"])
        if lead_id:
            sf_update_lead(lead_id, lead)
            return ("updated", lead_id)

    lead_id = sf_create_lead(lead)
    return ("created", lead_id)


async def connect():
    while True:
        try:
            print("Connecting to BuiltWith Live Feed...")
            async with websockets.connect(WEBSOCKET_URL) as ws:
                print("Connected to BuiltWith Live Feed.")

                for channel in CHANNELS:
                    await ws.send(json.dumps({"action": "subscribe", "channel": channel}))
                    print(f"Subscribed to channel: {channel}")

                async for raw in ws:
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        print(f"Failed to parse message: {raw}")
                        continue

                    if "action" in data or "status" in data:
                        print(f"Control message: {json.dumps(data)}")
                        continue

                    domain = data.get("D") or data.get("domain")
                    if not domain:
                        print(f"Non-domain message: {json.dumps(data)}")
                        continue

                    print(f"Domain: {domain}")

                    try:
                        profile = get_domain_profile(domain)
                        lead = map_to_lead(data, profile)
                        action, lead_id = save_lead(lead)
                        print(f"Salesforce lead {action}: {lead_id} ({domain})")
                    except Exception as e:
                        print(f"Failed to process {domain}: {e}")

        except (websockets.ConnectionClosed, ConnectionError, OSError) as e:
            print(f"WebSocket closed ({e}). Reconnecting in {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)


print("BuiltWith Live Feed -> Salesforce")
print(f"Channels: {', '.join(CHANNELS)}")
print("---")

asyncio.run(connect())
