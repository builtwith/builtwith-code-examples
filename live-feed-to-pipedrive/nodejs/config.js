require('dotenv').config({ path: '../.env' });

function toBool(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'y' || normalized === 'yes';
}

const apiKey = process.env.BUILTWITH_API_KEY;
const channels = (process.env.BUILTWITH_CHANNELS || 'new')
  .split(',')
  .map((ch) => ch.trim())
  .filter(Boolean);

const pipedriveApiToken = process.env.PIPEDRIVE_API_TOKEN;

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

if (!pipedriveApiToken || pipedriveApiToken === 'your-pipedrive-api-token-here') {
  console.error('Error: Set PIPEDRIVE_API_TOKEN in your .env file.');
  console.error('Find your token at https://app.pipedrive.com/settings/api');
  process.exit(1);
}

module.exports = {
  apiKey,
  channels,
  websocketUrl: `wss://sync.builtwith.com/wss/new?KEY=${apiKey}`,
  reconnectDelay: 5000,
  domainApiOptions: {
    liveOnly: toBool(process.env.DOMAIN_API_LIVEONLY, true),
    noPii: toBool(process.env.DOMAIN_API_NOPII, false),
    noMeta: toBool(process.env.DOMAIN_API_NOMETA, false),
    noAttr: toBool(process.env.DOMAIN_API_NOATTR, true),
  },
  pipedrive: {
    apiToken: pipedriveApiToken,
    upsertByName: toBool(process.env.PIPEDRIVE_UPSERT_BY_NAME, true),
    addNote: toBool(process.env.PIPEDRIVE_ADD_NOTE, true),
  },
};
