/**
 * Layer 2: Google Web Risk API
 *
 * Checks URLs against Google's threat database for malware,
 * phishing, and social engineering.
 *
 * Free tier: 100k Lookup API calls/month.
 * Graceful skip if GOOGLE_WEB_RISK_API_KEY is not configured.
 */

const WEB_RISK_API_KEY = process.env.GOOGLE_WEB_RISK_API_KEY;
const WEB_RISK_ENDPOINT = 'https://webrisk.googleapis.com/v1/uris:search';

export interface WebRiskResult {
  isThreat: boolean;
  threatTypes: string[];
}

export async function checkGoogleWebRisk(url: string): Promise<WebRiskResult> {
  // Graceful skip if API key not configured
  if (!WEB_RISK_API_KEY) {
    return { isThreat: false, threatTypes: [] };
  }

  const params = new URLSearchParams({
    key: WEB_RISK_API_KEY,
    uri: url,
    threatTypes: 'MALWARE',
  });
  // Web Risk API accepts multiple threatTypes params
  params.append('threatTypes', 'SOCIAL_ENGINEERING');
  params.append('threatTypes', 'UNWANTED_SOFTWARE');

  const response = await fetch(`${WEB_RISK_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000), // 5s timeout
  });

  if (!response.ok) {
    console.error(`[Safety] Web Risk API error: ${response.status} ${response.statusText}`);
    // Non-fatal — return safe on API error
    return { isThreat: false, threatTypes: [] };
  }

  const data = await response.json();

  // If the response has a "threat" field, the URL is flagged
  if (data.threat) {
    const threatTypes = Array.isArray(data.threat.threatTypes)
      ? data.threat.threatTypes
      : [data.threat.threatTypes].filter(Boolean);
    return { isThreat: true, threatTypes };
  }

  return { isThreat: false, threatTypes: [] };
}
