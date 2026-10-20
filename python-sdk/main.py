"""Public SDK demo and a callable, credit-consuming agent tool."""
from builtwith_official import BuiltWith, JSONValue


def inspect_website_technologies(domain: str) -> JSONValue:
    """Return a domain technology profile. Uses BuiltWith API credits."""
    with BuiltWith() as client:
        return client.domain(domain, no_pii=True).data


if __name__ == "__main__":
    with BuiltWith() as client:
        print(client.vat_types().data)
