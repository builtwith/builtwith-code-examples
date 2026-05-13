import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv("BUILTWITH_API_KEY")
tech = os.getenv("TECH", "Shopify")
other_techs = os.getenv("OTHERTECHS", "")
offset = os.getenv("OFFSET", "")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

params = {"KEY": api_key, "TECH": tech}
attribute_filters = [
    "SPEND", "REVENUE", "SKU", "FOLLOWERS", "EMPLOYEES", "SITEMAP",
    "PAGERANK", "BWRANK", "TRANCO", "MAJESTIC", "BWS", "ECAT",
    "AIM", "AIO", "AIR", "AIV",
]

if os.getenv("META") == "yes":
    params["META"] = "yes"
if os.getenv("COUNTRY"):
    params["COUNTRY"] = os.getenv("COUNTRY")
if other_techs:
    params["OTHERTECHS"] = other_techs
if os.getenv("SINCE"):
    params["SINCE"] = os.getenv("SINCE")
if os.getenv("ALL") == "yes":
    params["ALL"] = "yes"
if offset:
    params["OFFSET"] = offset
for filter_name in attribute_filters:
    if os.getenv(filter_name):
        params[filter_name] = os.getenv(filter_name)

print("BuiltWith Lists API")
print(f"Technology: {tech}")
if other_techs:
    print(f"Other technologies: {other_techs}")
if os.getenv("COUNTRY"):
    print(f"Country: {os.getenv('COUNTRY')}")
if os.getenv("SINCE"):
    print(f"Since: {os.getenv('SINCE')}")
for filter_name in attribute_filters:
    if os.getenv(filter_name):
        print(f"{filter_name}: {os.getenv(filter_name)}")
if os.getenv("ALL") == "yes":
    print("Mode: all (including historical)")
if os.getenv("META") == "yes":
    print("Meta data: included")
print("---")

current_offset = offset
page = 1
total_domains = 0

while True:
    page_params = dict(params)
    if current_offset:
        page_params["OFFSET"] = current_offset

    print(f"Fetching page {page}...")
    response = requests.get("https://api.builtwith.com/lists12/api.json", params=page_params)
    response.raise_for_status()
    result = response.json()

    domains = result.get("Results", [])
    total_domains += len(domains)

    for entry in domains:
        domain = entry.get("D") or entry.get("Domain") or "unknown"
        print(f"  {domain}")

    print(f"Page {page}: {len(domains)} domains")

    next_offset = result.get("NextOffset")
    if not next_offset or next_offset == "END":
        print("---")
        print(f"Done. Total domains: {total_domains}")
        break

    current_offset = next_offset
    page += 1
