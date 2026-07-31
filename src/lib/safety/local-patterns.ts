import type { SafetyCheckResult } from './url-categorizer';

/**
 * Layer 1: Local pattern matching (0ms, free)
 *
 * Checks URL against:
 * 1. Blocked TLDs (.xxx, .porn, .casino, etc.)
 * 2. Harmful keyword patterns in URL hostname/path
 */

// TLDs associated with adult, gambling, or explicitly harmful content
const BLOCKED_TLDS = new Set([
  '.xxx',
  '.adult',
  '.porn',
  '.sex',
  '.sexy',
  '.casino',
  '.bet',
  '.poker',
  '.webcam',
]);

// Patterns that indicate harmful content in URL hostname or path
const HARMFUL_URL_PATTERNS: { pattern: RegExp; category: string }[] = [
  // Adult content — major known domains
  { pattern: /\b(pornhub|xvideos|xhamster|redtube|youporn|xnxx|brazzers|onlyfans)\b/i, category: 'adult' },
  { pattern: /\b(chaturbate|livejasmin|stripchat|cam4|bongacams)\b/i, category: 'adult' },
  // Adult content — generic patterns
  { pattern: /\b(porn|hentai|xxx|nsfw)\b/i, category: 'adult' },

  // Illegal marketplaces / darkweb
  { pattern: /\b(darkweb|darknet|silkroad|tor-market|dark-market)\b/i, category: 'illegal' },
  { pattern: /\b(buy-drugs|drug-market|fake-id|counterfeit)\b/i, category: 'illegal' },

  // CSAM — zero tolerance
  { pattern: /\b(csam|child-abuse|cp-links|pedo)\b/i, category: 'csam' },

  // Hate speech / extremism
  { pattern: /\b(stormfront|dailystormer|8chan|8kun)\b/i, category: 'hate' },

  // Violence / gore
  { pattern: /\b(bestgore|liveleak-gore|death-video)\b/i, category: 'violence' },

  // Weapons / illegal sales
  { pattern: /\b(buy-guns-online|illegal-weapons|ghost-guns)\b/i, category: 'illegal' },
];

export async function checkLocalPatterns(url: string): Promise<SafetyCheckResult> {
  const start = Date.now();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      verdict: 'blocked',
      reason: 'invalid_url',
      category: 'invalid',
      details: 'Could not parse URL',
      layer: 'local',
      latencyMs: Date.now() - start,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const fullUrl = url.toLowerCase();

  // Check 1: Blocked TLDs
  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      return {
        verdict: 'blocked',
        reason: 'blocked_tld',
        category: 'adult',
        details: `Blocked TLD: ${tld}`,
        layer: 'local',
        latencyMs: Date.now() - start,
      };
    }
  }

  // Check 2: Harmful URL keyword patterns
  for (const { pattern, category } of HARMFUL_URL_PATTERNS) {
    if (pattern.test(hostname) || pattern.test(fullUrl)) {
      return {
        verdict: 'blocked',
        reason: 'harmful_keyword_pattern',
        category,
        details: `Matched harmful pattern: ${pattern.source}`,
        layer: 'local',
        latencyMs: Date.now() - start,
      };
    }
  }

  // All local checks passed
  return {
    verdict: 'allowed',
    layer: 'local',
    latencyMs: Date.now() - start,
  };
}
