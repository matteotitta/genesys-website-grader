import Anthropic from '@anthropic-ai/sdk';

// Custom error class for user-friendly messages
export class AnalysisError extends Error {
  constructor(
    message: string,
    public userFriendlyMessage: string,
    public code: 'RATE_LIMIT' | 'API_ERROR' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

// Lazy singleton — constructed on first use, not at import time, so a missing
// key doesn't crash the route on module load (only when scoring is attempted).
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnalysisError(
      'ANTHROPIC_API_KEY is not configured',
      'Scoring is not configured. Set ANTHROPIC_API_KEY, or run in demo mode.',
      'API_ERROR'
    );
  }
  if (!_anthropic) _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

// Track which provider was used for the analysis
export type AIProvider = 'anthropic' | 'grok';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface AnalysisResult {
  text: string;
  provider: AIProvider;
  usage: TokenUsage;
}

interface AnthropicResult {
  text: string;
  usage: TokenUsage;
}

async function analyzeWithAnthropic(
  systemPrompt: string,
  userContent: string
): Promise<AnthropicResult> {
  console.log('[AI] Analyzing with Anthropic Claude Sonnet...');
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };
    console.log(`[AI] Anthropic success - tokens: ${usage.totalTokens} (in: ${usage.inputTokens}, out: ${usage.outputTokens})`);
    return { text: content.text, usage };
  }
  throw new Error('Unexpected response format from Anthropic');
}

interface GrokResult {
  text: string;
  usage: TokenUsage;
}

async function analyzeWithGrok(
  systemPrompt: string,
  userContent: string
): Promise<GrokResult> {
  console.log('[AI] Falling back to Grok...');

  const grokApiKey = process.env.XAI_API_KEY;
  if (!grokApiKey) {
    throw new Error('Grok API key not configured');
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${grokApiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-beta',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Unexpected response format from Grok');
  }

  // Grok API returns usage in OpenAI format
  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  };
  console.log(`[AI] Grok success - tokens: ${usage.totalTokens} (in: ${usage.inputTokens}, out: ${usage.outputTokens})`);
  return { text, usage };
}

function isAnthropicCreditError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes('credit') ||
    errorMessage.includes('billing') ||
    errorMessage.includes('insufficient') ||
    errorMessage.includes('payment') ||
    errorMessage.includes('quota')
  );
}

export async function analyzeWithClaude(
  systemPrompt: string,
  userContent: string
): Promise<AnalysisResult> {
  // Try Anthropic first
  try {
    const result = await analyzeWithAnthropic(systemPrompt, userContent);
    return { text: result.text, provider: 'anthropic', usage: result.usage };
  } catch (anthropicError) {
    const errorMessage = anthropicError instanceof Error ? anthropicError.message : String(anthropicError);
    console.error('[AI] Anthropic error:', errorMessage);

    // If it's a credit/billing error, try Grok as fallback
    if (isAnthropicCreditError(anthropicError)) {
      console.log('[AI] Anthropic credits exhausted, trying Grok fallback...');

      try {
        const result = await analyzeWithGrok(systemPrompt, userContent);
        return { text: result.text, provider: 'grok', usage: result.usage };
      } catch (grokError) {
        const grokErrorMessage = grokError instanceof Error ? grokError.message : String(grokError);
        console.error('[AI] Grok fallback also failed:', grokErrorMessage);

        throw new AnalysisError(
          `Both providers failed. Anthropic: ${errorMessage}, Grok: ${grokErrorMessage}`,
          "We've run out of API credits on both providers. DM Matteo on LinkedIn and tell him to top up!",
          'RATE_LIMIT'
        );
      }
    }

    // Handle rate limits (not credit issues)
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      throw new AnalysisError(
        errorMessage,
        "Too many requests. Please wait a moment and try again.",
        'RATE_LIMIT'
      );
    }

    // Handle content too large errors
    if (errorMessage.includes('too long') || errorMessage.includes('too large')) {
      throw new AnalysisError(
        errorMessage,
        "This website has too much content to analyze. Try a simpler page or contact Matteo.",
        'API_ERROR'
      );
    }

    // Unknown error - don't fallback, just throw
    throw new AnalysisError(
      errorMessage,
      "Analysis failed. Please try again or contact Matteo.",
      'UNKNOWN'
    );
  }
}
