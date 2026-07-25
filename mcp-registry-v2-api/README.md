# BuiltWith MCP Registry API (v2)

Search and browse the BuiltWith MCP registry of other remote MCP servers BuiltWith has discovered (this is not an MCP protocol endpoint itself). Returns each server's endpoint URL(s), per-endpoint auth requirements, the tools (methods) they support with descriptions, and first/last detected dates.

## Prerequisites

- A **BuiltWith API key** — get one at [https://api.builtwith.com](https://api.builtwith.com)
- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Copy the example environment file and fill in your key:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   SEARCH=payments
   ```

4. Run:

   ```bash
   npm start
   ```

## Setup — Python

1. Install dependencies:

   ```bash
   cd python
   pip install -r requirements.txt
   ```

2. Copy the example environment file and fill in your key:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your values:

   ```
   BUILTWITH_API_KEY=your-api-key-here
   SEARCH=payments
   ```

4. Run:

   ```bash
   python main.py
   ```

## Configuration

| Variable | Description |
|---|---|
| `BUILTWITH_API_KEY` | Your BuiltWith API key |
| `SEARCH` | Text to search for — matches domain, description, endpoint URL, and tool names/descriptions (optional) |
| `CATEGORY` | Category to filter by, e.g. `developer-tools` (optional) |
| `OFFSET` | Pagination offset (optional) |

## API Reference

- **Endpoint**: `https://api.builtwith.com/mcp2/api.json`
- **Method**: GET
- **Parameters**: `KEY`, `SEARCH`, `CATEGORY`, `OFFSET`
- **Cost**: free — no API credits used. Rate limited to 1 request per second per API key (stricter than the general API rate limit since it's free)
- **Response**: a JSON array of results, each with `Domain`, `Category`, `Description`, `Endpoints` (an array of `{ Endpoint, AuthRequired, Tools: [{ Name, Description }] }`), `first_detected`, and `last_detected`. On error, returns `{ "Errors": [{ "Message", "Code" }] }` instead.

Especially useful for AI agents/MCP clients discovering remote MCP servers and methods to connect to. This v2 response adds per-endpoint `AuthRequired` flags and nests tools under each endpoint (rather than one flat tool list per server), plus `first_detected`/`last_detected` dates, compared to v1.
