const https = require('https');

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 5 * 60 * 1000;

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.builtwith.com',
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (err) { reject(new Error(`Failed to parse response: ${err.message}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('BuiltWith Agent Device-Code Authorization');
  console.log('---');

  // Step 1: Start the device-code flow
  const start = await postJson('/agent-auth/start', {});
  const { device_code, verification_uri } = start;
  if (!device_code || !verification_uri) {
    console.error('Failed to start authorization:', start);
    process.exit(1);
  }

  console.log(`\nOpen this URL in your browser to authorize access:\n\n  ${verification_uri}\n`);
  console.log('Waiting for approval...');

  // Step 2: Poll every 5 seconds until approved, denied, or timed out
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const token = await postJson('/agent-auth/token', { device_code });

    // Approved: { access_token, token_type, expires_in }
    if (token.access_token) {
      console.log('\nAuthorization approved!');
      console.log(`Access token: ${token.access_token}`);
      console.log('\nUse this token as your BW_API_KEY environment variable or pass it as KEY= on any BuiltWith API endpoint.');
      return;
    }

    // Denied: { error: 'access_denied' }
    if (token.error === 'access_denied') {
      console.error('\nAuthorization was denied.');
      process.exit(1);
    }

    // Pending: { error: 'authorization_pending' } — keep polling
    process.stdout.write('.');
  }

  console.error('\nAuthorization timed out after 5 minutes.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
