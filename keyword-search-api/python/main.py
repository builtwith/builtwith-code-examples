import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv("BUILTWITH_API_KEY")
keyword = os.getenv("KEYWORD", "perfume")

if not api_key or api_key == "your-api-key-here":
    print("Error: Set a valid BUILTWITH_API_KEY in your .env file.", file=sys.stderr)
    print("Get your API key at https://api.builtwith.com", file=sys.stderr)
    sys.exit(1)

print("BuiltWith Keyword Search API")
print(f"Searching for: {keyword}")
print("---")

response = requests.get("https://api.builtwith.com/kws1/api.json", params={"KEY": api_key, "KEYWORD": keyword})
response.raise_for_status()
print(json.dumps(response.json(), indent=2))
