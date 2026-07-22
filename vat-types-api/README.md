# BuiltWith VAT Types API

List every company registration type the [VAT API](../vat-api) may return, with a friendly name and description for each. This is a public endpoint — no API key or credits required.

## Prerequisites

- **Node.js** v14+ or **Python** 3.8+

## Setup — Node.js

1. Install dependencies:

   ```bash
   cd nodejs
   npm install
   ```

2. Run:

   ```bash
   npm start
   ```

## Setup — Python

1. Install dependencies:

   ```bash
   cd python
   pip install -r requirements.txt
   ```

2. Run:

   ```bash
   python main.py
   ```

## API Reference

- **Endpoint**: `https://api.builtwith.com/vat1/types.json`
- **Method**: GET
- **Parameters**: none
- **Authentication**: none required, no API credits used
- **Response**: array of `{ Type, Name, Description }` records
