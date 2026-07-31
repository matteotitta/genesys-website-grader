import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { fetchWebsite, WebsiteScraperError } from '@/lib/fetcher/website-scraper';
import { fetchWithFirecrawl, isFirecrawlConfigured, FirecrawlError } from '@/lib/fetcher/firecrawl-scraper';
import { analyzeWithClaude, AnalysisError, type AIProvider } from '@/lib/ai/claude';
import { buildDemoScore } from '@/lib/ai/demo-score';
import { getSession } from '@/lib/session';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { checkUrlSafety, getSafetyErrorMessage } from '@/lib/safety/url-categorizer';
import { logSafetyEvent } from '@/lib/safety/audit-log';
import {
  PM_SCORE_SYSTEM_PROMPT,
  buildPMScoreUserPrompt,
} from '@/lib/ai/prompts';
import type { PMScoreResult, StreamEvent, WebsiteContent } from '@/types/analysis';

const AnalyzeRequestSchema = z.object({
  mainUrl: z.string().url().max(2000),
});

/**
 * Generate a URL slug from a website URL
 * e.g. https://www.hockeystack.com/pricing → hockeystack
 *      https://app.linear.app → linear
 */
function generateSlug(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Strip common subdomains
    const stripped = hostname.replace(/^(app|docs|blog|help|support)\./, '');
    // Take the first part before the TLD
    return stripped.split('.')[0].toLowerCase();
  } catch {
    return url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
}

// Creative loading messages for each phase
const FETCHING_MESSAGES = [
  'Scanning the digital landscape...',
  'Decoding your home page...',
  'Reading between the pixels...',
  'Extracting the essence...',
  'Parsing your positioning DNA...',
  'Downloading your brand story...',
  'Capturing the vibe...',
  'Inhaling your value props...',
];

const ANALYZING_MESSAGES = [
  'Ruminating on your messaging...',
  'Contemplating your value props...',
  'Dissecting the copy...',
  'Scrutinizing every headline...',
  'Channeling my inner marketer...',
  'Applying 10 years of pattern matching...',
  'Comparing against 45+ SaaS benchmarks...',
  'Running the Matteo methodology...',
  'Evaluating positioning clarity...',
  'Measuring differentiation signals...',
  'Assessing buyer psychology triggers...',
  'Calculating persuasion potential...',
  'Analyzing cognitive load...',
  'Detecting feature soup...',
  'Hunting for weak CTAs...',
  'Spotting generic platitudes...',
  'Finding the "so what?" gaps...',
  'Checking for jargon overload...',
  'Measuring specificity levels...',
  'Evaluating proof points...',
];

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

function createSSEMessage(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function parseJSONResponse<T>(text: string): T {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonString.trim());
  } catch {
    // Try to find JSON object in the text
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error('Failed to parse JSON response');
  }
}

