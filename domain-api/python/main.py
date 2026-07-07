import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv("BUILTWITH_API_KEY")
lookup = os.getenv("LOOKUP", "builtwith.com")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

print("BuiltWith Domain API")
print(f"Looking up: {lookup}")
print("---")

params = {"KEY": api_key, "LOOKUP": lookup}

if os.getenv("LIVEONLY") == "true":
    params["LIVEONLY"] = "y"
if os.getenv("NOPII") == "true":
    params["NOPII"] = "y"
if os.getenv("NOMETA") == "true":
    params["NOMETA"] = "y"
if os.getenv("NOATTR") == "true":
    params["NOATTR"] = "y"

response = requests.get("https://api.builtwith.com/v23/api.json", params=params)
response.raise_for_status()
print(json.dumps(response.json(), indent=2))
