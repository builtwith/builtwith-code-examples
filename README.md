# 🏗️ BuiltWith Code Examples

> A collection of ready-to-run examples and utilities for the [BuiltWith API](https://api.builtwith.com) — helping you build smarter sales pipelines, enrich CRMs, and analyze the web's technology landscape.

---

## 🚀 Live Feed Integrations

Stream newly-detected domains in real time from the BuiltWith Live Feed WebSocket and pipe them straight into your stack.

| Example | Description | Languages |
|---|---|---|
| [live-feed-to-slack](./live-feed-to-slack) | 💬 Stream newly detected domains into a Slack channel as they're discovered | Node.js, Python |
| [live-feed-to-salesforce](./live-feed-to-salesforce) | ☁️ Stream live feed domains, enrich with Domain API profiles, and push mapped leads to Salesforce | Node.js, Python |
| [live-feed-to-hubspot](./live-feed-to-hubspot) | 🟠 Stream live feed domains, enrich via Domain API, and upsert contacts directly into HubSpot CRM | Node.js, Python |
| [live-feed-to-pipedrive](./live-feed-to-pipedrive) | 🟢 Stream live feed domains, enrich via Domain API, and upsert organizations in Pipedrive with a tech-stack note | Node.js, Python |

---

## 📋 Lists & Bulk Enrichment

Pull technology lists and enrich domains at scale — great for building targeted prospect lists and sales-ready exports.

| Example | Description | Languages |
|---|---|---|
| [lists-api-to-csv-enriched](./lists-api-to-csv-enriched) | 📊 Pull a technology list, enrich each domain with tech stack and company metadata, and export a sales-ready CSV | Node.js, Python |
| [bulk-domain-api-async](./bulk-domain-api-async) | ⚡ CLI wrapper for the async bulk Domain API — submit a batch, poll for completion, download results, and resume interrupted jobs | Node.js, Python |
| [bulk-domain-enrichment](./bulk-domain-enrichment) | 🗂️ Enrich a CSV of domains with tech categories, spend score, and company metadata via the Free API or Domain API | Node.js, Python |
| [keyword-search-to-live-high-spend](./keyword-search-to-live-high-spend) | 💰 Search for sites by keyword, enrich with the Domain API, and filter to only live sites spending $1,000+/mo on web tech | Node.js, Python |

---

## 🔍 Core API Examples

Fundamental building blocks for looking up domains, technologies, and companies.

| Example | Description | Languages |
|---|---|---|
| [domain-api](./domain-api) | 🌐 Look up the full technology stack and metadata for any domain | Node.js, Python |
| [lists-api](./lists-api) | 📝 Get lists of websites actively using a specific technology | Node.js, Python |
| [free-api](./free-api) | 🆓 Get summary technology counts and group data for a domain | Node.js, Python |
| [company-to-url-api](./company-to-url-api) | 🏢 Find domains associated with a company name | Node.js, Python |

---

## 🕸️ Relationships & Discovery

Uncover hidden connections between websites, technologies, and social profiles.

| Example | Description | Languages |
|---|---|---|
| [relationships-api](./relationships-api) | 🔗 Discover connections and relationships between websites | Node.js, Python |
| [tags-api](./tags-api) | 🏷️ Find domains related to IP addresses and site attributes | Node.js, Python |
| [recommendations-api](./recommendations-api) | 💡 Get technology recommendations based on what similar sites use | Node.js, Python |
| [social-api](./social-api) | 📱 Look up domains linked to social media profiles | Node.js, Python |
| [redirects-api](./redirects-api) | ↪️ Track live and historical domain redirects | Node.js, Python |

---

## 📈 Trends & Intelligence

Analyze technology adoption over time and evaluate domain signals.

| Example | Description | Languages |
|---|---|---|
| [trends-api](./trends-api) | 📉 Analyze technology adoption trends and usage metrics over time | Node.js, Python |
| [keywords-api](./keywords-api) | 🔑 Extract keywords and topics associated with a domain | Node.js, Python |
| [product-api](./product-api) | 🛒 Find websites selling specific products | Node.js, Python |
| [trust-api](./trust-api) | 🛡️ Evaluate trust and fraud signals for a domain | Node.js, Python |

---

## 🔧 Account & Utilities

Check your credentials, usage, and quota.

| Example | Description | Languages |
|---|---|---|
| [whoami-api](./whoami-api) | 🪪 Verify API credentials and check your account status | Node.js, Python |
| [usage-api](./usage-api) | 📟 Check API usage and remaining quota | Node.js, Python |

---

## 🏁 Getting Started

1. **Get an API key** — grab one at [api.builtwith.com](https://api.builtwith.com)
2. **Pick an example** — browse the sections above and navigate into the folder
3. **Follow the README** — each example has its own setup instructions for both Node.js and Python

> 💡 All examples accept your API key via an environment variable — no hardcoded secrets needed.
