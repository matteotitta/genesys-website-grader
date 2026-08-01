import 'server-only';

// Kit (formerly ConvertKit) newsletter subscription.
//
// Adds an email captured by the branded email gate to the Kit account. When
// KIT_FORM_ID is set it subscribes to that form (the newsletter signup form,
// which triggers any welcome/opt-in automation); otherwise it just creates or
// updates the subscriber record. No-op when KIT_API_KEY is unset (e.g. the
// open-source demo), and it never throws — lead capture must not break the
// analysis response.

const KIT_API_KEY = process.env.KIT_API_KEY;
const KIT_FORM_ID = process.env.KIT_FORM_ID;
const KIT_API_BASE = 'https://api.kit.com/v4';

interface KitSubscriber {
  email: string;
  firstName?: string;
}

export async function addSubscriberToNewsletter({ email, firstName }: KitSubscriber): Promise<void> {
  if (!KIT_API_KEY) {
    console.warn('[Kit] KIT_API_KEY not set, skipping newsletter subscription');
    return;
  }

  const url = KIT_FORM_ID
    ? `${KIT_API_BASE}/forms/${KIT_FORM_ID}/subscribers`
    : `${KIT_API_BASE}/subscribers`;

  const body: Record<string, unknown> = { email_address: email };
  if (firstName) body.first_name = firstName;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Kit-Api-Key': KIT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Kit] Subscribe failed: ${response.status} ${text}`);
    }
  } catch (err) {
    console.error('[Kit] Subscribe error:', err);
  }
}
