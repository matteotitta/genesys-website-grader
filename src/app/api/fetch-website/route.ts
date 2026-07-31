import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchWebsite, WebsiteScraperError } from '@/lib/fetcher/website-scraper';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { checkUrlSafety, getSafetyErrorMessage } from '@/lib/safety/url-categorizer';
import { logSafetyEvent } from '@/lib/safety/audit-log';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(
    rateLimitKey('fetch-website', session.user.email),
    { windowMs: 10 * 60 * 1000, maxRequests: 10 }
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetMs / 1000)) } }
    );
  }

  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Safety check before fetching
    const safetyCheck = await checkUrlSafety(url);
    if (safetyCheck.verdict === 'blocked') {
      logSafetyEvent({
        url,
        user_email: session.user.email,
        verdict: 'blocked',
        reason: safetyCheck.reason,
        category: safetyCheck.category,
        details: safetyCheck.details,
        layer: safetyCheck.layer,
        latency_ms: safetyCheck.latencyMs,
      });
      return NextResponse.json(
        { error: getSafetyErrorMessage(safetyCheck.reason), code: 'SAFETY_BLOCKED' },
        { status: 403 }
      );
    }

    if (safetyCheck.verdict === 'flagged_for_review') {
      logSafetyEvent({
        url,
        user_email: session.user.email,
        verdict: 'flagged_for_review',
        reason: safetyCheck.reason,
        category: safetyCheck.category,
        details: safetyCheck.details,
        layer: safetyCheck.layer,
        latency_ms: safetyCheck.latencyMs,
      });
    }

    const content = await fetchWebsite(url);
    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof WebsiteScraperError) {
      const status = error.code === 'NOT_FOUND' ? 404
        : error.code === 'SSRF_BLOCKED' ? 403
        : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    console.error('Fetch website error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch website' },
      { status: 500 }
    );
  }
}
