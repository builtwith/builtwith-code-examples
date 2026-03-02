const https = require('https');
const { URL } = require('url');

function requestJson(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload =
      body == null ? null : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    };

    if (payload != null && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    if (payload != null) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const text = data || '';
        let parsedBody = null;
        if (text.length > 0) {
          try {
            parsedBody = JSON.parse(text);
          } catch {
            parsedBody = text;
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: parsedBody });
          return;
        }

        reject(
          new Error(
            `HTTP ${res.statusCode} ${method} ${url}: ${
              typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody)
            }`
          )
        );
      });
    });

    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

module.exports = { requestJson };
