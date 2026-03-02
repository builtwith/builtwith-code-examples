/**
 * BuiltWith Bulk Domain Enrichment
 *
 * Reads a CSV of domains, enriches each one with the Free API (quick, low-cost)
 * or the full Domain API, and writes an enriched CSV with bw_* columns appended.
 */

require('dotenv').config({ path: '../.env' });

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.BUILTWITH_API_KEY;
const INPUT_FILE = process.env.INPUT_FILE || '';
const DOMAIN_COLUMN = process.env.DOMAIN_COLUMN || 'domain';
const API_MODE = (process.env.API_MODE || 'free').toLowerCase();
const LIVEONLY = (process.env.LIVEONLY || 'true').toLowerCase() !== 'false';
const ENRICH_DELAY = parseFloat(process.env.ENRICH_DELAY || '0.5') * 1000;

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

if (!INPUT_FILE) {
  console.error('Error: Set INPUT_FILE to the path of your input CSV.');
  process.exit(1);
}

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`Error: INPUT_FILE not found: ${INPUT_FILE}`);
  process.exit(1);
}

if (API_MODE !== 'free' && API_MODE !== 'full') {
  console.error("Error: API_MODE must be 'free' or 'full'.");
  process.exit(1);
}

const ext = path.extname(INPUT_FILE) || '.csv';
const base = INPUT_FILE.slice(0, INPUT_FILE.length - ext.length);
const OUTPUT_FILE = process.env.OUTPUT_FILE || `${base}-enriched${ext}`;

const FREE_COLUMNS = ['bw_tech_live', 'bw_tech_dead', 'bw_groups', 'bw_first_seen', 'bw_last_seen'];
const FULL_COLUMNS = [
  'bw_company', 'bw_vertical', 'bw_country', 'bw_email', 'bw_phone',
  'bw_spend', 'bw_technologies', 'bw_tech_categories', 'bw_mj_rank',
  'bw_first_seen', 'bw_last_seen',
];
const ENRICH_COLUMNS = API_MODE === 'free' ? FREE_COLUMNS : FULL_COLUMNS;

// --- CSV helpers ---

function parseCsv(text) {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) return { fields: [], rows: [] };

  const fields = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    fields.forEach((f, i) => { row[f] = values[i] ?? ''; });
    return row;
  });
  return { fields, rows };
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvLine(fields, row) {
  return fields.map((f) => csvEscape(row[f] ?? '')).join(',');
}

