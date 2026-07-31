'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PMScoreResult } from '@/types/analysis';

interface RecommendationsProps {
  pmScore: PMScoreResult;
}

// Parse recommendation text to extract and bold priority prefixes
function formatRecommendation(text: string) {
  const priorityPrefixes = ['Fix this week:', 'Fix this month:', 'Fix this quarter:'];

  for (const prefix of priorityPrefixes) {
    if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = text.slice(prefix.length).trim();
      return (
        <>
          <span className="font-semibold text-foreground">{prefix}</span>{' '}
          {rest}
        </>
      );
    }
  }

  return text;
}

export function Recommendations({ pmScore }: RecommendationsProps) {
  const allRecommendations = pmScore.priorityImprovements.map((r) => ({ text: r }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium tracking-tight text-foreground">
              Top Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pmScore.topStrengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground/90">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Priority Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium tracking-tight text-foreground">
              Priority Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {allRecommendations.slice(0, 5).map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground/90">{formatRecommendation(rec.text)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
    </div>
  );
}
