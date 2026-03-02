require('dotenv').config({ path: '../.env' });

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.BUILTWITH_API_KEY;
const TECH = process.env.TECH || 'Shopify';
const MAX_DOMAINS = parseInt(process.env.MAX_DOMAINS || '50', 10);
const COUNTRY = process.env.COUNTRY || '';
const SINCE = process.env.SINCE || '';
const LIVEONLY = (process.env.LIVEONLY || 'true').toLowerCase() !== 'false';
const ENRICH_DELAY = parseFloat(process.env.ENRICH_DELAY || '0.5') * 1000;

const safeTech = TECH.toLowerCase().replace(/\s+/g, '-');
const OUTPUT_FILE = process.env.OUTPUT_FILE || `${safeTech}-enriched.csv`;

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const CSV_FIELDS = [
  'domain', 'company', 'website', 'vertical', 'country', 'city', 'state',
  'email', 'phone', 'linkedin', 'twitter',
  'technologies', 'tech_categories',
  'mj_rank', 'spend_estimate', 'bw_rank',
  'first_indexed', 'last_indexed', 'first_detected_tech', 'last_detected_tech',
];

// --- Helpers ---

function fmtEpoch(ms) {
  if (!ms) return '';
  try {
    return new Date(Number(ms)).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(fields, obj) {
  return fields.map((f) => csvEscape(obj[f] ?? '')).join(',');
}

function collectTechNames(result, maxTechs = 25) {
  const seen = new Set();
  const names = [];
  for (const pathObj of result.Paths || []) {
    for (const tech of pathObj.Technologies || []) {
      if (tech.Name && !seen.has(tech.Name)) {
        seen.add(tech.Name);
        names.push(tech.Name);
        if (names.length >= maxTechs) return names;
      }
    }
  }
  return names;
}

function collectTechCategories(result) {
  const seen = new Set();
  const cats = [];
  for (const pathObj of result.Paths || []) {
    for (const tech of pathObj.Technologies || []) {
      if (tech.Tag && !seen.has(tech.Tag)) {
        seen.add(tech.Tag);
        cats.push(tech.Tag);
      }
    }
  }
  return cats;
}

function findSocial(meta, keyword) {
  for (const entry of meta.Social || []) {
    const url = typeof entry === 'string' ? entry : (entry.URL || entry.Handle || '');
    if (url.toLowerCase().includes(keyword)) return url;
  }
  return '';
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('Failed to parse response: ' + err.message));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Lists API ---

async function fetchDomains(tech, maxDomains, country, since) {
  const entries = [];
  const baseParams = new URLSearchParams({ KEY: API_KEY, TECH: tech });
  if (country) baseParams.append('COUNTRY', country);
  if (since) baseParams.append('SINCE', since);

  let offset = '';
  let page = 1;

  while (entries.length < maxDomains) {
    const params = new URLSearchParams(baseParams);
    if (offset) params.set('OFFSET', offset);

    console.log(`  Lists API page ${page}...`);
    const data = await httpGet(`https://api.builtwith.com/lists12/api.json?${params}`);

    for (const entry of data.Results || []) {
      if (entries.length >= maxDomains) break;
      entries.push(entry);
    }

    const nextOffset = data.NextOffset;
    if (!nextOffset || nextOffset === 'END' || entries.length >= maxDomains) break;

    offset = nextOffset;
    page++;
  }

  return entries;
}

// --- Domain API ---

async function enrichDomain(domain) {
  const params = new URLSearchParams({ KEY: API_KEY, LOOKUP: domain });
  if (LIVEONLY) params.append('LIVEONLY', 'y');

  const data = await httpGet(`https://api.builtwith.com/v22/api.json?${params}`);
  const results = data.Results || [];
  return results[0] || null;
}

// --- Row builder ---

function buildRow(listEntry, profile) {
  const domain = listEntry.D || '';

  let company = '', vertical = '', country = '', city = '', state = '';
  let email = '', phone = '', linkedin = '', twitter = '';
  let techNames = [], techCats = [], mjRank = '';

  if (profile) {
    const result = profile.Result || {};
    const meta = profile.Meta || {};
    const attrs = profile.Attributes || {};

    techNames = collectTechNames(result);
    techCats = collectTechCategories(result);

    company = meta.CompanyName || '';
    vertical = meta.Vertical || '';
    country = meta.Country || '';
    city = meta.City || '';
    state = meta.State || '';
    email = (meta.Emails || [])[0] || '';
    phone = (meta.Telephones || [])[0] || '';
    linkedin = findSocial(meta, 'linkedin');
    twitter = findSocial(meta, 'twitter');
    mjRank = attrs.MJRank != null ? String(attrs.MJRank) : '';
  }

  return {
    domain,
    company,
    website: domain ? `https://${domain}` : '',
    vertical,
    country,
    city,
    state,
    email,
    phone,
    linkedin,
    twitter,
    technologies: techNames.join(' | '),
    tech_categories: techCats.join(' | '),
    mj_rank: mjRank,
    spend_estimate: listEntry.S != null ? String(listEntry.S) : '',
    bw_rank: listEntry.R != null ? String(listEntry.R) : '',
    first_indexed: fmtEpoch(listEntry.FI),
    last_indexed: fmtEpoch(listEntry.LI),
    first_detected_tech: fmtEpoch(listEntry.FD),
    last_detected_tech: fmtEpoch(listEntry.LD),
  };
}

// --- Main ---

async function main() {
  console.log('BuiltWith Lists API → CSV Enriched');
  console.log(`Technology:   ${TECH}`);
  console.log(`Max domains:  ${MAX_DOMAINS}`);
  console.log(`Output file:  ${OUTPUT_FILE}`);
  if (COUNTRY) console.log(`Country:      ${COUNTRY}`);
  if (SINCE) console.log(`Since:        ${SINCE}`);
  console.log(`Live only:    ${LIVEONLY}`);
  console.log('---');

  console.log('Step 1: Fetching domain list...');
  const listEntries = await fetchDomains(TECH, MAX_DOMAINS, COUNTRY, SINCE);
  console.log(`  Fetched ${listEntries.length} domains`);

  console.log('Step 2: Enriching with Domain API...');
  const rows = [];
  for (let i = 0; i < listEntries.length; i++) {
    const entry = listEntries[i];
    const domain = entry.D || '';
    console.log(`  [${i + 1}/${listEntries.length}] ${domain}`);

    let profile = null;
    try {
      profile = await enrichDomain(domain);
    } catch (err) {
      console.log(`    Warning: enrichment failed — ${err.message}`);
    }

    rows.push(buildRow(entry, profile));

    if (ENRICH_DELAY > 0 && i < listEntries.length - 1) {
      await sleep(ENRICH_DELAY);
    }
  }

  console.log('Step 3: Writing CSV...');
  const lines = [
    CSV_FIELDS.join(','),
    ...rows.map((row) => rowToCsv(CSV_FIELDS, row)),
  ];
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf8');

  console.log('---');
  console.log(`Done. ${rows.length} rows written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