// --- HTTP helper ---

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
        try { resolve(JSON.parse(data)); }
        catch (err) { reject(new Error('Failed to parse response: ' + err.message)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtEpoch(ms) {
  if (!ms) return '';
  try { return new Date(Number(ms)).toISOString().split('T')[0]; }
  catch { return ''; }
}

// --- Free API enrichment ---

async function enrichFree(domain) {
  const params = new URLSearchParams({ KEY: API_KEY, LOOKUP: domain });
  const data = await httpGet(`https://api.builtwith.com/free1/api.json?${params}`);

  const groups = data.groups || data.Groups || [];
  const totalLive = groups.reduce((s, g) => s + (g.live ?? g.Live ?? 0), 0);
  const totalDead = groups.reduce((s, g) => s + (g.dead ?? g.Dead ?? 0), 0);

  const groupParts = groups
    .map((g) => ({ name: g.name || g.Name || '', live: g.live ?? g.Live ?? 0 }))
    .filter((g) => g.name && g.live > 0)
    .map((g) => `${g.name}:${g.live}`);

  return {
    bw_tech_live: totalLive,
    bw_tech_dead: totalDead,
    bw_groups: groupParts.join(' | '),
    bw_first_seen: fmtEpoch(data.first || data.First),
    bw_last_seen: fmtEpoch(data.last || data.Last),
  };
}

// --- Domain API enrichment ---

function collectTechNames(result, max = 25) {
  const seen = new Set();
  const names = [];
  for (const p of result.Paths || []) {
    for (const t of p.Technologies || []) {
      if (t.Name && !seen.has(t.Name)) {
        seen.add(t.Name);
        names.push(t.Name);
        if (names.length >= max) return names;
      }
    }
  }
  return names;
}

function collectTechCategories(result) {
  const seen = new Set();
  const cats = [];
  for (const p of result.Paths || []) {
    for (const t of p.Technologies || []) {
      if (t.Tag && !seen.has(t.Tag)) { seen.add(t.Tag); cats.push(t.Tag); }
    }
  }
  return cats;
}

async function enrichFull(domain) {
  const params = new URLSearchParams({ KEY: API_KEY, LOOKUP: domain });
  if (LIVEONLY) params.append('LIVEONLY', 'y');

  const data = await httpGet(`https://api.builtwith.com/v22/api.json?${params}`);
  const results = data.Results || [];
  if (results.length === 0) return Object.fromEntries(FULL_COLUMNS.map((c) => [c, '']));

  const profile = results[0];
  const result = profile.Result || {};
  const meta = profile.Meta || {};
  const attrs = profile.Attributes || {};

  return {
    bw_company: meta.CompanyName || '',
    bw_vertical: meta.Vertical || '',
    bw_country: meta.Country || '',
    bw_email: (meta.Emails || [])[0] || '',
    bw_phone: (meta.Telephones || [])[0] || '',
    bw_spend: profile.SalesRevenue ?? result.Spend ?? '',
    bw_technologies: collectTechNames(result).join(' | '),
    bw_tech_categories: collectTechCategories(result).join(' | '),
    bw_mj_rank: attrs.MJRank != null ? String(attrs.MJRank) : '',
    bw_first_seen: fmtEpoch(profile.FirstIndexed),
    bw_last_seen: fmtEpoch(profile.LastIndexed),
  };
}

async function enrich(domain) {
  return API_MODE === 'free' ? enrichFree(domain) : enrichFull(domain);
}

// --- Main ---

async function main() {
  console.log('BuiltWith Bulk Domain Enrichment');
  console.log(`Input file:    ${INPUT_FILE}`);
  console.log(`Output file:   ${OUTPUT_FILE}`);
  console.log(`API mode:      ${API_MODE}`);
  console.log(`Domain column: ${DOMAIN_COLUMN}`);
  console.log('---');

  const text = fs.readFileSync(INPUT_FILE, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { fields: originalFields, rows } = parseCsv(text);

  if (!originalFields.includes(DOMAIN_COLUMN)) {
    console.error(`Error: column '${DOMAIN_COLUMN}' not found in ${INPUT_FILE}.`);
    console.error(`Available columns: ${originalFields.join(', ')}`);
    process.exit(1);
  }

  const outputFields = [...originalFields, ...ENRICH_COLUMNS.filter((c) => !originalFields.includes(c))];
  const emptyEnrich = Object.fromEntries(ENRICH_COLUMNS.map((c) => [c, '']));

  console.log(`Rows to enrich: ${rows.length}`);
  console.log('Enriching...');

  const enrichedRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const domain = (row[DOMAIN_COLUMN] || '').trim();

    if (!domain) {
      console.log(`  [${i + 1}/${rows.length}] skipped (empty domain)`);
      enrichedRows.push({ ...row, ...emptyEnrich });
      continue;
    }

    console.log(`  [${i + 1}/${rows.length}] ${domain}`);
    let extra = { ...emptyEnrich };
    try {
      extra = await enrich(domain);
    } catch (err) {
      console.log(`    Warning: enrichment failed — ${err.message}`);
    }

    enrichedRows.push({ ...row, ...extra });

    if (ENRICH_DELAY > 0 && i < rows.length - 1) {
      await sleep(ENRICH_DELAY);
    }
  }

  console.log(`Writing ${OUTPUT_FILE}...`);
  const lines = [
    outputFields.join(','),
    ...enrichedRows.map((row) => toCsvLine(outputFields, row)),
  ];
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf8');

  console.log('---');
  console.log(`Done. ${enrichedRows.length} rows written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
