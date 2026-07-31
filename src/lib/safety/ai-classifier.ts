import Anthropic from '@anthropic-ai/sdk';
import type { SafetyVerdict } from './url-categorizer';

/**
 * Layer 3: Claude Haiku AI classifier
 *
 * Classifies a URL's domain name into content categories.
 * Uses Claude Haiku for speed and low cost (~$0.003/call).
 *
 * Categories:
 * - safe → allowed
 * - adult, illegal, csam, hate, violence → blocked
 * - gambling, piracy → flagged_for_review
 */

// Lazy singleton — avoids a module-load crash when ANTHROPIC_API_KEY is absent.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

type ContentCategory = 'safe' | 'adult' | 'illegal' | 'csam' | 'hate' | 'gambling' | 'violence' | 'piracy';

interface ClassificationResult {
  verdict: SafetyVerdict;
  category: ContentCategory;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// Map categories to verdicts
const CATEGORY_VERDICTS: Record<ContentCategory, SafetyVerdict> = {
  safe: 'allowed',
  adult: 'blocked',
  illegal: 'blocked',
  csam: 'blocked',
  hate: 'blocked',
  violence: 'blocked',
  gambling: 'flagged_for_review',
  piracy: 'flagged_for_review',
};

const CLASSIFICATION_PROMPT = `You are a URL content safety classifier. Given a URL, classify what type of content the website likely contains based on its domain name, subdomain, and URL path.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "category": "safe" | "adult" | "illegal" | "csam" | "hate" | "gambling" | "violence" | "piracy",
  "confidence": "high" | "medium" | "low",
  "reasoning": "One sentence explanation"
}

Classification rules:
- "safe": Legitimate businesses, SaaS companies, news, education, technology, etc.
- "adult": Pornography, explicit content, escort services, adult entertainment
- "illegal": Drug markets, weapons trafficking, counterfeit goods, darknet markets
- "csam": Any hint of child exploitation content (zero tolerance)
- "hate": White supremacy, neo-nazi, extremist propaganda
- "gambling": Online casinos, sports betting, poker sites
- "violence": Gore, graphic violence, snuff content
- "piracy": Torrent sites, illegal streaming, cracked software

Important:
- Classify based on the PRIMARY purpose of the domain, not edge cases
- If a domain is clearly a legitimate B2B SaaS company, classify as "safe" even if the name is ambiguous
- When uncertain, prefer "safe" with low confidence over false positives
- Never classify major tech companies, SaaS platforms, or known businesses as anything other than "safe"`;

export async function classifyWithAI(url: string): Promise<ClassificationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { verdict: 'allowed', category: 'safe', confidence: 'low', reasoning: 'Could not parse URL' };
  }

  // No key configured (e.g. demo mode) — skip the AI layer; local + Web Risk still ran.
  const anthropic = getAnthropic();
  if (!anthropic) {
    return { verdict: 'allowed', category: 'safe', confidence: 'low', reasoning: 'AI classifier not configured' };
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Classify this URL: ${parsed.hostname}${parsed.pathname}`,
      },
    ],
    system: CLASSIFICATION_PROMPT,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return { verdict: 'allowed', category: 'safe', confidence: 'low', reasoning: 'Unexpected AI response format' };
  }

  try {
    const result = JSON.parse(content.text) as {
      category: ContentCategory;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    };

    // Validate category
    if (!CATEGORY_VERDICTS[result.category]) {
      return { verdict: 'allowed', category: 'safe', confidence: 'low', reasoning: 'Unknown category from AI' };
    }

    let verdict = CATEGORY_VERDICTS[result.category];

    // Low confidence on borderline categories → flag for review instead of block
    if (verdict === 'blocked' && result.confidence === 'low') {
      verdict = 'flagged_for_review';
    }

    return {
      verdict,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch {
    // JSON parse failure — allow through
    console.error('[Safety] AI classifier returned invalid JSON:', content.text);
    return { verdict: 'allowed', category: 'safe', confidence: 'low', reasoning: 'AI response parse error' };
  }
}
