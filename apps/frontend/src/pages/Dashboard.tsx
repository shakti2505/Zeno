import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Kit as KitPayload } from '@zeno/shared';
import {
  Sparkles,
  Building2,
  Calendar,
  FileText,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Layers,
  Search,
} from 'lucide-react';

export interface KitItem {
  _id: string;
  userId?: string;
  status: 'generating' | 'completed' | 'failed';
  data?: KitPayload | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const SAMPLE_JDS = [
  {
    label: 'Stripe (Backend)',
    companyUrl: 'https://stripe.com',
    days: 3,
    text: `Position: Senior Backend Engineer at Stripe\nResponsibilities:\n- Build robust payment APIs, scaling real-time distributed transaction systems.\n- Work cross-functionally with risk, security, and treasury teams.\n\nRequirements:\n- 5+ years experience in distributed systems and transaction processing.\n- Strong mastery of SQL/NoSQL databases, data modeling, and performance tuning.\n- Excellent communication and system design trade-off evaluation.`,
  },
  {
    label: 'Airbnb (Full Stack)',
    companyUrl: 'https://airbnb.com',
    days: 4,
    text: `Position: Senior Full Stack Engineer at Airbnb\nResponsibilities:\n- Build performant, accessible guest search and booking experiences.\n- Design and maintain Node.js / GraphQL backend microservices.\n\nRequirements:\n- 5+ years of full-stack web development experience with TypeScript & React.\n- Deep understanding of Core Web Vitals, responsive design, and caching.\n- Proven collaborative communication in fast-paced product environments.`,
  },
];

export const Dashboard: React.FC = () => {
  // Form State
  const [jobDescription, setJobDescription] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Kits State
  const [kits, setKits] = useState<KitItem[]>([]);
  const [isLoadingKits, setIsLoadingKits] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Active Polling Reference
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 1. Fetch all existing kits on mount
  const fetchKits = useCallback(async () => {
    try {
      setFetchError(null);
      const response = await api.get('/kits');
      const fetchedKits = response.data?.data?.kits || [];
      setKits(fetchedKits);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load your interview kits.');
    } finally {
      setIsLoadingKits(false);
    }
  }, []);

  useEffect(() => {
    fetchKits();
  }, [fetchKits]);

  // 2. Poll status for a single kit until completed or failed
  const pollKitStatus = useCallback((kitId: string) => {
    // If already polling this kit, don't duplicate
    if (pollingIntervals.current.has(kitId)) return;

    console.log(`[Polling] Started polling status for Kit ID: ${kitId}`);

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/kits/${kitId}`);
        const updatedKit: KitItem = response.data?.data?.kit;

        if (updatedKit) {
          setKits((prevKits) =>
            prevKits.map((k) => (k._id === kitId ? { ...k, ...updatedKit } : k))
          );

          if (updatedKit.status === 'completed' || updatedKit.status === 'failed') {
            console.log(`[Polling] Kit ID ${kitId} reached terminal state: ${updatedKit.status}`);
            clearInterval(interval);
            pollingIntervals.current.delete(kitId);
          }
        }
      } catch (err) {
        console.warn(`[Polling] Failed to fetch kit status for ${kitId}:`, err);
      }
    }, 4000);

    pollingIntervals.current.set(kitId, interval);
  }, []);

  // 3. Trigger polling for any generating kits in state
  useEffect(() => {
    kits.forEach((kit) => {
      if (kit.status === 'generating') {
        pollKitStatus(kit._id);
      }
    });

    // Clean up intervals on unmount
    return () => {
      pollingIntervals.current.forEach((interval) => clearInterval(interval));
      pollingIntervals.current.clear();
    };
  }, [kits, pollKitStatus]);

  // 4. Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!jobDescription.trim()) {
      setFormError('Job Description is required. Please paste the job description text.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        jobDescription: jobDescription.trim(),
        companyUrl: companyUrl.trim() || undefined,
        days: Math.max(1, Number(days) || 3),
      };

      const response = await api.post('/kits', payload);
      const newKitResult = response.data?.data;

      if (newKitResult && newKitResult._id) {
        const placeholderKit: KitItem = {
          _id: newKitResult._id,
          status: newKitResult.status || 'generating',
          createdAt: newKitResult.createdAt || new Date().toISOString(),
          data: null,
          errorMessage: null,
        };

        // Add to top of local list immediately
        setKits((prev) => [placeholderKit, ...prev]);

        // Start active polling
        pollKitStatus(newKitResult._id);

        // Reset form inputs
        setJobDescription('');
        setCompanyUrl('');
        setDays(3);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit interview kit generation job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Delete Kit Handler
  const handleDeleteKit = async (kitId: string) => {
    if (!confirm('Are you sure you want to delete this interview preparation kit?')) return;

    try {
      await api.delete(`/kits/${kitId}`);
      // Remove from polling if active
      if (pollingIntervals.current.has(kitId)) {
        clearInterval(pollingIntervals.current.get(kitId)!);
        pollingIntervals.current.delete(kitId);
      }
      setKits((prev) => prev.filter((k) => k._id !== kitId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete kit.');
    }
  };

  // Helper to extract company name from URL or Kit data
  const getDisplayCompanyName = (kit: KitItem): string => {
    if (kit.data?.source?.company) return kit.data.source.company;
    if (kit.data?.role?.title) return kit.data.role.title;
    return 'Target Company';
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-10">
      {/* Top Banner */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Interview Preparation Copilot</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
          Create & Manage Preparation Kits
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-3xl leading-relaxed">
          Paste any job description to automatically research company context, extract core requirements, generate targeted interview questions & flashcards, and build an optimized daily study schedule.
        </p>
      </div>

      {/* Main Grid: Form (Left) & Kits List (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Generator Form Section */}
        <div className="lg:col-span-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 sm:p-7 shadow-xl shadow-black/40 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-4 sm:w-5 h-4 sm:h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">Generate New Kit</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">Powered by LangGraph Multi-Node AI Workflow</p>
              </div>
            </div>

            {/* Quick Sample Loaders */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
              <span className="text-[11px]">Demo:</span>
              {SAMPLE_JDS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setJobDescription(sample.text);
                    setCompanyUrl(sample.companyUrl);
                    setDays(sample.days);
                    setFormError(null);
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] sm:text-[11px] font-medium transition-colors border border-slate-700"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Job Description Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Job Description Text <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                  {jobDescription.length} chars
                </span>
              </div>
              <textarea
                required
                rows={7}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description text here (e.g. responsibilities, technical requirements, role expectations)..."
                className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 font-sans leading-relaxed transition-all resize-y"
              />
            </div>

            {/* URL and Days Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Target Company URL
                </label>
                <input
                  type="url"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://company.com (optional)"
                  className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Days to Prepare
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 sm:py-3 px-5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enqueuing Pipeline Job...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Interview Kit</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Kits List Section */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
              Your Interview Kits
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {kits.length}
              </span>
            </h2>

            <button
              onClick={fetchKits}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              Refresh
            </button>
          </div>

          {fetchError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {isLoadingKits ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-7 sm:w-8 h-7 sm:h-8 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading your interview kits...</p>
            </div>
          ) : kits.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-full bg-slate-800/50 text-slate-400">
                <Search className="w-5 sm:w-6 h-5 sm:h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No interview kits generated yet</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Paste a job description on the left to start your first multi-stage preparation kit.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {kits.map((kit) => {
                const companyName = getDisplayCompanyName(kit);
                const roleTitle = kit.data?.role?.title || 'Software Engineering Role';
                const questionCount = kit.data?.questions?.length || 0;
                const flashcardCount = kit.data?.flashcards?.length || 0;
                const scheduleDaysCount = kit.data?.schedule?.days?.length || 0;

                return (
                  <div
                    key={kit._id}
                    className={`p-4 sm:p-5 rounded-xl border transition-all duration-300 ${
                      kit.status === 'generating'
                        ? 'bg-slate-900/90 border-blue-500/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                        : kit.status === 'completed'
                        ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                        : 'bg-red-950/20 border-red-800/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      {/* Left Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-[240px]">
                            {companyName}
                          </span>

                          {/* Status Badge */}
                          {kit.status === 'generating' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                              Generating Kit...
                            </span>
                          )}

                          {kit.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready
                            </span>
                          )}

                          {kit.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 font-medium truncate">
                          {roleTitle}
                        </p>

                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-400 font-mono flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(kit.createdAt).toLocaleDateString()}
                          </span>

                          {kit.status === 'completed' && (
                            <>
                              <span>•</span>
                              <span className="text-blue-400 font-medium">
                                {questionCount} questions
                              </span>
                              <span>•</span>
                              <span className="text-indigo-400 font-medium">
                                {flashcardCount} cards
                              </span>
                              <span>•</span>
                              <span className="text-emerald-400 font-medium">
                                {scheduleDaysCount} days
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-start shrink-0">
                        {kit.status === 'completed' && (
                          <>
                            <Link
                              to={`/kit/${kit._id}/practice`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm transition-all"
                              title="Start Practice Mode"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden xs:inline">Practice</span>
                            </Link>

                            <Link
                              to={`/kit/${kit._id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all group"
                            >
                              <span>View Kit</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                          </>
                        )}

                        {kit.status === 'generating' && (
                          <div className="p-2 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/40">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteKit(kit._id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Delete Kit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress feedback for generating state */}
                    {kit.status === 'generating' && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-[11px] text-blue-300/90 mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            AI agents researching company, extracting requirements, and building kit...
                          </span>
                          <span className="font-mono">Live</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse w-3/4"></div>
                        </div>
                      </div>
                    )}

                    {/* Error display for failed state */}
                    {kit.status === 'failed' && kit.errorMessage && (
                      <div className="mt-2.5 pt-2.5 border-t border-red-900/30 text-[11px] text-red-400 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{kit.errorMessage}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
