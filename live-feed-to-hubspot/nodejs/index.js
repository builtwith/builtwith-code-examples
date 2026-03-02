const config = require('./config');
const { connect } = require('./websocket');
const { getDomainProfile } = require('./domain-api');
const { mapToContact } = require('./mapper');
const { saveContact } = require('./hubspot');

console.log('BuiltWith Live Feed -> HubSpot');
console.log(`Channels: ${config.channels.join(', ')}`);
console.log('---');

connect(async (data) => {
  if (data.action || data.status) {
    console.log('Control message:', JSON.stringify(data));
    return;
  }

  const domain = data.D || data.domain || null;
  if (!domain) {
    console.log('Non-domain message:', JSON.stringify(data));
    return;
  }

  console.log(`Domain: ${domain}`);

  try {
    const profile = await getDomainProfile(domain);
    const properties = mapToContact(data, profile);
    const result = await saveContact(properties);
    console.log(`HubSpot contact ${result.action}: ${result.id} (${domain})`);
  } catch (err) {
    console.error(`Failed to process ${domain}:`, err.message);
  }
});
