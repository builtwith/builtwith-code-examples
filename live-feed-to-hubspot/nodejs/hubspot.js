const config = require('./config');
const { requestJson } = require('./http');

const BASE = 'https://api.hubapi.com';

function authHeaders() {
  return { Authorization: `Bearer ${config.hubspot.accessToken}` };
}

async function searchContactByWebsite(website) {
  const body = {
    filterGroups: [
      { filters: [{ propertyName: 'website', operator: 'EQ', value: website }] },
    ],
    properties: ['hs_object_id', 'website'],
    limit: 1,
  };
  const { data } = await requestJson('POST', `${BASE}/crm/v3/objects/contacts/search`, body, authHeaders());
  const results = data?.results || [];
  return results.length > 0 ? results[0].id : null;
}

async function createContact(properties) {
  const { data } = await requestJson('POST', `${BASE}/crm/v3/objects/contacts`, { properties }, authHeaders());
  return { id: data.id, action: 'created' };
}

async function updateContact(contactId, properties) {
  await requestJson('PATCH', `${BASE}/crm/v3/objects/contacts/${contactId}`, { properties }, authHeaders());
  return { id: contactId, action: 'updated' };
}

async function saveContact(properties) {
  if (config.hubspot.upsertByWebsite && properties.website) {
    const existingId = await searchContactByWebsite(properties.website);
    if (existingId) return updateContact(existingId, properties);
  }
  return createContact(properties);
}

module.exports = { saveContact };
