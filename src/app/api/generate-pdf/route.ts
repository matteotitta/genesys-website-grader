import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/lib/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { PDFReport } from '@/components/pdf/report-template';
import type { PMScoreResult } from '@/types/analysis';

const PdfRequestSchema = z.object({
  url: z.string().url().max(2000),
  pmScore: z.object({
    totalScore: z.number(),
    maxScore: z.number(),
    grade: z.string(),
    dimensions: z.record(z.string(), z.unknown()),
    summary: z.string(),
    topStrengths: z.array(z.string()),
    priorityImprovements: z.array(z.string()),
  }),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(
    rateLimitKey('generate-pdf', session.user.email),
    { windowMs: 10 * 60 * 1000, maxRequests: 10 }
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetMs / 1000)) } }
    );
  }

  try {
    const parseResult = PdfRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'URL and PM Score are required' }, { status: 400 });
    }
    const { url, pmScore: rawPmScore } = parseResult.data;
    const pmScore = rawPmScore as unknown as PMScoreResult;

    // Get base URL from request for serving static assets
    const baseUrl = request.nextUrl.origin;

    const pdfBuffer = await renderToBuffer(
      PDFReport({
        url,
        pmScore,
        generatedAt: new Date().toISOString(),
        baseUrl,
      })
    );

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="website-grader-report-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
