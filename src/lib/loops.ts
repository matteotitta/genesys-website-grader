const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

interface LoopsContact {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
}

export async function createOrUpdateContact(contact: LoopsContact): Promise<void> {
  if (!LOOPS_API_KEY) {
    console.warn('[Loops] LOOPS_API_KEY not set, skipping contact sync');
    return;
  }

  const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOOPS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      source: contact.source || 'website-grader',
      userGroup: 'website-grader',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Loops API error ${response.status}: ${text}`);
  }
}
