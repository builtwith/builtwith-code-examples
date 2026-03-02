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

const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN;

if (!apiKey || apiKey === 'your-api-key-here') {
  console.error('Error: Set a valid BUILTWITH_API_KEY in your .env file.');
  console.error('Get your API key at https://api.builtwith.com');
  process.exit(1);
}

if (!hubspotAccessToken || hubspotAccessToken === 'your-hubspot-access-token-here') {
  console.error('Error: Set HUBSPOT_ACCESS_TOKEN in your .env file.');
  console.error('Create a Private App at https://app.hubspot.com/private-apps');
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
  hubspot: {
    accessToken: hubspotAccessToken,
    upsertByWebsite: toBool(process.env.HUBSPOT_UPSERT_BY_WEBSITE, true),
    leadSource: process.env.HUBSPOT_LEAD_SOURCE || 'BuiltWith Live Feed',
  },
};
