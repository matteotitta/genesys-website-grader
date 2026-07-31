import 'server-only';
import { auth } from '@/lib/auth';

/**
 * The minimal session shape the app needs. Mirrors the fields we read off
 * NextAuth's session so call-sites don't depend on the auth provider directly.
 */
export interface AppSession {
  user: {
    email: string;
    name?: string;
    image?: string;
    isAdmin?: boolean;
  };
}

/**
 * Dev auth bypass. Keyless by default in development; set DEV_NO_AUTH=false to
 * test real Google sign-in locally. Can never be active in a production build
 * (NODE_ENV gate), so it will not weaken a real deployment.
 */
function devBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_NO_AUTH !== 'false';
}

/**
 * Returns the current session, or a mock session in dev-bypass mode.
 * Use this in API routes instead of calling `auth()` directly.
 */
export async function getSession(): Promise<AppSession | null> {
  if (devBypassEnabled()) {
    return { user: { email: 'demo@localhost', name: 'Demo User', isAdmin: true } };
  }

  const session = await auth();
  if (!session?.user?.email) return null;

  return {
    user: {
      email: session.user.email,
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
      isAdmin: session.user.isAdmin,
    },
  };
}
