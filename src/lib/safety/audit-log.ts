import type { SafetyVerdict } from './url-categorizer';

/**
 * Safety event logging.
 *
 * The public build has no persistence layer, so this logs blocked/flagged
 * attempts to the server console only. Swap the body for your own sink
 * (a Sheet tab, a logging service) if you want an audit trail.
 */

export interface SafetyEvent {
  url: string;
  user_email: string | undefined;
  verdict: SafetyVerdict;
  reason?: string;
  category?: string;
  details?: string;
  layer: string;
  latency_ms: number;
}

export function logSafetyEvent(event: SafetyEvent): void {
  if (event.verdict === 'allowed') return;
  console.log(
    `[Safety] ${event.verdict} — ${event.url} (${event.reason ?? 'n/a'}, layer=${event.layer})`
  );
}
