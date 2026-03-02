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

HUBSPOT_ACCESS_TOKEN = os.getenv("HUBSPOT_ACCESS_TOKEN")
HUBSPOT_UPSERT_BY_WEBSITE = os.getenv("HUBSPOT_UPSERT_BY_WEBSITE", "true").lower() in ("1", "true", "y", "yes")
HUBSPOT_LEAD_SOURCE = os.getenv("HUBSPOT_LEAD_SOURCE", "BuiltWith Live Feed")

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

if not HUBSPOT_ACCESS_TOKEN or HUBSPOT_ACCESS_TOKEN == "your-hubspot-access-token-here":
    print("Error: Set HUBSPOT_ACCESS_TOKEN in your .env file.", file=sys.stderr)
    print("Create a Private App at https://app.hubspot.com/private-apps", file=sys.stderr)
    sys.exit(1)

WEBSOCKET_URL = f"wss://sync.builtwith.com/wss/new?KEY={API_KEY}"
RECONNECT_DELAY = 5
HS_BASE = "https://api.hubapi.com"


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


def get_domain_profile(domain):
    params = {"KEY": API_KEY, "LOOKUP": domain}
    if DOMAIN_API_LIVEONLY:
        params["LIVEONLY"] = "y"
    if DOMAIN_API_NOPII:
        params["NOPII"] = "y"
    if DOMAIN_API_NOMETA:
        params["NOMETA"] = "y"
    if DOMAIN_API_NOATTR:
        params["NOATTR"] = "y"
    res = requests.get("https://api.builtwith.com/v22/api.json", params=params, timeout=30)
    res.raise_for_status()
    data = res.json()
    results = data.get("Results", [])
    if not results:
        raise RuntimeError(f"No Results returned for domain: {domain}")
    return results[0]


def hs_headers():
    return {
        "Authorization": f"Bearer {HUBSPOT_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def map_to_contact(live_feed_msg, profile):
    domain = live_feed_msg.get("D") or live_feed_msg.get("domain") or profile.get("Lookup") or "unknown"
    channel = live_feed_msg.get("C") or live_feed_msg.get("channel") or ""
    result = profile.get("Result", {})
    meta = profile.get("Meta", {})

    company = meta.get("CompanyName") or domain
    email = first_or_none(meta.get("Emails", []))
    phone = first_or_none(meta.get("Telephones", []))
    tech_names = collect_tech_names(result)
    first_indexed = fmt_epoch_date(profile.get("FirstIndexed"))
    last_indexed = fmt_epoch_date(profile.get("LastIndexed"))

    description = "\n".join([
        f"BuiltWith Live Feed channel: {channel or '(unknown)'}",
        f"Lookup domain: {domain}",
        f"Vertical: {meta.get('Vertical', 'unknown')}",
        f"Spend estimate: {profile.get('SalesRevenue', result.get('Spend', 0))}",
        f"FirstIndexed: {first_indexed or 'n/a'}, LastIndexed: {last_indexed or 'n/a'}",
        f"Top technologies: {', '.join(tech_names) if tech_names else '(none)'}",
    ])

    properties = {
        "lastname": company,
        "firstname": "Unknown",
        "company": company,
        "website": f"https://{domain}",
        "description": description,
        "hs_lead_status": "NEW",
        "lifecyclestage": "lead",
        "lead_source": HUBSPOT_LEAD_SOURCE,
    }

    if email:
        properties["email"] = email
    if phone:
        properties["phone"] = phone
    if meta.get("Vertical"):
        properties["industry"] = meta["Vertical"]
    if meta.get("City"):
        properties["city"] = meta["City"]
    if meta.get("State"):
        properties["state"] = meta["State"]
    if meta.get("Country"):
        properties["country"] = meta["Country"]

    return properties


def hs_search_contact_by_website(website):
    body = {
        "filterGroups": [{"filters": [{"propertyName": "website", "operator": "EQ", "value": website}]}],
        "properties": ["hs_object_id", "website"],
        "limit": 1,
    }
    res = requests.post(f"{HS_BASE}/crm/v3/objects/contacts/search", json=body, headers=hs_headers(), timeout=30)
    res.raise_for_status()
    results = res.json().get("results", [])
    return results[0]["id"] if results else None


def hs_create_contact(properties):
    res = requests.post(
        f"{HS_BASE}/crm/v3/objects/contacts",
        json={"properties": properties},
        headers=hs_headers(),
        timeout=30,
    )
    res.raise_for_status()
    return "created", res.json()["id"]


def hs_update_contact(contact_id, properties):
    res = requests.patch(
        f"{HS_BASE}/crm/v3/objects/contacts/{contact_id}",
        json={"properties": properties},
        headers=hs_headers(),
        timeout=30,
    )
    res.raise_for_status()
    return "updated", contact_id


def save_contact(properties):
    if HUBSPOT_UPSERT_BY_WEBSITE and properties.get("website"):
        existing_id = hs_search_contact_by_website(properties["website"])
        if existing_id:
            return hs_update_contact(existing_id, properties)
    return hs_create_contact(properties)


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
                        properties = map_to_contact(data, profile)
                        action, contact_id = save_contact(properties)
                        print(f"HubSpot contact {action}: {contact_id} ({domain})")
                    except Exception as e:
                        print(f"Failed to process {domain}: {e}")

        except (websockets.ConnectionClosed, ConnectionError, OSError) as e:
            print(f"WebSocket closed ({e}). Reconnecting in {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)


print("BuiltWith Live Feed -> HubSpot")
print(f"Channels: {', '.join(CHANNELS)}")
print("---")

asyncio.run(connect())
