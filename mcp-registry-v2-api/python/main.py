import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv("BUILTWITH_API_KEY")
search = os.getenv("SEARCH", "payments")
category = os.getenv("CATEGORY")
offset = os.getenv("OFFSET")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

print("BuiltWith MCP Registry API (v2)")
print(f"Searching for: {search}")
print("---")

params = {"KEY": api_key}
if search:
    params["SEARCH"] = search
if category:
    params["CATEGORY"] = category
if offset:
    params["OFFSET"] = offset

response = requests.get("https://api.builtwith.com/mcp2/api.json", params=params)
response.raise_for_status()
print(json.dumps(response.json(), indent=2))
