const config = require('./config');
const { requestJson } = require('./http');

const BASE = 'https://api.pipedrive.com';

function apiUrl(path) {
  return `${BASE}${path}?api_token=${config.pipedrive.apiToken}`;
}

async function searchOrganizationByName(name) {
  const url = `${BASE}/v1/organizations/search?term=${encodeURIComponent(name)}&fields=name&exact_match=true&limit=1&api_token=${config.pipedrive.apiToken}`;
  const { data } = await requestJson('GET', url);
  const items = data?.data?.items || [];
  return items.length > 0 ? items[0].item.id : null;
}

async function createOrganization(fields) {
  const { data } = await requestJson('POST', apiUrl('/v1/organizations'), fields);
  return { id: data.data.id, action: 'created' };
}

async function updateOrganization(orgId, fields) {
  await requestJson('PUT', apiUrl(`/v1/organizations/${orgId}`), fields);
  return { id: orgId, action: 'updated' };
}

async function addNote(orgId, content) {
  await requestJson('POST', apiUrl('/v1/notes'), { org_id: orgId, content });
}

async function saveOrganization(fields, noteContent) {
  let result;

  if (config.pipedrive.upsertByName && fields.name) {
    const existingId = await searchOrganizationByName(fields.name);
    if (existingId) {
      result = await updateOrganization(existingId, fields);
    } else {
      result = await createOrganization(fields);
    }
  } else {
    result = await createOrganization(fields);
  }

  if (config.pipedrive.addNote && noteContent) {
    try {
      await addNote(result.id, noteContent);
    } catch (err) {
      console.error(`Warning: note creation failed for org ${result.id}: ${err.message}`);
    }
  }

  return result;
}

module.exports = { saveOrganization };
