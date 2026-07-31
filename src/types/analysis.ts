// PM Score Types
export interface PMScoreDimension {
  id: string;
  name: string;
  maxPoints: number;
  score: number;
  analysis: string;
  evidence: string[];
  suggestions: string[];
}

export interface PMScoreResult {
  totalScore: number;
  maxScore: 100;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    productClarity: PMScoreDimension;
    audienceSpecificity: PMScoreDimension;
    problemArticulation: PMScoreDimension;
    differentiation: PMScoreDimension;
    outcomeClarity: PMScoreDimension;
    trustAndProof: PMScoreDimension;
    actionClarity: PMScoreDimension;
    riskReduction: PMScoreDimension;
    pricingClarity: PMScoreDimension;
    productVisualization: PMScoreDimension;
  };
  summary: string;
  topStrengths: string[];
  priorityImprovements: string[];
}

// Competitor Research Types
export type CompetitorDimensionType =
  | 'company'
  | 'product'
  | 'icp'
  | 'pricing'
  | 'reviews'
  | 'content'
  | 'launches'
  | 'seo_aeo'
  | 'technographics'
  | 'openings'
  | 'gtm';

export interface CompetitorDimension {
  dimension: CompetitorDimensionType;
  data: Record<string, unknown>;
  analysis: string;
  competitivePosition: 'leading' | 'competitive' | 'lagging' | 'unknown';
}

export interface CompetitorProfile {
  url: string;
  name: string;
  logo?: string;
  dimensions: CompetitorDimension[];
  overallAssessment: string;
}

export interface CompetitorResult {
  mainSite: CompetitorProfile;
  competitors: CompetitorProfile[];
  comparisonMatrix: Record<CompetitorDimensionType, {
    winner: string;
    analysis: string;
  }>;
  strategicRecommendations: string[];
}

// Analysis State Types
export type AnalysisStatus =
  | 'idle'
  | 'fetching_main'
  | 'fetching_competitors'
  | 'analyzing_pm'
  | 'analyzing_competitors'
  | 'generating_recommendations'
  | 'complete'
  | 'error';

export interface AnalysisProgress {
  step: number;
  totalSteps: number;
  message: string;
  percentage: number;
}

export interface AnalysisResults {
  pmScore: PMScoreResult | null;
  competitors: CompetitorResult | null;
}

export interface AnalysisState {
  status: AnalysisStatus;
  mainUrl: string;
  competitorUrls: string[];
  progress: AnalysisProgress;
  results: AnalysisResults;
  error: string | null;
  reportId: string | null;
  slug: string | null;
  analyzedAt: string | null; // ISO date string for historical tracking
}

// Website Content Types
export interface WebsiteContent {
  url: string;
  title: string;
  description: string;
  content: string;
  metadata: {
    ogImage?: string;
    favicon?: string;
  };
  fetchedAt: string;
}

// API Request/Response Types
export interface AnalyzeRequest {
  mainUrl: string;
  competitorUrls?: string[];
}

export interface StreamEvent {
  type: 'progress' | 'pm_score' | 'competitors' | 'complete' | 'error';
  data: {
    status?: AnalysisStatus;
    progress?: number;
    message?: string;
    pmScore?: PMScoreResult;
    competitors?: CompetitorResult;
    reportId?: string;
    slug?: string;
    error?: string;
    // Fields for client-side save (sent in 'complete' event)
    mainTitle?: string;
    mainDescription?: string;
    modelUsed?: string;
    moderationStatus?: 'approved' | 'pending_review';
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  };
}
