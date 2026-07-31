'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { PMScoreResult } from '@/types/analysis';

// Short labels for radar chart (single word for visual clarity)
const SHORT_LABELS: Record<string, string> = {
  productClarity: 'Product',
  audienceSpecificity: 'Audience',
  problemArticulation: 'Problem',
  trustAndProof: 'Proof',
  outcomeClarity: 'Outcomes',
  differentiation: 'Differentiation',
  productVisualization: 'Demo',
  pricingClarity: 'Pricing',
  riskReduction: 'Objections',
  actionClarity: 'CTA',
};

interface PMScoreRadarChartProps {
  pmScore: PMScoreResult;
}

export function PMScoreRadarChart({ pmScore }: PMScoreRadarChartProps) {
  const data = Object.values(pmScore.dimensions).map((dim) => ({
    dimension: SHORT_LABELS[dim.id] || dim.name,
    fullName: dim.name,
    score: dim.score,
    maxScore: dim.maxPoints,
    percentage: Math.round((dim.score / dim.maxPoints) * 100),
    fullMark: 100,
  }));

  return (
    <div className="w-full h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bafdff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#bafdff" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <PolarGrid
            stroke="#302f3b"
            strokeOpacity={0.8}
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{
              fill: '#ededf0',
              fontSize: 10,
              fontWeight: 500,
            }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="percentage"
            stroke="#bafdff"
            fill="url(#radarGradient)"
            fillOpacity={0.4}
            strokeWidth={2.5}
            dot={{
              r: 4,
              fill: '#bafdff',
              stroke: '#181723',
              strokeWidth: 1.5,
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                  <p className="font-medium text-foreground">{data.fullName || data.dimension}</p>
                  <p className="text-sm text-primary">
                    Score: {data.score}/{data.maxScore} ({data.percentage}%)
                  </p>
                </div>
              );
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
