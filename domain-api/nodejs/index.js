require('dotenv').config({ path: '../.env' });

const https = require('https');

const apiKey = process.env.BUILTWITH_API_KEY;
const lookup = process.env.LOOKUP || 'builtwith.com';

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const params = new URLSearchParams({ KEY: apiKey, LOOKUP: lookup });

// Optional filters
if (process.env.LIVEONLY === 'true') params.append('LIVEONLY', 'y');
if (process.env.NOPII === 'true') params.append('NOPII', 'y');
if (process.env.NOMETA === 'true') params.append('NOMETA', 'y');
if (process.env.NOATTR === 'true') params.append('NOATTR', 'y');

const url = `https://api.builtwith.com/v23/api.json?${params.toString()}`;

console.log('BuiltWith Domain API');
console.log(`Looking up: ${lookup}`);
console.log('---');

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`HTTP ${res.statusCode}: ${data}`);
      process.exit(1);
    }

    try {
      const result = JSON.parse(data);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Failed to parse response:', err.message);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});
