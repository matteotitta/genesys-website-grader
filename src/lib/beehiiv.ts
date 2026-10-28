import 'server-only';

// beehiiv newsletter subscription.
//
// Adds an email captured by the branded email gate to the beehiiv publication:
//   1. create the subscription — POST /v2/publications/:id/subscriptions
//      (no double opt-in, no welcome email; an existing subscriber is returned
//      as-is, and anyone who unsubscribed is NOT re-subscribed),
//   2. tag it                  — POST /v2/publications/:id/subscriptions/:subId/tags
//      (when BEEHIIV_TAG is set), so grader leads are a filterable segment.
// The create endpoint takes no tags, so step 2 needs the id from step 1.
//
// No-op when BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID is unset (e.g. the
// open-source demo), and it never throws — lead capture must not break the
// analysis response.

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_TAG = process.env.BEEHIIV_TAG;
const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

interface NewsletterSubscriber {
  email: string;
}

async function beehiivPost(url: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BEEHIIV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[beehiiv] POST ${url} failed: ${response.status} ${text}`);
      return null;
    }
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    console.error(`[beehiiv] POST ${url} error:`, err);
    return null;
  }
}

export async function addSubscriberToNewsletter({ email }: NewsletterSubscriber): Promise<void> {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
    console.warn('[beehiiv] BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set, skipping newsletter subscription');
    return;
  }

  const base = `${BEEHIIV_API_BASE}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

  // 1. Create the subscription (active immediately, no confirmation or welcome email).
  const created = await beehiivPost(base, {
    email,
    reactivate_existing: false,
    send_welcome_email: false,
    double_opt_override: 'off',
    utm_source: 'website-grader',
  });
  const subscriptionId = (created?.data as { id?: string } | undefined)?.id;
  if (!subscriptionId) return;

  // 2. Tag them so grader leads are a filterable, exportable segment in beehiiv.
  if (BEEHIIV_TAG) {
    await beehiivPost(`${base}/${subscriptionId}/tags`, { tags: [BEEHIIV_TAG] });
  }
}
