function pickFirst(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function formatDate(epochMs) {
  if (!epochMs || Number.isNaN(Number(epochMs))) return '';
  return new Date(Number(epochMs)).toISOString().slice(0, 10);
}

function collectTechnologyNames(result) {
  const seen = new Set();
  const names = [];
  for (const path of result.Paths || []) {
    for (const tech of path.Technologies || []) {
      if (!tech?.Name || seen.has(tech.Name)) continue;
      seen.add(tech.Name);
      names.push(tech.Name);
      if (names.length >= 25) return names;
    }
  }
  return names;
}

function mapToOrganization(liveFeedMessage, profile) {
  const domain = liveFeedMessage.D || liveFeedMessage.domain || profile.Lookup || 'unknown';
  const channel = liveFeedMessage.C || liveFeedMessage.channel || '';
  const result = profile.Result || {};
  const meta = profile.Meta || {};

  const name = meta.CompanyName || domain;
  const addressParts = [meta.City, meta.State, meta.Country].filter(Boolean);
  const address = addressParts.join(', ');

  const techNames = collectTechnologyNames(result);
  const firstIndexed = formatDate(profile.FirstIndexed);
  const lastIndexed = formatDate(profile.LastIndexed);

  const noteContent = [
    `<b>BuiltWith Live Feed</b>`,
    `Channel: ${channel || '(unknown)'}`,
    `Domain: <a href="https://${domain}">${domain}</a>`,
    `Vertical: ${meta.Vertical || 'unknown'}`,
    `Spend estimate: ${profile.SalesRevenue ?? result.Spend ?? 0}`,
    `FirstIndexed: ${firstIndexed || 'n/a'}, LastIndexed: ${lastIndexed || 'n/a'}`,
    `Top technologies: ${techNames.length > 0 ? techNames.join(', ') : '(none)'}`,
  ].join('<br>');

  const fields = { name };
  if (address) fields.address = address;

  return { fields, noteContent, domain };
}

module.exports = { mapToOrganization };
