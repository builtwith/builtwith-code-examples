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

PIPEDRIVE_API_TOKEN = os.getenv("PIPEDRIVE_API_TOKEN")
PIPEDRIVE_UPSERT_BY_NAME = os.getenv("PIPEDRIVE_UPSERT_BY_NAME", "true").lower() in ("1", "true", "y", "yes")
PIPEDRIVE_ADD_NOTE = os.getenv("PIPEDRIVE_ADD_NOTE", "true").lower() in ("1", "true", "y", "yes")

if not API_KEY or API_KEY == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

if not PIPEDRIVE_API_TOKEN or PIPEDRIVE_API_TOKEN == "your-pipedrive-api-token-here":
    print("Error: Set PIPEDRIVE_API_TOKEN in your .env file.", file=sys.stderr)
    print("Find your token at https://app.pipedrive.com/settings/api", file=sys.stderr)
    sys.exit(1)

WEBSOCKET_URL = f"wss://sync.builtwith.com/wss/new?KEY={API_KEY}"
RECONNECT_DELAY = 5
PD_BASE = "https://api.pipedrive.com"


def fmt_epoch_date(epoch_ms):
    if not epoch_ms:
        return ""
    try:
        return datetime.fromtimestamp(int(epoch_ms) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError):
        return ""


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


def pd_params():
    return {"api_token": PIPEDRIVE_API_TOKEN}


def map_to_organization(live_feed_msg, profile):
    domain = live_feed_msg.get("D") or live_feed_msg.get("domain") or profile.get("Lookup") or "unknown"
    channel = live_feed_msg.get("C") or live_feed_msg.get("channel") or ""
    result = profile.get("Result", {})
    meta = profile.get("Meta", {})

    name = meta.get("CompanyName") or domain
    address_parts = [p for p in [meta.get("City"), meta.get("State"), meta.get("Country")] if p]
    address = ", ".join(address_parts)

    tech_names = collect_tech_names(result)
    first_indexed = fmt_epoch_date(profile.get("FirstIndexed"))
    last_indexed = fmt_epoch_date(profile.get("LastIndexed"))

    note_content = "<br>".join([
        "<b>BuiltWith Live Feed</b>",
        f"Channel: {channel or '(unknown)'}",
        f'Domain: <a href="https://{domain}">{domain}</a>',
        f"Vertical: {meta.get('Vertical', 'unknown')}",
        f"Spend estimate: {profile.get('SalesRevenue', result.get('Spend', 0))}",
        f"FirstIndexed: {first_indexed or 'n/a'}, LastIndexed: {last_indexed or 'n/a'}",
        f"Top technologies: {', '.join(tech_names) if tech_names else '(none)'}",
    ])

    fields = {"name": name}
    if address:
        fields["address"] = address

    return fields, note_content


def pd_search_org_by_name(name):
    res = requests.get(
        f"{PD_BASE}/v1/organizations/search",
        params={**pd_params(), "term": name, "fields": "name", "exact_match": "true", "limit": 1},
        timeout=30,
    )
    res.raise_for_status()
    items = res.json().get("data", {}).get("items", [])
    return items[0]["item"]["id"] if items else None


def pd_create_org(fields):
    res = requests.post(f"{PD_BASE}/v1/organizations", json=fields, params=pd_params(), timeout=30)
    res.raise_for_status()
    return "created", res.json()["data"]["id"]


def pd_update_org(org_id, fields):
    res = requests.put(f"{PD_BASE}/v1/organizations/{org_id}", json=fields, params=pd_params(), timeout=30)
    res.raise_for_status()
    return "updated", org_id


def pd_add_note(org_id, content):
    res = requests.post(
        f"{PD_BASE}/v1/notes",
        json={"org_id": org_id, "content": content},
        params=pd_params(),
        timeout=30,
    )
    res.raise_for_status()


def save_organization(fields, note_content):
    if PIPEDRIVE_UPSERT_BY_NAME and fields.get("name"):
        existing_id = pd_search_org_by_name(fields["name"])
        if existing_id:
            action, org_id = pd_update_org(existing_id, fields)
        else:
            action, org_id = pd_create_org(fields)
    else:
        action, org_id = pd_create_org(fields)

    if PIPEDRIVE_ADD_NOTE and note_content:
        try:
            pd_add_note(org_id, note_content)
        except Exception as e:
            print(f"Warning: note creation failed for org {org_id}: {e}")

    return action, org_id


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
                        fields, note_content = map_to_organization(data, profile)
                        action, org_id = save_organization(fields, note_content)
                        print(f"Pipedrive organization {action}: {org_id} ({domain})")
                    except Exception as e:
                        print(f"Failed to process {domain}: {e}")

        except (websockets.ConnectionClosed, ConnectionError, OSError) as e:
            print(f"WebSocket closed ({e}). Reconnecting in {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)


print("BuiltWith Live Feed -> Pipedrive")
print(f"Channels: {', '.join(CHANNELS)}")
print("---")

asyncio.run(connect())
