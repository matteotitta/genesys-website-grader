import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { createOrUpdateContact } from '@/lib/loops';

// Emails granted the isAdmin session flag. Configure via ADMIN_EMAILS
// (comma-separated) or leave empty.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Only register Google when it's actually configured. Without this, an
// unconfigured provider makes /api/auth/session error — noisy in local/demo
// runs where sign-in is bypassed anyway.
const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Auth.js requires a secret even with no providers. In dev we fall back to a
  // throwaway value so local/demo runs don't 500 on /api/auth/session;
  // production must set a real AUTH_SECRET.
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-insecure-secret-do-not-use-in-prod' : undefined),
  trustHost: true,
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    async signIn({ user }) {
      // Allow all Google sign-ins (anyone can use the grader).
      // Optional email-funnel sync to Loops (no-op when LOOPS_API_KEY is unset).
      if (user.email) {
        const nameParts = (user.name || '').split(' ');
        createOrUpdateContact({
          email: user.email,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          source: 'website-grader',
        }).catch((err) => console.error('[Auth] Failed to sync to Loops:', err));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        token.isAdmin = ADMIN_EMAILS.includes(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
});
