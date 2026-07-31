'use client';

import { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
  maxScore: number;
  grade: string;
  size?: 'sm' | 'md' | 'lg';
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#bafdff'; // mint
    case 'B':
      return '#bafdff'; // mint
    case 'C':
      return '#939bed'; // lavender
    case 'D':
      return '#ffb27a'; // peach
    case 'F':
      return '#ff6b6b'; // destructive
    default:
      return '#939bed';
  }
}

const sizes = {
  sm: { width: 120, strokeWidth: 8, scoreSize: 'text-3xl' },
  md: { width: 180, strokeWidth: 12, scoreSize: 'text-5xl' },
  lg: { width: 280, strokeWidth: 18, scoreSize: 'text-7xl' },
};

export function ScoreGauge({ score, maxScore, grade, size = 'md' }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const { width, strokeWidth, scoreSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = (animatedScore / maxScore) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const gradeColor = getGradeColor(grade);

  useEffect(() => {
    // Animate the score on mount
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, increment * step);
      setAnimatedScore(Math.round(current));

      if (step >= steps) {
        clearInterval(timer);
        setAnimatedScore(score);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={width} height={width} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={gradeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold tracking-tight text-foreground ${scoreSize}`}>
          {animatedScore}
        </span>
        <span className="text-base text-muted-foreground">/ {maxScore}</span>
        <span className="mt-2 text-xl font-bold" style={{ color: gradeColor }}>
          Grade {grade}
        </span>
      </div>
    </div>
  );
}
