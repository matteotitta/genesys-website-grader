'use client';

import { useState } from 'react';
import { Loader2, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UrlInputFormProps {
  onSubmit: (mainUrl: string) => void;
  isLoading?: boolean;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

export function UrlInputForm({ onSubmit, isLoading = false }: UrlInputFormProps) {
  const [mainUrl, setMainUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate main URL
    const normalizedMain = normalizeUrl(mainUrl);
    if (!mainUrl.trim()) {
      setError('Website URL is required');
      return;
    }
    if (!isValidUrl(normalizedMain)) {
      setError('Please enter a valid URL');
      return;
    }

    setError(null);
    onSubmit(normalizedMain);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="p-4 sm:p-6">
        {/* noValidate: the input is type="url" for the mobile keyboard, but we
            accept scheme-less input (e.g. "linear.app") and normalize it in JS.
            Native validation would otherwise block submit before that runs. */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">
          {/* Main URL Input */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="website-url">
              Your Website URL <span className="text-destructive">*</span>
            </label>
            <Input
              id="website-url"
              type="url"
              inputMode="url"
              placeholder="linear.app"
              value={mainUrl}
              onChange={(e) => setMainUrl(e.target.value)}
              className={`h-12 sm:h-12 text-[16px] sm:text-base rounded-lg ${error ? 'border-destructive' : ''}`}
              disabled={isLoading}
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 sm:h-12 text-base rounded-lg touch-manipulation"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze Website
                <ArrowRight className="h-4 w-4 ml-2 arrow-icon" />
              </>
            )}
          </Button>

          {/* How it works */}
          <div className="flex justify-center">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <HelpCircle className="h-4 w-4" />
                    How it works
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center p-3">
                  <p className="text-sm">
                    The app fetches your home page, scans its wireframe and copy, and scores it across 9 product marketing dimensions — the same method I use with my clients.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
