'use client';

import { ChevronDown, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PMScoreDimension } from '@/types/analysis';

// Dimension definitions for tooltips — short and clear
const DIMENSION_DEFINITIONS: Record<string, string> = {
  productClarity: "Can visitors understand what you sell within 5 seconds?",
  audienceSpecificity: "Is the target buyer explicitly identified?",
  problemArticulation: "Is the pain you solve clearly stated?",
  trustAndProof: "Are there testimonials, logos, or case studies?",
  outcomeClarity: "Can visitors envision their transformation?",
  differentiation: "Is it clear why you're better than alternatives?",
  productVisualization: "Can visitors see the product in action?",
  pricingClarity: "Can visitors understand what they'll pay?",
  riskReduction: "Are guarantees and risk reducers present?",
  actionClarity: "Is the primary CTA obvious and compelling?",
};

// Parse suggestion to extract before/after rewrite and priority
function parseSuggestion(suggestion: string): {
  text: string;
  before?: string;
  after?: string;
  formula?: string;
  priority?: 'quick_win' | 'strategic' | 'foundation';
} {
  const result: ReturnType<typeof parseSuggestion> = { text: suggestion };

  // Try to extract BEFORE: and AFTER: patterns
  const beforeMatch = suggestion.match(/BEFORE:\s*['"]?([^'"]+)['"]?/i);
  const afterMatch = suggestion.match(/AFTER:\s*['"]?([^'"]+)['"]?/i);
  const formulaMatch = suggestion.match(/Formula:\s*([^.]+)/i);
  const priorityMatch = suggestion.match(/Priority:\s*(Quick win|Strategic|Foundation)/i);

  if (beforeMatch) result.before = beforeMatch[1].trim();
  if (afterMatch) result.after = afterMatch[1].trim();
  if (formulaMatch) result.formula = formulaMatch[1].trim();
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase();
    if (p === 'quick win') result.priority = 'quick_win';
    else if (p === 'strategic') result.priority = 'strategic';
    else if (p === 'foundation') result.priority = 'foundation';
  }

  // Clean up the main text by removing the structured parts
  const cleanText = suggestion
    .replace(/BEFORE:\s*['"]?[^'"]+['"]?/gi, '')
    .replace(/AFTER:\s*['"]?[^'"]+['"]?/gi, '')
    .replace(/Formula:\s*[^.]+\.?/gi, '')
    .replace(/Priority:\s*(Quick win|Strategic|Foundation)\.?/gi, '')
    .trim();

  if (cleanText) result.text = cleanText;

  return result;
}

function getPriorityBadge(priority: 'quick_win' | 'strategic' | 'foundation' | undefined) {
  if (!priority) return null;
  const labels = {
    quick_win: { text: 'Quick Win', variant: 'success' as const },
    strategic: { text: 'Strategic', variant: 'default' as const },
    foundation: { text: 'Foundation', variant: 'warning' as const },
  };
  const config = labels[priority];
  return <Badge variant={config.variant} className="text-xs">{config.text}</Badge>;
}

interface DimensionCardProps {
  dimension: PMScoreDimension;
  isExpanded?: boolean;
  onToggle?: () => void;
  showPulse?: boolean;
}

function getScoreVariant(score: number, maxScore: number): 'success' | 'warning' | 'destructive' | 'default' {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return 'success';
  if (percentage >= 60) return 'default';
  if (percentage >= 40) return 'warning';
  return 'destructive';
}

function getProgressColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return 'bg-[#bafdff]'; // mint
  if (percentage >= 60) return 'bg-[#939bed]'; // lavender
  if (percentage >= 40) return 'bg-[#ffb27a]'; // peach
  return 'bg-[#ff6b6b]'; // destructive
}

export function DimensionCard({ dimension, isExpanded = false, onToggle, showPulse = false }: DimensionCardProps) {
  const percentage = Math.round((dimension.score / dimension.maxPoints) * 100);
  const variant = getScoreVariant(dimension.score, dimension.maxPoints);
  const progressColor = getProgressColor(dimension.score, dimension.maxPoints);

  return (
    <Card className={`transition-all duration-200 hover:border-primary/40 overflow-hidden ${showPulse && !isExpanded ? 'animate-brilliance' : ''}`}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base font-medium">
                {dimension.name}
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{DIMENSION_DEFINITIONS[dimension.id] || dimension.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant={variant}>
              {dimension.score}/{dimension.maxPoints}
            </Badge>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </div>
        <div className={`h-1.5 mt-2 w-full overflow-hidden rounded-full bg-muted`}>
          <div
            className={`h-full rounded-full ${progressColor} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-6 px-6 space-y-6 border-t border-border/30">
          {/* Analysis */}
          <div className="pt-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              {dimension.analysis}
            </p>
          </div>

          {/* References */}
          {dimension.evidence.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                References
              </h4>
              <div className="space-y-3">
                {dimension.evidence.map((item, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 rounded-lg p-3 border-l-2 border-primary/50"
                  >
                    <p className="text-sm text-foreground/80 italic leading-relaxed">
                      &ldquo;{item}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {dimension.suggestions.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Suggestions
              </h4>
              <div className="space-y-4">
                {dimension.suggestions.map((item, index) => {
                  const parsed = parseSuggestion(item);
                  return (
                    <div key={index} className="space-y-3">
                      {/* Issue text with priority badge */}
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-foreground/90 leading-relaxed">{parsed.text}</p>
                            {getPriorityBadge(parsed.priority)}
                          </div>
                          {parsed.formula && (
                            <p className="text-xs text-muted-foreground">Formula: {parsed.formula}</p>
                          )}
                        </div>
                      </div>

                      {/* Before/After blocks */}
                      {(parsed.before || parsed.after) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-5">
                          {parsed.before && (
                            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                              <span className="text-xs text-destructive font-medium uppercase tracking-wider">Current</span>
                              <p className="text-sm mt-1 text-foreground/80">&ldquo;{parsed.before}&rdquo;</p>
                            </div>
                          )}
                          {parsed.after && (
                            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                              <span className="text-xs text-emerald-500 font-medium uppercase tracking-wider">Suggested</span>
                              <p className="text-sm mt-1 text-foreground/80">&ldquo;{parsed.after}&rdquo;</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
