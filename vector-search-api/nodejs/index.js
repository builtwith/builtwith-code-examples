require('dotenv').config({ path: '../.env' });

const https = require('https');

const apiKey = process.env.BUILTWITH_API_KEY;
const query = process.env.QUERY || 'react framework';

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

const params = new URLSearchParams({ KEY: apiKey, QUERY: query });
const url = `https://api.builtwith.com/vector/v1/api.json?${params.toString()}`;

console.log('BuiltWith Vector Search API');
console.log(`Searching for: ${query}`);
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
