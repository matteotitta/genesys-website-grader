import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { saveSubmission } from '@/lib/db/sheets';
import type { PMScoreResult, PMScoreDimension } from '@/types/analysis';

const PMScoreSchema = z.object({
  totalScore: z.number().min(0).max(100),
  maxScore: z.number().min(0),
  grade: z.string().max(20),
  dimensions: z.record(z.string(), z.unknown()),
  summary: z.string(),
  topStrengths: z.array(z.string()),
  priorityImprovements: z.array(z.string()),
});

const SaveAnalysisSchema = z.object({
  reportId: z.string().min(1).max(100),
  slug: z.string().min(1).max(200),
  mainUrl: z.string().url().max(2000),
  userEmail: z.string().email().max(320).optional(),
  mainTitle: z.string().max(500).optional(),
  mainDescription: z.string().max(2000).optional(),
  pmScore: PMScoreSchema,
  modelUsed: z.string().max(100),
  moderationStatus: z.enum(['approved', 'pending_review']).default('pending_review'),
  usage: z.object({
    inputTokens: z.number().min(0),
    outputTokens: z.number().min(0),
    totalTokens: z.number().min(0),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(
    rateLimitKey('save-analysis', session.user.email),
    { windowMs: 10 * 60 * 1000, maxRequests: 10 }
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetMs / 1000)) } }
    );
  }

  try {
    const parseResult = SaveAnalysisSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const { reportId, mainUrl, pmScore: rawPmScore, modelUsed, userEmail } = parseResult.data;
    const pmScore = rawPmScore as unknown as PMScoreResult;

    // Flatten per-dimension scores to a name → score map for the Sheet columns.
    const dimensionScores: Record<string, number> = {};
    for (const dim of Object.values(pmScore.dimensions) as PMScoreDimension[]) {
      dimensionScores[dim.name] = dim.score;
    }

    const result = await saveSubmission({
      reportId,
      url: mainUrl,
      totalScore: pmScore.totalScore,
      maxScore: pmScore.maxScore,
      grade: pmScore.grade,
      dimensionScores,
      summary: pmScore.summary,
      modelUsed,
      userEmail: userEmail || session.user.email || undefined,
      userName: session.user.name || undefined,
    });

    return NextResponse.json({ saved: result.ok });
  } catch (err) {
    console.error('[save-analysis] Error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
