/**
 * BuiltWith Bulk Domain API — async CLI
 *
 * Accepts domains from a file (one per line), the DOMAINS env var, or stdin.
 * Submits a bulk job, polls until complete, and writes JSON results to OUTPUT_FILE.
 * Resume an in-flight job by setting JOB_ID without re-submitting.
 */

require('dotenv').config({ path: '../.env' });

const https = require('https');
const fs = require('fs');
const readline = require('readline');
const { URL } = require('url');

const API_KEY = process.env.BUILTWITH_API_KEY;
const INPUT_FILE = process.env.INPUT_FILE || '';
const DOMAINS_ENV = process.env.DOMAINS || '';
const JOB_ID = process.env.JOB_ID || '';
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'bulk-results.json';
const JOB_ID_FILE = process.env.JOB_ID_FILE || 'bulk-job-id.txt';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000', 10);
const LIVEONLY = (process.env.LIVEONLY || 'false').toLowerCase() === 'true';
const NOMETA = (process.env.NOMETA || 'false').toLowerCase() === 'true';
const NOPII = (process.env.NOPII || 'false').toLowerCase() === 'true';

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const BASE_URL = 'https://api.builtwith.com';

// --- HTTP helpers ---

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body != null ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Domain loading ---

async function loadDomainsFromStdin() {
  return new Promise((resolve) => {
    const lines = [];
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => { if (line.trim()) lines.push(line.trim()); });
    rl.on('close', () => resolve(lines));
  });
}

async function loadDomains() {
  if (INPUT_FILE) {
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`Error: INPUT_FILE not found: ${INPUT_FILE}`);
      process.exit(1);
    }
    return fs.readFileSync(INPUT_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  if (DOMAINS_ENV) {
    return DOMAINS_ENV.split(',').map((d) => d.trim()).filter(Boolean);
  }

  if (!process.stdin.isTTY) {
    return loadDomainsFromStdin();
  }

  console.error('Error: Provide domains via INPUT_FILE, DOMAINS env var, or stdin.');
  process.exit(1);
}

// --- API calls ---

async function submitJob(domains) {
  const options = {};
  if (LIVEONLY) options.liveOnly = true;
  if (NOMETA) options.noMeta = true;
  if (NOPII) options.noPii = true;

  const payload = { lookups: domains };
  if (Object.keys(options).length > 0) payload.options = options;

  const res = await request('POST', `${BASE_URL}/v22/domain/bulk?KEY=${API_KEY}`, payload);
  if (res.status !== 200) {
    console.error(`Submission failed (HTTP ${res.status}):`);
    console.error(JSON.stringify(res.body, null, 2));
    process.exit(1);
  }
  return res.body;
}

async function checkStatus(jobId) {
  const res = await request('GET', `${BASE_URL}/v22/domain/bulk/${jobId}?KEY=${API_KEY}`);
  if (res.status !== 200) throw new Error(`Status check failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  return res.body;
}

async function fetchResults(jobId) {
  const res = await request('GET', `${BASE_URL}/v22/domain/bulk/${jobId}/result?KEY=${API_KEY}`);
  if (res.status !== 200) throw new Error(`Result fetch failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  return res.body;
}

function saveResults(data) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Results written to ${OUTPUT_FILE}`);
}

function saveJobId(jobId) {
  if (JOB_ID_FILE) {
    fs.writeFileSync(JOB_ID_FILE, jobId, 'utf8');
    console.log(`Job ID saved to ${JOB_ID_FILE} (resume with JOB_ID=${jobId})`);
  }
}

async function poll(jobId) {
  console.log(`Polling every ${POLL_INTERVAL / 1000}s...`);
  let pollCount = 0;

  while (true) {
    await sleep(POLL_INTERVAL);
    pollCount++;
    const status = await checkStatus(jobId);
    const current = status.status || 'unknown';
    const progressStr = status.progress != null ? ` (${status.progress}%)` : '';
    console.log(`  [${pollCount}] status: ${current}${progressStr}`);

    if (current === 'complete') return;
    if (current === 'error' || current === 'failed') {
      console.error('Job failed:', JSON.stringify(status, null, 2));
      process.exit(1);
    }
  }
}

// --- Main ---

async function main() {
  console.log('BuiltWith Bulk Domain API');
  console.log('---');

  // Resume path
  if (JOB_ID) {
    console.log(`Resuming job: ${JOB_ID}`);
    await poll(JOB_ID);
    console.log('Fetching results (one-time download)...');
    const results = await fetchResults(JOB_ID);
    saveResults(results);
    return;
  }

  // Submit path
  const domains = await loadDomains();
  console.log(`Domains loaded: ${domains.length}`);

  console.log('Submitting bulk request...');
  const data = await submitJob(domains);

  // Synchronous response (small batch)
  if (!data.job_id) {
    console.log('Received synchronous response.');
    saveResults(data);
    return;
  }

  // Asynchronous response
  const { job_id: jobId } = data;
  console.log(`Job queued: ${jobId}`);
  console.log(`Batch size: ${data.count} domains (sync_max: ${data.sync_max})`);
  saveJobId(jobId);

  await poll(jobId);

  console.log('---');
  console.log('Fetching results (one-time download)...');
  const results = await fetchResults(jobId);
  saveResults(results);
  const count = Array.isArray(results) ? results.length : (results.Results || []).length;
  console.log(`Done. ${count} result(s).`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
