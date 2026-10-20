# Official Python SDK example

Install the standalone SDK from the workspace root:

```bash
python -m pip install ./builtwith-python
python builtwith-code-examples/python-sdk/main.py
```

Install from PyPI with `pip install builtwith-official`. Import from
`builtwith_official`, not the unrelated `builtwith` package. The executable example
only lists public VAT types: no key, credits, or LLM service required.

Set `BUILTWITH_API_KEY` in your environment to use authenticated methods.
The `inspect_website_technologies` function is suitable for an agent tool and uses
API credits when explicitly invoked. The [SDK project](https://github.com/builtwith/builtwith-python) contains async, FastAPI,
LangChain/LlamaIndex, pagination and MCP examples. No existing examples change builds.
