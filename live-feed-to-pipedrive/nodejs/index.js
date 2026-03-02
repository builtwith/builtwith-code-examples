const config = require('./config');
const { connect } = require('./websocket');
const { getDomainProfile } = require('./domain-api');
const { mapToOrganization } = require('./mapper');
const { saveOrganization } = require('./pipedrive');

console.log('BuiltWith Live Feed -> Pipedrive');
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
    const { fields, noteContent } = mapToOrganization(data, profile);
    const result = await saveOrganization(fields, noteContent);
    console.log(`Pipedrive organization ${result.action}: ${result.id} (${domain})`);
  } catch (err) {
    console.error(`Failed to process ${domain}:`, err.message);
  }
});
