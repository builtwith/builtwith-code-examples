require('dotenv').config({ path: '../.env' });

const https = require('https');

const apiKey = process.env.BUILTWITH_API_KEY;
const tech = process.env.TECH || 'Google-Analytics';
const otherTechs = process.env.OTHERTECHS || 'Meta-Pixel';
const maxDomains = parseInt(process.env.MAX_DOMAINS || '100', 10);

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const baseParams = new URLSearchParams({ KEY: apiKey, TECH: tech, OTHERTECHS: otherTechs });
if (process.env.COUNTRY) baseParams.append('COUNTRY', process.env.COUNTRY);
if (process.env.SINCE) baseParams.append('SINCE', process.env.SINCE);

function fetchJson(url) {
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
  console.log('BuiltWith Lists API - Two Technologies');
  console.log(`Technology: ${tech}`);
  console.log(`Other technologies: ${otherTechs}`);
  console.log('---');

  let offset = '';
  let total = 0;

  while (total < maxDomains) {
    const params = new URLSearchParams(baseParams);
    if (offset) params.set('OFFSET', offset);

    const result = await fetchJson(`https://api.builtwith.com/lists12/api.json?${params}`);
    const domains = result.Results || [];

    for (const entry of domains) {
      if (total >= maxDomains) break;
      console.log(entry.D || entry.Domain || 'unknown');
      total++;
    }

    const nextOffset = result.NextOffset;
    if (!nextOffset || nextOffset === 'END') break;
    offset = nextOffset;
  }

  console.log('---');
  console.log(`Done. Printed ${total} domains.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
