const config = require('./config');

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

function mapToContact(liveFeedMessage, profile) {
  const domain = liveFeedMessage.D || liveFeedMessage.domain || profile.Lookup || 'unknown';
  const channel = liveFeedMessage.C || liveFeedMessage.channel || '';
  const result = profile.Result || {};
  const meta = profile.Meta || {};

  const company = meta.CompanyName || domain;
  const email = pickFirst(meta.Emails);
  const phone = pickFirst(meta.Telephones);
  const techNames = collectTechnologyNames(result);
  const firstIndexed = formatDate(profile.FirstIndexed);
  const lastIndexed = formatDate(profile.LastIndexed);

  const description = [
    `BuiltWith Live Feed channel: ${channel || '(unknown)'}`,
    `Lookup domain: ${domain}`,
    `Vertical: ${meta.Vertical || 'unknown'}`,
    `Spend estimate: ${profile.SalesRevenue ?? result.Spend ?? 0}`,
    `FirstIndexed: ${firstIndexed || 'n/a'}, LastIndexed: ${lastIndexed || 'n/a'}`,
    `Top technologies: ${techNames.length > 0 ? techNames.join(', ') : '(none)'}`,
  ].join('\n');

  const properties = {
    lastname: company,
    firstname: 'Unknown',
    company,
    website: `https://${domain}`,
    description,
    hs_lead_status: 'NEW',
    lifecyclestage: 'lead',
    lead_source: config.hubspot.leadSource,
  };

  if (email) properties.email = email;
  if (phone) properties.phone = phone;
  if (meta.Vertical) properties.industry = meta.Vertical;
  if (meta.City) properties.city = meta.City;
  if (meta.State) properties.state = meta.State;
  if (meta.Country) properties.country = meta.Country;

  return properties;
}

module.exports = { mapToContact };
