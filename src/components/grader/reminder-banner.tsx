'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/stores/analysis-store';

interface ReminderBannerProps {
  onReanalyze: (url: string) => void;
}

export function ReminderBanner({ onReanalyze }: ReminderBannerProps) {
  const { getReminderDue, dismissReminder } = useAnalysisStore();
  const [reminderEntry, setReminderEntry] = useState<ReturnType<typeof getReminderDue>>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for reminders on mount
    const entry = getReminderDue();
    setReminderEntry(entry);
  }, [getReminderDue]);

  if (!reminderEntry || dismissed) {
    return null;
  }

  const domain = (() => {
    try {
      return new URL(reminderEntry.mainUrl).hostname.replace('www.', '').split('.')[0];
    } catch {
      return 'your website';
    }
  })();

  const capitalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1);

  const daysSince = Math.floor(
    (Date.now() - new Date(reminderEntry.analyzedAt || '').getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleDismiss = () => {
    dismissReminder(reminderEntry.mainUrl);
    setDismissed(true);
  };

  const handleReanalyze = () => {
    onReanalyze(reminderEntry.mainUrl);
    handleDismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50">
      <div className="bg-card border border-primary/30 rounded-lg p-4 shadow-lg shadow-primary/10">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Time to re-check {capitalizedDomain}?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You analyzed this site {daysSince} days ago. See how your positioning has evolved.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleReanalyze}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Re-analyze
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 text-xs text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
