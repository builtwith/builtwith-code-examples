import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

api_key = os.getenv("BUILTWITH_API_KEY")
tech = os.getenv("TECH", "Google-Analytics")
other_techs = os.getenv("OTHERTECHS", "Meta-Pixel")
max_domains = int(os.getenv("MAX_DOMAINS", "100"))

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

base_params = {"KEY": api_key, "TECH": tech, "OTHERTECHS": other_techs}
if os.getenv("COUNTRY"):
    base_params["COUNTRY"] = os.getenv("COUNTRY")
if os.getenv("SINCE"):
    base_params["SINCE"] = os.getenv("SINCE")

print("BuiltWith Lists API - Two Technologies")
print(f"Technology: {tech}")
print(f"Other technologies: {other_techs}")
print("---")

offset = ""
total = 0

while total < max_domains:
    params = dict(base_params)
    if offset:
        params["OFFSET"] = offset

    response = requests.get("https://api.builtwith.com/lists12/api.json", params=params, timeout=30)
    response.raise_for_status()
    result = response.json()

    for entry in result.get("Results", []):
        if total >= max_domains:
            break
        print(entry.get("D") or entry.get("Domain") or "unknown")
        total += 1

    next_offset = result.get("NextOffset")
    if not next_offset or next_offset == "END":
        break
    offset = next_offset

print("---")
print(f"Done. Printed {total} domains.")
