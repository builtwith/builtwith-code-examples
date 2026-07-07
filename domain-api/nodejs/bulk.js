require('dotenv').config({ path: '../.env' });

const https = require('https');
const { URL } = require('url');

const apiKey = process.env.BUILTWITH_API_KEY;

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

// Parse comma-separated domain list from env
const domainList = (process.env.BULK_DOMAINS || 'builtwith.com,google.com')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

if (domainList.length === 0) {
  console.error('Error: Set BULK_DOMAINS in your .env file (comma-separated list).');
  process.exit(1);
}

// Build options from env
const options = {
  noMeta: process.env.NOMETA === 'true',
  noPii: process.env.NOPII === 'true',
  hideText: process.env.HIDETEXT === 'true',
  hideDL: process.env.HIDEDL === 'true',
  liveOnly: process.env.LIVEONLY === 'true',
};

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 10000;

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkStatus(jobId) {
  const url = `https://api.builtwith.com/v23/domain/bulk/${jobId}?KEY=${apiKey}`;
  const res = await request('GET', url);

  if (res.status !== 200) {
    throw new Error(`Status check failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  }

  return res.body;
}

async function getResults(jobId) {
  const url = `https://api.builtwith.com/v23/domain/bulk/${jobId}/result?KEY=${apiKey}`;
  const res = await request('GET', url);

  if (res.status !== 200) {
    throw new Error(`Result fetch failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  }

  return res.body;
}

async function main() {
  console.log('BuiltWith Bulk Domain API');
  console.log(`Domains: ${domainList.join(', ')} (${domainList.length} total)`);
  console.log('---');

  // Submit bulk request
  const submitUrl = `https://api.builtwith.com/v23/domain/bulk?KEY=${apiKey}`;
  const payload = { lookups: domainList, options };

  console.log('Submitting bulk request...');
  const res = await request('POST', submitUrl, payload);

  if (res.status !== 200) {
    console.error(`HTTP ${res.status}: ${JSON.stringify(res.body, null, 2)}`);
    process.exit(1);
  }

  const data = res.body;

  // Check if synchronous response (small batch — no job_id)
  if (!data.job_id) {
    console.log('Received synchronous response:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Asynchronous response — poll for completion
  const jobId = data.job_id;
  console.log(`Job queued: ${jobId}`);
  console.log(`Batch size: ${data.count} domains (sync_max: ${data.sync_max})`);
  console.log(`Polling every ${POLL_INTERVAL / 1000}s...`);

  while (true) {
    await sleep(POLL_INTERVAL);

    const status = await checkStatus(jobId);
    console.log(`Status: ${status.status}`);

    if (status.status === 'complete') {
      console.log('---');
      console.log('Fetching results (one-time download)...');
      const results = await getResults(jobId);
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (status.status === 'error' || status.status === 'failed') {
      console.error('Job failed:', JSON.stringify(status, null, 2));
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
