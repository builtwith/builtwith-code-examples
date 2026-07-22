const https = require('https');

const url = 'https://api.builtwith.com/vat1/types.json';

console.log('BuiltWith VAT Types API');
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
