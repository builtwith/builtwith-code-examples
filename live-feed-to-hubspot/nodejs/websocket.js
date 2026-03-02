const WebSocket = require('ws');
const config = require('./config');

function connect(onMessage) {
  console.log('Connecting to BuiltWith Live Feed...');
  const ws = new WebSocket(config.websocketUrl);

  ws.on('open', () => {
    console.log('Connected to BuiltWith Live Feed.');
    for (const channel of config.channels) {
      ws.send(JSON.stringify({ action: 'subscribe', channel }));
      console.log(`Subscribed to channel: ${channel}`);
    }
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      onMessage(data);
    } catch {
      console.error('Failed to parse message:', raw.toString());
    }
  });

  ws.on('close', (code) => {
    console.log(`WebSocket closed (code=${code}). Reconnecting in ${config.reconnectDelay / 1000}s...`);
    setTimeout(() => connect(onMessage), config.reconnectDelay);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  return ws;
}

module.exports = { connect };
