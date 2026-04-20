import sys
import time
import json
import urllib.request

POLL_INTERVAL_S = 5
TIMEOUT_S = 5 * 60


def post_json(path, body):
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.builtwith.com{path}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    print("BuiltWith Agent Device-Code Authorization")
    print("---")

    # Step 1: Start the device-code flow
    start = post_json("/agent-auth/start", {})
    device_code = start.get("device_code")
    verification_uri = start.get("verification_uri")
    if not device_code or not verification_uri:
        print(f"Failed to start authorization: {start}", file=sys.stderr)
        sys.exit(1)

    print(f"\nOpen this URL in your browser to authorize access:\n\n  {verification_uri}\n")
    print("Waiting for approval...")

    # Step 2: Poll every 5 seconds until approved, denied, or timed out
    deadline = time.time() + TIMEOUT_S
    while time.time() < deadline:
        time.sleep(POLL_INTERVAL_S)
        token = post_json("/agent-auth/token", {"device_code": device_code})

        if token.get("status") == "approved" and token.get("access_token"):
            print("\nAuthorization approved!")
            print(f"Access token: {token['access_token']}")
            print("\nUse this token as your BW_API_KEY environment variable or pass it as KEY= on any BuiltWith API endpoint.")
            return

        if token.get("status") == "denied":
            print("\nAuthorization was denied.", file=sys.stderr)
            sys.exit(1)

        print(".", end="", flush=True)

    print("\nAuthorization timed out after 5 minutes.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
