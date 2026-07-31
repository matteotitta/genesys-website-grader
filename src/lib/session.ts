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
 * When true, the app skips Google sign-in and runs keyless. Two triggers:
 *  - Development: on by default (set DEV_NO_AUTH=false to test real sign-in).
 *  - PUBLIC_DEMO=true: an explicit opt-in for a hosted public demo (any env).
 * A real production deploy that leaves PUBLIC_DEMO unset keeps sign-in intact.
 */
function bypassEnabled(): boolean {
  // NEXT_PUBLIC_ is inlined at build (available in serverless functions too),
  // so the demo works on a hosted deploy; PUBLIC_DEMO covers runtime-only envs.
  if (process.env.PUBLIC_DEMO === 'true' || process.env.NEXT_PUBLIC_PUBLIC_DEMO === 'true') return true;
  return process.env.NODE_ENV !== 'production' && process.env.DEV_NO_AUTH !== 'false';
}

/**
 * Returns the current session, or a mock session in dev-bypass mode.
 * Use this in API routes instead of calling `auth()` directly.
 */
export async function getSession(): Promise<AppSession | null> {
  if (bypassEnabled()) {
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
