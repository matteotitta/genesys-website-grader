'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { UrlInputForm } from '@/components/grader/url-input-form';
import { AnalysisProgress } from '@/components/grader/analysis-progress';
import { ScoreGauge } from '@/components/grader/score-gauge';
import { PMScoreRadarChart } from '@/components/grader/radar-chart';
import { DimensionCard } from '@/components/grader/dimension-card';
import { Recommendations } from '@/components/grader/recommendations';
import { AIChat } from '@/components/grader/ai-chat';
import { ReminderBanner } from '@/components/grader/reminder-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAnalysisStore } from '@/stores/analysis-store';
import { RotateCcw, Download, History, Mail, Link2, Check, LogOut } from 'lucide-react';
import { LogoTicker } from '@/components/ui/logo-ticker';
import Image from 'next/image';
import type { StreamEvent, AnalysisStatus } from '@/types/analysis';

export default function Home() {
  const { data: session } = useSession();
  const {
    status,
    mainUrl,
    progress,
    results,
    error,
    reportId,
    slug,
    pendingAnalysis,
    setStatus,
    setProgress,
    setPMScore,
    setError,
    setReportId,
    setSlug,
    setAnalyzedAt,
    setPendingAnalysis,
    reset,
    analysisHistory,
    restoreFromHistory,
    saveToHistory,
  } = useAnalysisStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [slackCopied, setSlackCopied] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Dev auth bypass — the whole flow runs locally without Google OAuth.
  // Keyless by default in development; set NEXT_PUBLIC_DEV_NO_AUTH=false to test
  // real sign-in. Never active in a production build (NODE_ENV gate).
  const devBypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEV_NO_AUTH !== 'false';
  const user = session?.user ?? (devBypass ? { name: 'Demo User', email: 'demo@localhost' } : undefined);

  // Use mainUrl from store for persistence (instead of local state)
  const analyzedUrl = mainUrl;
  // Parse the hostname once, safely — a corrupt persisted URL must not throw
  // during render (which would white-screen the results view).
  const analyzedHost = (() => {
    try {
      return new URL(analyzedUrl).hostname.replace(/^www\./, '');
    } catch {
      return analyzedUrl || '';
    }
  })();
  const analyzedLabel = analyzedHost.split('.')[0].replace(/^./, (c) => c.toUpperCase());

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset expanded dimension when new analysis starts (keep all collapsed initially)
  useEffect(() => {
    if (status === 'complete' && results.pmScore) {
      // Start with all cards collapsed - user will click to expand
      setExpandedDimension(null);
    }
  }, [status, results.pmScore]);

  // Auto-start analysis after auth redirect
  useEffect(() => {
    if (session?.user && pendingAnalysis && mainUrl && status === 'idle' && !isAnalyzing) {
      setPendingAnalysis(false);
      handleSubmit(mainUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, pendingAnalysis]);

  const handleSubmit = async (url: string) => {
    // Require Google sign-in before analyzing (skipped in dev-bypass mode)
    if (!user) {
      // Store the URL and flag for auto-start after OAuth redirect
      useAnalysisStore.setState({ mainUrl: url });
      setPendingAnalysis(true);
      signIn('google', { callbackUrl: window.location.href });
      return;
    }

    // Reset without saving to history (reset() handles history save internally)
    reset();
    useAnalysisStore.setState({ mainUrl: url });
    setIsAnalyzing(true);
    setStatus('fetching_main');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainUrl: url }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              handleStreamEvent(event);
            } catch (e) {
              console.error('Failed to parse event:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    const { type, data } = event;

    if (data.status) {
      setStatus(data.status as AnalysisStatus);
    }

    if (data.progress !== undefined && data.message) {
      const totalSteps = 3;
      const step = Math.ceil((data.progress / 100) * totalSteps);
      setProgress(step, totalSteps, data.message);
    }

    switch (type) {
      case 'pm_score':
        if (data.pmScore) {
          setPMScore(data.pmScore);
        }
        break;
      case 'complete':
        if (data.reportId) {
          setReportId(data.reportId);
        }
        if (data.slug) {
          setSlug(data.slug);
        }
        setAnalyzedAt();
        // Save to database via separate request (Vercel Hobby 10s timeout)
        // Read mainUrl from store at call time to avoid stale closure
        if (data.reportId && data.pmScore) {
          const currentMainUrl = useAnalysisStore.getState().mainUrl;
          fetch('/api/save-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reportId: data.reportId,
              slug: data.slug,
              mainUrl: currentMainUrl,
              mainTitle: data.mainTitle,
              mainDescription: data.mainDescription,
              pmScore: data.pmScore,
              modelUsed: data.modelUsed,
              moderationStatus: data.moderationStatus || 'pending_review',
              usage: data.usage,
            }),
          }).catch((err) => console.error('[save] Failed:', err));
        }
        break;
      case 'error':
        setError(data.error || 'Unknown error');
        break;
    }
  };

  const handleReset = () => {
    saveToHistory();
    reset();
    setIsAnalyzing(false);
  };

  const handleRestoreHistory = (index: number) => {
    restoreFromHistory(index);
    setShowHistory(false);
  };

  const handleExportPDF = async () => {
    if (!results.pmScore || !analyzedUrl) return;

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: analyzedUrl,
          pmScore: results.pmScore,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `website-grader-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

  const isShowingResults = status === 'complete' && results.pmScore;
  const isShowingProgress = isAnalyzing && status !== 'idle' && status !== 'complete' && status !== 'error';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-[100] bg-background/80">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <a
            href="https://genesysgrowth.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 sm:gap-3 logo-spin-trigger hover:opacity-80 transition-opacity"
          >
            <Image
              src="/genesys-logo.png"
              alt="Genesys Growth"
              width={28}
              height={28}
              className="rounded-lg logo-spin-target sm:w-8 sm:h-8"
            />
            <span className="font-semibold text-foreground text-sm sm:text-base hidden sm:inline">Genesys Website Grader</span>
          </a>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* History dropdown */}
            {analysisHistory.length > 0 && (
              <div className="relative" ref={historyRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-2"
                  title="History"
                >
                  <History className="h-4 w-4" />
                </Button>
                {showHistory && (
                  <div
                    className="fixed w-72 bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
                    style={{
                      top: historyRef.current ? historyRef.current.getBoundingClientRect().bottom + 8 : 0,
                      right: historyRef.current ? window.innerWidth - historyRef.current.getBoundingClientRect().right : 0,
                      zIndex: 9999
                    }}
                  >
                    <div className="p-2 border-b border-border text-xs text-muted-foreground">
                      Previous analyses
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {analysisHistory.map((entry, index) => {
                        const hostname = (() => {
                          try {
                            return new URL(entry.mainUrl).hostname.replace('www.', '');
                          } catch {
                            return entry.mainUrl;
                          }
                        })();
                        return (
                          <button
                            key={index}
                            onClick={() => handleRestoreHistory(index)}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                              alt=""
                              width={16}
                              height={16}
                              className="rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{hostname}</div>
                              <div className="text-xs text-muted-foreground">
                                Score: {entry.results.pmScore?.totalScore}/{entry.results.pmScore?.maxScore} ({entry.results.pmScore?.grade})
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isShowingResults && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="px-2" title="Download PDF">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} className="px-2" title="New analysis">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              asChild
              className="px-2 sm:px-3"
            >
              <a
                href="https://cal.com/matteo-titta/30min?layout=month_view&overlayCalendar=true"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="hidden sm:inline">Book a call with Matteo</span>
                <span className="sm:hidden">Book</span>
              </a>
            </Button>
            {/* Avatar with logout dropdown */}
            {session?.user && (
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  className="flex items-center cursor-pointer rounded-full hover:ring-2 hover:ring-primary/50 transition-all"
                >
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium">
                      {session.user.name?.charAt(0) || session.user.email?.charAt(0) || '?'}
                    </div>
                  )}
                </button>
                {showAvatarMenu && (
                  <div
                    className="fixed w-56 bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
                    style={{
                      top: avatarRef.current ? avatarRef.current.getBoundingClientRect().bottom + 8 : 0,
                      right: avatarRef.current ? window.innerWidth - avatarRef.current.getBoundingClientRect().right : 0,
                      zIndex: 9999
                    }}
                  >
                    <div className="p-3 border-b border-border">
                      <div className="text-sm font-medium truncate">{session.user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 flex flex-col justify-center">
        {/* Initial State - Show Form */}
        {status === 'idle' && !isShowingResults && (
          <div className="w-full max-w-2xl mx-auto space-y-3 sm:space-y-4">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-medium tracking-tight text-foreground leading-tight">
                Uncover positioning gaps<br />on your B2B SaaS home page
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto pt-1">
                Get tailored and actionable home page positioning recommendations with Matteo&apos;s very own method refined over 10 years working with 45+ B2B SaaS
              </p>
              <LogoTicker />
            </div>
            <UrlInputForm onSubmit={handleSubmit} isLoading={isAnalyzing} />
          </div>
        )}

        {/* Progress State */}
        {isShowingProgress && (
          <div className="w-full max-w-2xl mx-auto">
            <AnalysisProgress
              status={status}
              progress={progress.percentage}
              message={progress.message}
            />
          </div>
        )}

        {/* Error State */}
        {status === 'error' && error && (
          <div className="w-full max-w-2xl mx-auto">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6 text-center space-y-4">
                <p className="text-destructive font-medium">{error}</p>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results State */}
        {isShowingResults && results.pmScore && (
          <div className="space-y-6 sm:space-y-12">
            {/* Header Section */}
            <div className="text-center space-y-2 sm:space-y-4">
              <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-foreground">
                Positioning Recommendations
              </h1>
              <div className="flex items-center justify-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${analyzedHost}&sz=32`}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded"
                />
                <a
                  href={analyzedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white font-medium hover:text-primary transition-colors"
                >
                  {analyzedLabel}
                </a>
              </div>
            </div>

            {/* Overview Section */}
            <section>
              <h2 className="text-lg sm:text-xl font-medium tracking-tight text-foreground mb-4 sm:mb-6">Overview</h2>
              <div className="space-y-4 sm:space-y-6">
                {/* Executive Summary - above the charts */}
                <Card className="result-card p-4 sm:p-6">
                  <div className="text-foreground/90 leading-relaxed space-y-4">
                    {results.pmScore.summary.split('\n\n').map((block, blockIndex) => {
                      // Check if block contains bullet points
                      if (block.includes('\n•') || block.startsWith('•')) {
                        const lines = block.split('\n');
                        return (
                          <div key={blockIndex} className="space-y-2">
                            {lines.map((line, lineIndex) => {
                              if (line.startsWith('•')) {
                                return (
                                  <div key={lineIndex} className="flex gap-2 pl-1">
                                    <span className="text-primary shrink-0">•</span>
                                    <span>{line.substring(1).trim()}</span>
                                  </div>
                                );
                              }
                              return line.trim() ? <p key={lineIndex}>{line}</p> : null;
                            })}
                          </div>
                        );
                      }
                      // Regular paragraph
                      return block.trim() ? <p key={blockIndex}>{block}</p> : null;
                    })}
                  </div>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <Card className="result-card flex flex-col items-center justify-center p-4 sm:p-8 h-[280px] sm:h-[420px]">
                    <ScoreGauge
                      score={results.pmScore.totalScore}
                      maxScore={results.pmScore.maxScore}
                      grade={results.pmScore.grade}
                      size="lg"
                    />
                  </Card>
                  <Card className="result-card p-4 sm:p-6 h-[280px] sm:h-[420px]">
                    <PMScoreRadarChart pmScore={results.pmScore} />
                  </Card>
                </div>
                {/* Top Strengths & Priority Actions - below charts */}
                <Recommendations
                  pmScore={results.pmScore}
                />
              </div>
            </section>

            {/* Detailed Scores Section */}
            <section>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-medium tracking-tight text-foreground">Deep Dive</h2>
                {expandedDimension && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedDimension(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Collapse all
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-start">
                {/* Ordered by buyer's mental journey: understand → evaluate → decide */}
                {[
                  'productClarity',      // Product — What is it?
                  'audienceSpecificity', // Audience — Who it's for?
                  'problemArticulation', // Problem — What it solves?
                  'trustAndProof',       // Social proof — Why trust you?
                  'outcomeClarity',      // Capabilities — What you get?
                  'differentiation',     // Differentiation — Why you?
                  'productVisualization',// Demo — What it looks like?
                  'pricingClarity',      // Pricing — How much?
                  'riskReduction',       // Objections — What if it fails?
                  'actionClarity',       // CTA — What's next?
                ].map((dimensionId) => {
                  const pmScore = results.pmScore!;
                  const dimension = pmScore.dimensions[dimensionId as keyof typeof pmScore.dimensions];
                  if (!dimension) return null;
                  const scorePercentage = (dimension.score / dimension.maxPoints) * 100;
                  const needsAttention = scorePercentage < 60;
                  return (
                    <DimensionCard
                      key={dimension.id}
                      dimension={dimension}
                      isExpanded={expandedDimension === dimension.id}
                      onToggle={() => setExpandedDimension(expandedDimension === dimension.id ? null : dimension.id)}
                      showPulse={needsAttention}
                    />
                  );
                })}
              </div>
            </section>

            {/* Action Buttons */}
            <section className="pt-4 sm:pt-8">
              <div className="flex flex-col items-center gap-4 sm:gap-6">
                {/* Primary action */}
                <Button onClick={handleExportPDF} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Download analysis
                </Button>

                {/* Share buttons */}
                <div className="flex flex-col items-center gap-2 sm:gap-3 w-full">
                  <span className="text-xs sm:text-sm text-muted-foreground">Share with a colleague</span>
                  <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                    {/* Copy link button - includes score for OG image */}
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-200"
                      onClick={async () => {
                        const shareUrl = 'https://website-grader.genesysgrowth.com/';
                        await navigator.clipboard.writeText(shareUrl);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      aria-label="Copy link"
                    >
                      {linkCopied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                    </button>

                    {/* LinkedIn button */}
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-200"
                      onClick={() => {
                        const shareUrl = 'https://website-grader.genesysgrowth.com/';
                        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=600');
                      }}
                      aria-label="Share on LinkedIn"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </button>

                    {/* X (Twitter) button */}
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-200"
                      onClick={() => {
                        const companyName = new URL(analyzedUrl).hostname.replace('www.', '').split('.')[0];
                        const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
                        const score = results.pmScore?.totalScore || 0;
                        const grade = results.pmScore?.grade || 'N/A';
                        const shareUrl = 'https://website-grader.genesysgrowth.com/';
                        const tweetText = `Just ran ${capitalizedName}'s website through a positioning grader — scored ${score}/100 (Grade ${grade}).\n\nIt analyzes 9 positioning dimensions and gives specific recommendations.\n\nTry it:`;
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400');
                      }}
                      aria-label="Share on X"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </button>

                    {/* Slack button - copies formatted message */}
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-200"
                      onClick={async () => {
                        const companyName = new URL(analyzedUrl).hostname.replace('www.', '').split('.')[0];
                        const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
                        const score = results.pmScore?.totalScore || 0;
                        const grade = results.pmScore?.grade || 'N/A';

                        const slackMessage = `I ran ${capitalizedName}'s website through a positioning grader — scored ${score}/100 (Grade ${grade}). Thought you'd find it interesting!\n\nTry it: https://website-grader.genesysgrowth.com/`;

                        await navigator.clipboard.writeText(slackMessage);
                        setSlackCopied(true);
                        setTimeout(() => setSlackCopied(false), 2000);
                      }}
                      aria-label="Copy for Slack"
                    >
                      {slackCopied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                        </svg>
                      )}
                    </button>

                    {/* Email button */}
                    <button
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-all duration-200"
                      onClick={() => {
                        const companyName = new URL(analyzedUrl).hostname.replace('www.', '').split('.')[0];
                        const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
                        const score = results.pmScore?.totalScore || 0;
                        const grade = results.pmScore?.grade || 'N/A';

                        const subject = `${capitalizedName}'s website positioning — scored ${score}/100`;
                        const body = `Hey,

I ran ${capitalizedName}'s website through a positioning grader and thought you'd find the results interesting.

Score: ${score}/100 (Grade ${grade})

The tool analyzes 9 positioning dimensions — problem articulation, differentiation, social proof, etc. — and gives specific recommendations.

Worth a look: https://website-grader.genesysgrowth.com/

Let me know what you think!`;

                        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      }}
                      aria-label="Share via Email"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex flex-col items-center gap-3 sm:gap-6">
          {/* Book a call CTA */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">Want to dive deeper into your positioning?</p>
            <Button
              variant="outline"
              asChild
              size="sm"
              className="sm:size-default"
            >
              <a
                href="https://cal.com/matteo-titta/30min?layout=month_view&overlayCalendar=true"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a call with Matteo
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap justify-center">
            <Image
              src="/genesys-logo.png"
              alt="Genesys Growth"
              width={20}
              height={20}
              className="rounded logo-spin sm:w-6 sm:h-6"
            />
            <span>Powered by</span>
            <a
              href="https://genesysgrowth.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Genesys Growth
            </a>
            <span className="text-border">|</span>
            <a
              href="https://www.linkedin.com/in/matteo-titta/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      {/* AI Chat Widget - only show when results are available */}
      {isShowingResults && (
        <AIChat pmScore={results.pmScore} websiteUrl={analyzedUrl} />
      )}

      {/* 30-day reminder banner - show on idle state only */}
      {status === 'idle' && !isShowingResults && (
        <ReminderBanner onReanalyze={(url) => handleSubmit(url)} />
      )}
    </div>
  );
}
