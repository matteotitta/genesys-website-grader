import 'server-only';

/**
 * Google Sheets submission log.
 *
 * Submissions are appended to a Google Sheet via a Google Apps Script Web App
 * (a doPost webhook). The only secret is the deploy URL in
 * GOOGLE_SHEETS_WEBHOOK_URL — no service account, no client library.
 *
 * Setup: see README ("Log submissions to Google Sheets"). When the env var is
 * unset the write is a no-op (logged), so local/demo runs never fail on it.
 */

export interface Submission {
  reportId: string;
  url: string;
  totalScore: number;
  maxScore: number;
  grade: string;
  /** Per-dimension scores keyed by dimension name, e.g. { "Product clarity": 9 }. */
  dimensionScores: Record<string, number>;
  summary: string;
  modelUsed: string;
  userEmail?: string;
  userName?: string;
}

export async function saveSubmission(submission: Submission): Promise<{ ok: boolean }> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[sheets] GOOGLE_SHEETS_WEBHOOK_URL not set — skipping submission log');
    return { ok: false };
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...submission,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Apps Script web apps redirect through a script.googleusercontent.com URL.
      redirect: 'follow',
    });

    if (!res.ok) {
      console.error(`[sheets] Webhook returned ${res.status}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[sheets] Failed to append submission:', err);
    return { ok: false };
  }
}
