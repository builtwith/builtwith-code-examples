import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key    = os.getenv("BUILTWITH_API_KEY")
query      = os.getenv("QUERY", "Magento websites in Spain")
commit     = os.getenv("COMMIT", "").lower() == "true"   # set COMMIT=true for a full report
next_offset = os.getenv("NEXTOFFSET", "")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

params = {"KEY": api_key, "QUERY": query}
if commit:
    params["COMMIT"] = "true"
if next_offset:
    params["NEXTOFFSET"] = next_offset

print("BuiltWith Ask API")
print(f"Query: {query}")
if commit:
    print("Mode: full report (COMMIT=true)")
print("---")

response = requests.get("https://api.builtwith.com/ask1/api.json", params=params)
response.raise_for_status()

result = response.json()
print(f"Explanation: {result.get('Explanation')}")
print(f"Results count: {len(result.get('Results', []))}")
if result.get("NextOffset"):
    note = "(no more pages)" if result["NextOffset"] == "END" else "(use for next page)"
    print(f"NextOffset: {result['NextOffset']} {note}")
print("---")
print(json.dumps(result, indent=2))
