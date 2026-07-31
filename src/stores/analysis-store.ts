import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AnalysisState, AnalysisStatus, PMScoreResult, CompetitorResult } from '@/types/analysis';

interface AnalysisStore extends AnalysisState {
  // Actions
  setMainUrl: (url: string) => void;
  setCompetitorUrls: (urls: string[]) => void;
  addCompetitorUrl: (url: string) => void;
  removeCompetitorUrl: (index: number) => void;
  setStatus: (status: AnalysisStatus) => void;
  setProgress: (step: number, totalSteps: number, message: string) => void;
  setPMScore: (pmScore: PMScoreResult) => void;
  setCompetitors: (competitors: CompetitorResult) => void;
  setError: (error: string) => void;
  setReportId: (reportId: string) => void;
  setSlug: (slug: string) => void;
  setAnalyzedAt: () => void; // Sets current timestamp
  reset: () => void;
  // Pending analysis flag (for auto-start after auth redirect)
  pendingAnalysis: boolean;
  setPendingAnalysis: (pending: boolean) => void;
  // History management for back navigation
  analysisHistory: AnalysisState[];
  saveToHistory: () => void;
  restoreFromHistory: (index: number) => void;
  clearHistory: () => void;
  // Reminder management
  getReminderDue: () => AnalysisState | null; // Returns entry that needs re-analysis (30+ days old)
  dismissReminder: (url: string) => void;
}

const initialState: AnalysisState = {
  status: 'idle',
  mainUrl: '',
  competitorUrls: [],
  progress: {
    step: 0,
    totalSteps: 5,
    message: '',
    percentage: 0,
  },
  results: {
    pmScore: null,
    competitors: null,
  },
  error: null,
  reportId: null,
  slug: null,
  analyzedAt: null,
};

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      analysisHistory: [],
      pendingAnalysis: false,

      setMainUrl: (url) => set({ mainUrl: url }),

      setCompetitorUrls: (urls) => set({ competitorUrls: urls }),

      addCompetitorUrl: (url) =>
        set((state) => ({
          competitorUrls: [...state.competitorUrls, url],
        })),

      removeCompetitorUrl: (index) =>
        set((state) => ({
          competitorUrls: state.competitorUrls.filter((_, i) => i !== index),
        })),

      setStatus: (status) => set({ status }),

      setProgress: (step, totalSteps, message) =>
        set({
          progress: {
            step,
            totalSteps,
            message,
            percentage: Math.round((step / totalSteps) * 100),
          },
        }),

      setPMScore: (pmScore) =>
        set((state) => ({
          results: { ...state.results, pmScore },
        })),

      setCompetitors: (competitors) =>
        set((state) => ({
          results: { ...state.results, competitors },
        })),

      setError: (error) => set({ error, status: 'error' }),

      setReportId: (reportId) => set({ reportId }),

      setSlug: (slug) => set({ slug }),

      setPendingAnalysis: (pending) => set({ pendingAnalysis: pending }),

      setAnalyzedAt: () => set({ analyzedAt: new Date().toISOString() }),

      reset: () => {
        // Save current analysis to history before resetting (if there are results)
        const state = get();
        if (state.results.pmScore && state.status === 'complete') {
          const historyEntry: AnalysisState = {
            status: state.status,
            mainUrl: state.mainUrl,
            competitorUrls: state.competitorUrls,
            progress: state.progress,
            results: state.results,
            error: state.error,
            reportId: state.reportId,
            slug: state.slug,
            analyzedAt: state.analyzedAt || new Date().toISOString(),
          };
          set((state) => ({
            ...initialState,
            analysisHistory: [historyEntry, ...state.analysisHistory.filter(
              (h) => h.mainUrl !== historyEntry.mainUrl
            )].slice(0, 10),
          }));
        } else {
          set(initialState);
        }
      },

      saveToHistory: () => {
        const state = get();
        if (state.results.pmScore && state.status === 'complete') {
          const historyEntry: AnalysisState = {
            status: state.status,
            mainUrl: state.mainUrl,
            competitorUrls: state.competitorUrls,
            progress: state.progress,
            results: state.results,
            error: state.error,
            reportId: state.reportId,
            slug: state.slug,
            analyzedAt: state.analyzedAt || new Date().toISOString(),
          };
          set((state) => ({
            analysisHistory: [historyEntry, ...state.analysisHistory.filter(
              (h) => h.mainUrl !== historyEntry.mainUrl
            )].slice(0, 10),
          }));
        }
      },

      restoreFromHistory: (index) => {
        const state = get();
        const historyEntry = state.analysisHistory[index];
        if (historyEntry) {
          set({
            ...historyEntry,
            analysisHistory: state.analysisHistory,
          });
        }
      },

      clearHistory: () => set({ analysisHistory: [] }),

      getReminderDue: () => {
        const state = get();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Check history for entries older than 30 days
        for (const entry of state.analysisHistory) {
          if (entry.analyzedAt) {
            const analyzedDate = new Date(entry.analyzedAt);
            if (analyzedDate < thirtyDaysAgo) {
              // Check if reminder was dismissed
              const dismissedReminders = JSON.parse(localStorage.getItem('dismissed-reminders') || '[]');
              if (!dismissedReminders.includes(entry.mainUrl)) {
                return entry;
              }
            }
          }
        }
        return null;
      },

      dismissReminder: (url: string) => {
        const dismissedReminders = JSON.parse(localStorage.getItem('dismissed-reminders') || '[]');
        if (!dismissedReminders.includes(url)) {
          dismissedReminders.push(url);
          localStorage.setItem('dismissed-reminders', JSON.stringify(dismissedReminders));
        }
      },
    }),
    {
      name: 'website-grader-analysis',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist completed analyses, in-progress state, and history
        // Reset in-progress statuses to idle on reload (user can restart analysis)
        status: ['idle', 'complete', 'error'].includes(state.status) ? state.status : 'idle',
        mainUrl: state.mainUrl,
        competitorUrls: state.competitorUrls,
        progress: state.status === 'complete' ? state.progress : initialState.progress,
        results: state.results, // Always persist results (even partial)
        error: null,
        reportId: state.reportId,
        slug: state.slug,
        analyzedAt: state.analyzedAt,
        pendingAnalysis: state.pendingAnalysis,
        analysisHistory: state.analysisHistory.filter(
          (entry, index, arr) => arr.findIndex((e) => e.mainUrl === entry.mainUrl) === index
        ),
      }),
    }
  )
);
