import json
import requests

print("BuiltWith VAT Types API")
print("---")

response = requests.get("https://api.builtwith.com/vat1/types.json")
response.raise_for_status()
print(json.dumps(response.json(), indent=2))
