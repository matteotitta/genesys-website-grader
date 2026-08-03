import 'server-only';

// Kit (formerly ConvertKit) v4 newsletter subscription.
//
// Adds an email captured by the branded email gate to the Kit account:
//   1. upsert the subscriber   — POST /v4/subscribers (creates if new),
//   2. add them to the form    — POST /v4/forms/:id/subscribers (when KIT_FORM_ID
//      is set), which triggers that form's newsletter/opt-in automation.
// The form endpoint requires the subscriber to already exist, so step 1 runs first.
//
// No-op when KIT_API_KEY is unset (e.g. the open-source demo), and it never
// throws — lead capture must not break the analysis response.

const KIT_API_KEY = process.env.KIT_API_KEY;
const KIT_FORM_ID = process.env.KIT_FORM_ID;
const KIT_TAG_ID = process.env.KIT_TAG_ID;
const KIT_API_BASE = 'https://api.kit.com/v4';

interface KitSubscriber {
  email: string;
  firstName?: string;
}

async function kitPost(url: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Kit-Api-Key': KIT_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Kit] POST ${url} failed: ${response.status} ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Kit] POST ${url} error:`, err);
    return false;
  }
}

export async function addSubscriberToNewsletter({ email, firstName }: KitSubscriber): Promise<void> {
  if (!KIT_API_KEY) {
    console.warn('[Kit] KIT_API_KEY not set, skipping newsletter subscription');
    return;
  }

  // 1. Upsert the subscriber (v4 create behaves as an upsert by email address).
  const created = await kitPost(`${KIT_API_BASE}/subscribers`, {
    email_address: email,
    ...(firstName ? { first_name: firstName } : {}),
  });
  if (!created) return;

  // 2. Add them to the newsletter form (requires the subscriber to exist first).
  if (KIT_FORM_ID) {
    await kitPost(`${KIT_API_BASE}/forms/${KIT_FORM_ID}/subscribers`, {
      email_address: email,
    });
  }

  // 3. Tag them so grader leads are a filterable, exportable segment in Kit.
  if (KIT_TAG_ID) {
    await kitPost(`${KIT_API_BASE}/tags/${KIT_TAG_ID}/subscribers`, {
      email_address: email,
    });
  }
}
