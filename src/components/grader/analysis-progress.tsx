'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import type { AnalysisStatus } from '@/types/analysis';

interface AnalysisProgressProps {
  status: AnalysisStatus;
  progress: number;
  message: string;
}

const loadingMessages = [
  "Finding the 'so what?' gaps...",
  "Scanning your hero section...",
  "Checking problem articulation...",
  "Analyzing differentiation signals...",
  "Looking for social proof...",
  "Evaluating your CTA clarity...",
  "Assessing risk reduction elements...",
  "Reviewing positioning anchors...",
  "Identifying quick wins...",
];

interface Step {
  id: string;
  label: string;
  statuses: AnalysisStatus[];
}

const steps: Step[] = [
  {
    id: 'fetch_main',
    label: 'Fetching your website',
    statuses: ['fetching_main'],
  },
  {
    id: 'analyze_pm',
    label: 'Finding positioning gaps and opps',
    statuses: ['analyzing_pm'],
  },
  {
    id: 'complete',
    label: 'Generating positioning recommendations',
    statuses: ['generating_recommendations', 'complete'],
  },
];

function getStepStatus(step: Step, currentStatus: AnalysisStatus): 'pending' | 'active' | 'complete' {
  const statusOrder: AnalysisStatus[] = [
    'idle',
    'fetching_main',
    'analyzing_pm',
    'generating_recommendations',
    'complete',
  ];

  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepStatuses = step.statuses;

  // Check if current status is in this step
  if (stepStatuses.includes(currentStatus)) {
    return 'active';
  }

  // Check if we've passed this step
  const stepFirstStatus = stepStatuses[0];
  const stepIndex = statusOrder.indexOf(stepFirstStatus);

  if (currentIndex > stepIndex) {
    return 'complete';
  }

  return 'pending';
}

export function AnalysisProgress({
  status,
  progress,
  message,
}: AnalysisProgressProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate through loading messages every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const displayMessage = status === 'analyzing_pm' ? loadingMessages[messageIndex] : message;

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="pt-6 space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current Message */}
        <div className="text-center">
          <p className="text-lg font-medium text-foreground transition-opacity duration-300">{displayMessage}</p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => {
            const stepStatus = getStepStatus(step, status);

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  stepStatus === 'active'
                    ? 'bg-primary/10 border border-primary/30'
                    : stepStatus === 'complete'
                    ? 'bg-primary/10'
                    : 'bg-muted/30'
                }`}
              >
                <div className="shrink-0">
                  {stepStatus === 'complete' ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : stepStatus === 'active' ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    stepStatus === 'active'
                      ? 'text-foreground'
                      : stepStatus === 'complete'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