// Demo mode: no key configured, or explicitly forced. Returns a deterministic
// sample scorecard so the app runs and can be demoed with zero secrets.
const isDemoMode = () =>
  process.env.DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const session = await getSession();

  if (!session?.user?.email) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', data: { error: 'Please sign in with Google to analyze a website' } })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );
  }

  const limit = checkRateLimit(
    rateLimitKey('analyze', session.user.email),
    { windowMs: 60 * 60 * 1000, maxRequests: 5 }
  );
  if (!limit.success) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', data: { error: 'Too many analyses. Please wait before trying again.' } })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Retry-After': String(Math.ceil(limit.resetMs / 1000)),
        },
      }
    );
  }

  try {
    const parseResult = AnalyzeRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return new Response(
        createSSEMessage({
          type: 'error',
          data: { error: 'Please enter a valid URL' },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      );
    }
    const { mainUrl } = parseResult.data;

    // Safety check — validate URL category before spending API credits
    const safetyCheck = await checkUrlSafety(mainUrl);

    if (safetyCheck.verdict === 'blocked') {
      logSafetyEvent({
        url: mainUrl,
        user_email: session.user.email,
        verdict: 'blocked',
        reason: safetyCheck.reason,
        category: safetyCheck.category,
        details: safetyCheck.details,
        layer: safetyCheck.layer,
        latency_ms: safetyCheck.latencyMs,
      });

      return new Response(
        createSSEMessage({
          type: 'error',
          data: { error: getSafetyErrorMessage(safetyCheck.reason) },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      );
    }

    // If flagged for review, analysis proceeds but results won't be public
    const moderationStatus = safetyCheck.verdict === 'flagged_for_review'
      ? 'pending_review'
      : 'approved';

    if (safetyCheck.verdict === 'flagged_for_review') {
      logSafetyEvent({
        url: mainUrl,
        user_email: session.user.email,
        verdict: 'flagged_for_review',
        reason: safetyCheck.reason,
        category: safetyCheck.category,
        details: safetyCheck.details,
        layer: safetyCheck.layer,
        latency_ms: safetyCheck.latencyMs,
      });
    }

    const reportId = nanoid();
    const slug = generateSlug(mainUrl);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(createSSEMessage(event)));
        };

        try {
          // Demo mode — no key configured. Emit the same progress phases the
          // UI expects, then a deterministic sample score. No network, no spend.
          if (isDemoMode()) {
            send({ type: 'progress', data: { status: 'fetching_main', progress: 15, message: getRandomMessage(FETCHING_MESSAGES) } });
            await sleep(700);
            send({ type: 'progress', data: { status: 'analyzing_pm', progress: 45, message: getRandomMessage(ANALYZING_MESSAGES) } });
            await sleep(800);
            const demoScore = buildDemoScore(mainUrl);
            send({ type: 'pm_score', data: { status: 'analyzing_pm', progress: 75, message: getRandomMessage(ANALYZING_MESSAGES), pmScore: demoScore } });
            await sleep(500);
            const demoHost = (() => { try { return new URL(mainUrl).hostname.replace(/^www\./, ''); } catch { return mainUrl; } })();
            send({
              type: 'complete',
              data: {
                status: 'complete',
                progress: 100,
                message: 'Sample analysis complete (demo mode).',
                reportId,
                slug,
                pmScore: demoScore,
                mainTitle: demoHost,
                mainDescription: 'Sample analysis generated in demo mode.',
                modelUsed: 'demo',
                moderationStatus,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              },
            });
            return;
          }

          // Step 1: Fetch website content (homepage + pricing if available)
          send({
            type: 'progress',
            data: {
              status: 'fetching_main',
              progress: 10,
              message: getRandomMessage(FETCHING_MESSAGES),
            },
          });

          let mainContent: WebsiteContent;
          let pricingContent: WebsiteContent | null = null;
          let pricingUrl: string | null = null;

          // Try Firecrawl first (gets homepage + pricing), fall back to basic fetch
          if (isFirecrawlConfigured()) {
            try {
              console.log('[Firecrawl] Using Firecrawl for enhanced scraping...');
              const firecrawlResult = await fetchWithFirecrawl(mainUrl);
              mainContent = firecrawlResult.homepage;
              pricingContent = firecrawlResult.pricingPage;
              pricingUrl = firecrawlResult.pricingUrl;

              if (pricingContent) {
                console.log(`[Firecrawl] Found pricing page: ${pricingUrl}`);
              }
            } catch (error) {
              console.log('[Firecrawl] Firecrawl failed, falling back to basic fetch:', error instanceof Error ? error.message : 'Unknown error');
              mainContent = await fetchWebsite(mainUrl);
            }
          } else {
            mainContent = await fetchWebsite(mainUrl);
          }

          send({
            type: 'progress',
            data: {
              status: 'fetching_main',
              progress: 20,
              message: pricingContent ? 'Found pricing page!' : getRandomMessage(FETCHING_MESSAGES),
            },
          });

          // Step 2: PM Score Analysis
          send({
            type: 'progress',
            data: {
              status: 'analyzing_pm',
              progress: 35,
              message: getRandomMessage(ANALYZING_MESSAGES),
            },
          });

          let aiProvider: AIProvider = 'anthropic';
          const pmScoreResult = await analyzeWithClaude(
            PM_SCORE_SYSTEM_PROMPT,
            buildPMScoreUserPrompt(mainContent, pricingContent)
          );
          aiProvider = pmScoreResult.provider;

          const pmScore = parseJSONResponse<PMScoreResult>(pmScoreResult.text);

          send({
            type: 'pm_score',
            data: {
              status: 'analyzing_pm',
              progress: 70,
              message: getRandomMessage(ANALYZING_MESSAGES),
              pmScore,
            },
          });

          // Step 3: Complete — client will save to DB via /api/save-analysis
          // (Vercel Hobby has 10s function timeout; save must happen in a separate request)
          const modelUsed = aiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'grok-3-mini-beta';

          send({
            type: 'complete',
            data: {
              status: 'complete',
              progress: 100,
              message: moderationStatus === 'pending_review'
                ? 'Analysis complete! Your report is being reviewed.'
                : 'Analysis complete!',
              reportId,
              slug,
              pmScore,
              mainTitle: mainContent.title,
              mainDescription: mainContent.description,
              modelUsed,
              moderationStatus,
              usage: {
                inputTokens: pmScoreResult.usage.inputTokens,
                outputTokens: pmScoreResult.usage.outputTokens,
                totalTokens: pmScoreResult.usage.totalTokens,
              },
            },
          });
        } catch (error) {
          console.error('Analysis error:', error);

          // Use user-friendly message for AnalysisError, otherwise fallback
          let errorMessage = 'Analysis failed. Please try again.';
          if (error instanceof WebsiteScraperError && error.code === 'SSRF_BLOCKED') {
            errorMessage = "This URL can't be analyzed. Please enter a public website URL.";
          } else if (error instanceof FirecrawlError && error.code === 'SSRF_BLOCKED') {
            errorMessage = "This URL can't be analyzed. Please enter a public website URL.";
          } else if (error instanceof AnalysisError) {
            errorMessage = error.userFriendlyMessage;
          } else if (error instanceof FirecrawlError) {
            if (error.code === 'RATE_LIMIT') {
              errorMessage = "We've hit our page scraping limit. Try again tomorrow or contact Matteo.";
            } else {
              errorMessage = `Failed to fetch website: ${error.message}`;
            }
          } else if (error instanceof Error) {
            // Check for common error patterns
            if (error.message.includes('429') || error.message.includes('rate_limit')) {
              errorMessage = "Oops! We've hit our daily API limit. DM Matteo on LinkedIn and tell him to upgrade :P";
            } else if (error.message.includes('413') || error.message.includes('too large')) {
              errorMessage = "This website has too much content to analyze. Try a simpler page or contact Matteo.";
            }
          }

          send({
            type: 'error',
            data: {
              error: errorMessage,
            },
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      createSSEMessage({
        type: 'error',
        data: { error: 'Invalid request' },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }
    );
  }
}
