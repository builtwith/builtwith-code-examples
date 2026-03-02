const config = require('./config');
const { requestJson } = require('./http');

function buildDomainApiUrl(domain) {
  const params = new URLSearchParams({ KEY: config.apiKey, LOOKUP: domain });
  if (config.domainApiOptions.liveOnly) params.append('LIVEONLY', 'y');
  if (config.domainApiOptions.noPii) params.append('NOPII', 'y');
  if (config.domainApiOptions.noMeta) params.append('NOMETA', 'y');
  if (config.domainApiOptions.noAttr) params.append('NOATTR', 'y');
  return `https://api.builtwith.com/v22/api.json?${params.toString()}`;
}

async function getDomainProfile(domain) {
  const { data } = await requestJson('GET', buildDomainApiUrl(domain));
  if (!data || !Array.isArray(data.Results) || data.Results.length === 0) {
    throw new Error(`No Results returned for domain: ${domain}`);
  }
  return data.Results[0];
}

module.exports = { getDomainProfile };
