import { checkLocalPatterns } from './local-patterns';
import { checkGoogleWebRisk } from './web-risk';
import { classifyWithAI } from './ai-classifier';

/**
 * Three-layer URL safety check orchestrator.
 *
 * Runs layers sequentially from cheapest/fastest to most expensive,
 * short-circuiting on the first BLOCK verdict:
 *
 * 1. Local pattern matching (0ms, free) — TLDs, keywords, admin blacklist
 * 2. Google Web Risk API (~100ms, free) — malware, phishing
 * 3. Claude Haiku classifier (~1s, ~$0.003) — content categorization
 */

export type SafetyVerdict = 'allowed' | 'blocked' | 'flagged_for_review';

export interface SafetyCheckResult {
  verdict: SafetyVerdict;
  reason?: string;
  category?: string;
  details?: string;
  layer: 'local' | 'web_risk' | 'ai_classifier';
  latencyMs: number;
}

export async function checkUrlSafety(url: string): Promise<SafetyCheckResult> {
  const totalStart = Date.now();

  // Layer 1: Local pattern matching (instant, free)
  const localResult = await checkLocalPatterns(url);
  if (localResult.verdict === 'blocked') {
    console.log(`[Safety] URL blocked by local patterns: ${url} (${localResult.reason})`);
    return localResult;
  }

  // Layer 2: Google Web Risk API (~100ms, free tier)
  try {
    const webRiskResult = await checkGoogleWebRisk(url);
    if (webRiskResult.isThreat) {
      const result: SafetyCheckResult = {
        verdict: 'blocked',
        reason: 'google_web_risk_threat',
        category: 'malware_phishing',
        details: `Google Web Risk threat: ${webRiskResult.threatTypes.join(', ')}`,
        layer: 'web_risk',
        latencyMs: Date.now() - totalStart,
      };
      console.log(`[Safety] URL blocked by Web Risk: ${url} (${result.details})`);
      return result;
    }
  } catch (err) {
    // Web Risk failure is non-fatal — continue to next layer
    console.error('[Safety] Web Risk check failed, continuing:', err);
  }

  // Layer 3: Claude Haiku AI classifier (~1s, ~$0.003)
  try {
    const aiResult = await classifyWithAI(url);

    if (aiResult.verdict !== 'allowed') {
      const result: SafetyCheckResult = {
        verdict: aiResult.verdict,
        reason: aiResult.verdict === 'blocked' ? 'ai_classified_harmful' : 'ai_classified_borderline',
        category: aiResult.category,
        details: aiResult.reasoning,
        layer: 'ai_classifier',
        latencyMs: Date.now() - totalStart,
      };
      console.log(`[Safety] URL ${aiResult.verdict} by AI classifier: ${url} (${aiResult.category})`);
      return result;
    }

    // AI classifier ran and allowed
    return {
      verdict: 'allowed',
      layer: 'ai_classifier',
      latencyMs: Date.now() - totalStart,
    };
  } catch (err) {
    // AI classifier failure is non-fatal — allow through but do not attribute to AI layer
    console.error('[Safety] AI classifier failed, allowing through:', err);
    return {
      verdict: 'allowed',
      layer: 'web_risk',
      reason: 'ai_classifier_skipped',
      details: err instanceof Error ? err.message : 'AI classifier error',
      latencyMs: Date.now() - totalStart,
    };
  }
}

/**
 * Returns a user-facing error message for a safety block.
 * Intentionally generic to avoid revealing detection methods.
 */
export function getSafetyErrorMessage(reason?: string): string {
  if (reason === 'google_web_risk_threat') {
    return "This website has been flagged as potentially harmful and can't be analyzed.";
  }
  if (reason === 'ai_classified_borderline') {
    return 'Your analysis is being processed and will be reviewed shortly.';
  }
  // Default for all other blocks — intentionally vague
  return "This website can't be analyzed. The grader is designed for B2B SaaS websites.";
}
