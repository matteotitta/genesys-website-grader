import type { PMScoreResult, PMScoreDimension } from '@/types/analysis';

/**
 * Deterministic sample scorecard used when no ANTHROPIC_API_KEY is configured
 * (demo mode). It lets the app run, be tested, and be demoed with zero secrets.
 *
 * The copy is intentionally generic — it evaluates "this homepage", never a
 * named brand — so a demo run never publishes a fabricated score for a real
 * company. Real scoring (with a key set) replaces all of this with a live
 * Claude analysis.
 */

// Tiny deterministic PRNG so the same URL always yields the same sample.
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

interface DimensionSeed {
  id: keyof PMScoreResult['dimensions'];
  name: string;
  maxPoints: number;
  analysis: string;
  evidence: string[];
  suggestions: string[];
}

// 10 dimensions summing to 100, matching the PM scoring rubric.
const DIMENSIONS: DimensionSeed[] = [
  {
    id: 'productClarity',
    name: 'Product clarity',
    maxPoints: 12,
    analysis: 'The hero states a category but leans on an abstract outcome before it names the thing itself. A first-time visitor can tell it is software, not what the software replaces or does.',
    evidence: ['Hero headline leads with a benefit, not a "what"', 'No tool or task anchor above the fold'],
    suggestions: ['Add a one-line "what it is" under the hero (e.g. "the X that replaces Y")', 'Name a concrete task the product performs in the sub-headline'],
  },
  {
    id: 'audienceSpecificity',
    name: 'Audience specificity',
    maxPoints: 12,
    analysis: 'Copy speaks to a broad "teams" audience. A specific buyer would not immediately self-select — the page could belong to a dozen adjacent products.',
    evidence: ['"For teams of all sizes" framing', 'No role or segment named in the first section'],
    suggestions: ['Name the primary role you sell to in the hero', 'Cut the generic "all teams" line — specificity drives qualified traffic'],
  },
  {
    id: 'problemArticulation',
    name: 'Problem articulation',
    maxPoints: 14,
    analysis: 'The problem is implied through features rather than stated as a pain the reader feels. There is no moment where the visitor thinks "they understand my situation".',
    evidence: ['Problem section jumps straight to capabilities', 'No before-state or cost-of-inaction framed'],
    suggestions: ['Open with the status-quo pain in the reader\'s words', 'Quantify the cost of the current workaround'],
  },
  {
    id: 'differentiation',
    name: 'Differentiation',
    maxPoints: 14,
    analysis: 'Claims are true but interchangeable with competitors — "fast", "flexible", "powerful". Nothing here forces a "why you over the alternative" answer.',
    evidence: ['Adjective-led value props', 'No named alternative or explicit contrast'],
    suggestions: ['State one thing you do that the obvious alternative cannot', 'Replace one adjective claim with a by-degree proof point'],
  },
  {
    id: 'outcomeClarity',
    name: 'Outcome clarity',
    maxPoints: 14,
    analysis: 'Outcomes are gestured at but not made concrete. The business case a buyer would take to their manager is missing a number or a tangible result.',
    evidence: ['Outcome copy stays qualitative', 'No metric or time-to-value stated'],
    suggestions: ['Attach one concrete result to the primary outcome', 'Show time-to-first-value somewhere above the fold'],
  },
  {
    id: 'trustAndProof',
    name: 'Trust & proof',
    maxPoints: 10,
    analysis: 'Logos are present but proof stops there — no specific customer result, quote, or number backs the claims made higher up.',
    evidence: ['Logo strip with no context', 'No testimonial tied to a measurable result'],
    suggestions: ['Pair one logo with a specific outcome that customer got', 'Add a single credible metric near the main claim'],
  },
  {
    id: 'actionClarity',
    name: 'Action clarity',
    maxPoints: 8,
    analysis: 'The primary CTA competes with several secondary buttons of equal weight, so the path forward is not obvious on first scan.',
    evidence: ['Multiple equal-weight CTAs in the hero', 'Primary and secondary actions styled the same'],
    suggestions: ['Make one CTA visually dominant per section', 'Reduce the hero to a single primary action'],
  },
  {
    id: 'riskReduction',
    name: 'Risk reduction',
    maxPoints: 6,
    analysis: 'Common objections (setup effort, lock-in, security) go unaddressed near the decision point, leaving friction the reader has to resolve on their own.',
    evidence: ['No objection-handling near the CTA', 'Security and onboarding not mentioned on the page'],
    suggestions: ['Add a short "what could go wrong" answer near the CTA', 'Surface a trust signal (SOC 2, free trial, no card) at the decision point'],
  },
  {
    id: 'pricingClarity',
    name: 'Pricing clarity',
    maxPoints: 5,
    analysis: 'Pricing is either hidden behind "contact us" or presented without a clear anchor, so the buyer cannot self-qualify on budget.',
    evidence: ['No visible price or range', 'Tiering does not map to a buyer type'],
    suggestions: ['Show at least a starting price or a clear range', 'Map each tier to a named buyer, not a feature count'],
  },
  {
    id: 'productVisualization',
    name: 'Product visualization',
    maxPoints: 5,
    analysis: 'The interface is described but rarely shown. Abstract software needs a visual anchor — a real screen beats another paragraph of copy.',
    evidence: ['Few or no product screenshots', 'Illustrations stand in for the real UI'],
    suggestions: ['Show one real screen of the core workflow', 'Replace a decorative graphic with a product visual'],
  },
];

function gradeFor(total: number): PMScoreResult['grade'] {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

export function buildDemoScore(url: string): PMScoreResult {
  const rand = seededRandom(hashString(url));

  const dimensions = {} as PMScoreResult['dimensions'];
  let total = 0;

  for (const seed of DIMENSIONS) {
    // Score between ~50% and ~92% of max, deterministic per URL.
    const ratio = 0.5 + rand() * 0.42;
    const score = Math.max(1, Math.min(seed.maxPoints, Math.round(seed.maxPoints * ratio)));
    total += score;

    const dimension: PMScoreDimension = {
      id: seed.id,
      name: seed.name,
      maxPoints: seed.maxPoints,
      score,
      analysis: seed.analysis,
      evidence: seed.evidence,
      suggestions: seed.suggestions,
    };
    dimensions[seed.id] = dimension;
  }

  return {
    totalScore: total,
    maxScore: 100,
    grade: gradeFor(total),
    dimensions,
    summary:
      'This is a sample scorecard generated in demo mode (no Anthropic key configured). It shows the shape of a real analysis — a 0–100 PM score across ten positioning dimensions, each with evidence and fixes.\n\nThe strongest signals here are the visual proof and the calls to action; the biggest gaps are a clear "what is this" above the fold and a problem the reader actually feels. Set ANTHROPIC_API_KEY to grade a real site.',
    topStrengths: [
      'Clean visual hierarchy that guides the eye down the page',
      'Recognizable logos establish baseline credibility',
      'The core call to action is easy to find',
    ],
    priorityImprovements: [
      'Say what the product is above the fold, not just what it achieves',
      'Open with a problem the specific buyer feels, in their words',
      'Back one headline claim with a concrete number or customer result',
    ],
  };
}
