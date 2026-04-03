require('dotenv').config({ path: '../.env' });

const https = require('https');

const API_KEY = process.env.BUILTWITH_API_KEY;
const KEYWORD = process.env.KEYWORD || 'perfume';
const MIN_SPEND = parseInt(process.env.MIN_SPEND || '1000', 10);
const MAX_RESULTS = parseInt(process.env.MAX_RESULTS || '20', 10);
const ENRICH_DELAY = parseFloat(process.env.ENRICH_DELAY || '0.5') * 1000;

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

// --- Helpers ---

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

function collectTechNames(result, maxTechs = 10) {
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

function fmtSpend(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

// --- Keyword Search API ---

async function fetchKeywordSites(keyword, maxResults) {
  const entries = [];
  let offset = '';

  while (entries.length < maxResults) {
    const params = new URLSearchParams({ KEY: API_KEY, KEYWORD: keyword });
    const limit = Math.min(maxResults - entries.length, 100);
    params.set('LIMIT', String(limit));
    if (offset) params.set('OFFSET', offset);

    const data = await httpGet(`https://api.builtwith.com/kws1/api.json?${params}`);

    for (const entry of data.Results || []) {
      if (entries.length >= maxResults) break;
      entries.push(entry);
    }

    const nextOffset = data.NextOffset;
    if (!nextOffset || nextOffset === 'END' || entries.length >= maxResults) break;
    offset = nextOffset;
  }

  return entries;
}

// --- Domain API ---

async function enrichDomain(domain) {
  const params = new URLSearchParams({ KEY: API_KEY, LOOKUP: domain, LIVEONLY: 'y' });
  const data = await httpGet(`https://api.builtwith.com/v22/api.json?${params}`);
  const results = data.Results || [];
  return results[0] || null;
}

// --- Main ---

async function main() {
  console.log('BuiltWith Keyword Search → Live High-Spend Sites');
  console.log(`Keyword:     ${KEYWORD}`);
  console.log(`Min spend:   ${fmtSpend(MIN_SPEND)}/mo`);
  console.log(`Max results: ${MAX_RESULTS}`);
  console.log('---');

  console.log(`Step 1: Searching for "${KEYWORD}"...`);
  const entries = await fetchKeywordSites(KEYWORD, MAX_RESULTS);
  console.log(`  Found ${entries.length} sites`);

  if (entries.length === 0) {
    console.log('No sites found for this keyword.');
    return;
  }

  console.log('Step 2: Enriching with Domain API (live only)...');
  const matches = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const domain = entry.D || entry.domain || String(entry);
    process.stdout.write(`  [${i + 1}/${entries.length}] ${domain} ... `);

    let profile = null;
    try {
      profile = await enrichDomain(domain);
    } catch (err) {
      console.log(`failed (${err.message})`);
      if (ENRICH_DELAY > 0 && i < entries.length - 1) await sleep(ENRICH_DELAY);
      continue;
    }

    const spend = profile?.Result?.Spend ?? 0;
    if (spend >= MIN_SPEND) {
      console.log(`${fmtSpend(spend)}/mo ✓`);
      matches.push({ domain, profile, spend });
    } else {
      console.log(`${fmtSpend(spend)}/mo (below threshold, skipped)`);
    }

    if (ENRICH_DELAY > 0 && i < entries.length - 1) await sleep(ENRICH_DELAY);
  }

  console.log('---');
  console.log(`Found ${matches.length} live site${matches.length !== 1 ? 's' : ''} with spend >= ${fmtSpend(MIN_SPEND)}:\n`);

  for (const { domain, profile, spend } of matches) {
    const meta = profile?.Meta || {};
    const result = profile?.Result || {};
    const company = meta.CompanyName || '';
    const techs = collectTechNames(result);

    console.log(`  ${domain}`);
    if (company) console.log(`    Company: ${company}`);
    console.log(`    Spend:   ${fmtSpend(spend)}/mo`);
    if (techs.length > 0) console.log(`    Techs:   ${techs.join(' | ')}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
