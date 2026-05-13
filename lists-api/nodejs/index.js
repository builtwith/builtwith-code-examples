require('dotenv').config({ path: '../.env' });

const https = require('https');

const apiKey = process.env.BUILTWITH_API_KEY;
const tech = process.env.TECH || 'Shopify';
const otherTechs = process.env.OTHERTECHS || '';
const offset = process.env.OFFSET || '';

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const params = new URLSearchParams({ KEY: apiKey, TECH: tech });
const attributeFilters = [
  'SPEND', 'REVENUE', 'SKU', 'FOLLOWERS', 'EMPLOYEES', 'SITEMAP',
  'PAGERANK', 'BWRANK', 'TRANCO', 'MAJESTIC', 'BWS', 'ECAT',
  'AIM', 'AIO', 'AIR', 'AIV',
];

// Optional filters
if (process.env.META === 'yes') params.append('META', 'yes');
if (process.env.COUNTRY) params.append('COUNTRY', process.env.COUNTRY);
if (otherTechs) params.append('OTHERTECHS', otherTechs);
if (process.env.SINCE) params.append('SINCE', process.env.SINCE);
if (process.env.ALL === 'yes') params.append('ALL', 'yes');
if (offset) params.append('OFFSET', offset);
for (const filterName of attributeFilters) {
  if (process.env[filterName]) params.append(filterName, process.env[filterName]);
}

function fetch(url) {
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

async function main() {
  console.log('BuiltWith Lists API');
  console.log(`Technology: ${tech}`);
  if (otherTechs) console.log(`Other technologies: ${otherTechs}`);
  if (process.env.COUNTRY) console.log(`Country: ${process.env.COUNTRY}`);
  if (process.env.SINCE) console.log(`Since: ${process.env.SINCE}`);
  for (const filterName of attributeFilters) {
    if (process.env[filterName]) console.log(`${filterName}: ${process.env[filterName]}`);
  }
  if (process.env.ALL === 'yes') console.log('Mode: all (including historical)');
  if (process.env.META === 'yes') console.log('Meta data: included');
  console.log('---');

  let currentOffset = offset;
  let page = 1;
  let totalDomains = 0;

  while (true) {
    const pageParams = new URLSearchParams(params);
    if (currentOffset) pageParams.set('OFFSET', currentOffset);

    const url = `https://api.builtwith.com/lists12/api.json?${pageParams.toString()}`;

    console.log(`Fetching page ${page}...`);
    const result = await fetch(url);

    // Display results
    const domains = result.Results || [];
    totalDomains += domains.length;

    for (const entry of domains) {
      const domain = entry.D || entry.Domain || 'unknown';
      console.log(`  ${domain}`);
    }

    console.log(`Page ${page}: ${domains.length} domains`);

    // Check for next page
    const nextOffset = result.NextOffset;
    if (!nextOffset || nextOffset === 'END') {
      console.log('---');
      console.log(`Done. Total domains: ${totalDomains}`);
      break;
    }

    currentOffset = nextOffset;
    page++;
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
