import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKitStore } from '../store/useKitStore';
import QuestionCard from '../components/QuestionCard';
import ScheduleView from '../components/ScheduleView';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Pin,
  ExternalLink,
  HelpCircle,
  FileText,
  Layers,
  Sparkles,
  Download,
  Trash2,
  Play,
} from 'lucide-react';
import { Question } from '@zeno/shared';

type BuilderTab =
  | 'brief'
  | 'role'
  | 'technical'
  | 'system-design'
  | 'behavioural'
  | 'company-fit'
  | 'flashcards'
  | 'schedule';

export const KitBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<BuilderTab>('technical');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showAddFlashcardModal, setShowAddFlashcardModal] = useState(false);

  // New Question Form State
  const [newQuestionCategory, setNewQuestionCategory] =
    useState<Question['category']>('technical');
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newQuestionOutline, setNewQuestionOutline] = useState('');
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState<1 | 2 | 3>(2);

  // New Flashcard Form State
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  // Kit Store
  const {
    activeKit,
    status,
    isRegenerating,
    isRegeneratingCategory,
    hasUnsavedChanges,
    errorMessage,
    fetchKit,
    reorderQuestions,
    addQuestion,
    updateCompanyBrief,
    updateRole,
    updateFlashcard,
    deleteFlashcard,
    addFlashcard,
    togglePinFlashcard,
    saveKit,
    regenerateCategory,
  } = useKitStore();

  useEffect(() => {
    if (id) {
      fetchKit(id);
    }
  }, [id, fetchKit]);

  // Handle Drag & Drop reorder
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    reorderQuestions(
      activeTab,
      result.source.index,
      result.destination.index
    );
  };

  // Add Question Submit
  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionPrompt.trim()) return;

    addQuestion({
      category: newQuestionCategory,
      prompt: newQuestionPrompt.trim(),
      answer_outline: newQuestionOutline.trim(),
      difficulty: newQuestionDifficulty,
      requirement_ids: activeKit?.role.requirements.slice(0, 1).map((r) => r.id) || [],
    });

    setNewQuestionPrompt('');
    setNewQuestionOutline('');
    setShowAddQuestionModal(false);
  };

  // Add Flashcard Submit
  const handleCreateFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardFront.trim() || !newCardBack.trim()) return;

    addFlashcard({
      front: newCardFront.trim(),
      back: newCardBack.trim(),
      requirement_ids: [],
    });

    setNewCardFront('');
    setNewCardBack('');
    setShowAddFlashcardModal(false);
  };

  // Export Kit JSON
  const handleExportJson = () => {
    if (!activeKit) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(activeKit, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `${activeKit.source.company.toLowerCase().replace(/\s+/g, '-')}-interview-kit.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (status === 'loading' && !activeKit) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-400">
          Loading interview preparation kit...
        </p>
      </div>
    );
  }

  if (status === 'failed' && !activeKit) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-3.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl inline-block">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Failed to Load Kit</h2>
        <p className="text-sm text-slate-400">{errorMessage || 'Kit not found.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!activeKit) return null;

  // Filter questions by active category tab
  const isQuestionTab = [
    'technical',
    'system-design',
    'behavioural',
    'company-fit',
  ].includes(activeTab);

  const categoryQuestions = isQuestionTab
    ? activeKit.questions.filter((q) => q.category === activeTab)
    : [];

  const pinnedCategoryCount = categoryQuestions.filter((q) => q.isPinned).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-slate-100">
      {/* Builder Subheader / Action Bar */}
      <header className="sticky top-16 z-30 border-b border-slate-800 bg-slate-950/95 sm:bg-slate-900/95 backdrop-blur-xl px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            to="/"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-colors shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <h1
              className="text-sm sm:text-base font-bold text-white truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs md:max-w-sm lg:max-w-md"
              title={activeKit.source.company}
            >
              {activeKit.source.company}
            </h1>
            <span
              className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium truncate max-w-[120px] sm:max-w-[180px] lg:max-w-[220px]"
              title={activeKit.role.title}
            >
              {activeKit.role.title}
            </span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Unsaved
              </span>
            )}
          </div>
        </div>

        {/* Global Save, Practice and Export Actions */}
        <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto">
          <Link
            to={`/kit/${id}/practice`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
            title="Start Interactive Flashcards Practice"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Practice Mode</span>
          </Link>

          <button
            type="button"
            onClick={handleExportJson}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors whitespace-nowrap"
            title="Export full Kit as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => saveKit()}
            disabled={status === 'saving' || !hasUnsavedChanges}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all whitespace-nowrap ${
              status === 'saved'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : hasUnsavedChanges
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                : 'bg-slate-800 text-slate-400 border border-slate-700/60 cursor-not-allowed'
            }`}
          >
            {status === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : status === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Mobile & Tablet Horizontal Navigation Tabs (Visible on < lg screens) */}
      <div className="lg:hidden sticky top-[108px] sm:top-[112px] z-20 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-3 py-2">
        <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          <Link
            to={`/kit/${id}/practice`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="whitespace-nowrap">Practice Mode</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5 font-bold">
              <Play className="w-2 h-2 fill-current" />
              Start
            </span>
          </Link>

          <button
            onClick={() => setActiveTab('brief')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'brief'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Brief</span>
          </button>

          <button
            onClick={() => setActiveTab('role')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'role'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Role</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.role.requirements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('technical')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'technical'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Technical</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.questions.filter((q) => q.category === 'technical').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('system-design')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'system-design'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">System Design</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.questions.filter((q) => q.category === 'system-design').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('behavioural')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'behavioural'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Behavioural</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.questions.filter((q) => q.category === 'behavioural').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('company-fit')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'company-fit'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Company Fit</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.questions.filter((q) => q.category === 'company-fit').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('flashcards')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'flashcards'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="whitespace-nowrap">Flashcards</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.flashcards.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'schedule'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border border-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="whitespace-nowrap">Schedule</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30">
              {activeKit.schedule.days.length}d
            </span>
          </button>
        </nav>
      </div>

      {/* Main Workspace Layout (Sidebar + Content) */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Navigation Sidebar (Desktop only on lg: screens >= 1024px) */}
        <aside className="hidden lg:block lg:col-span-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-3.5 shadow-xl space-y-1 sticky top-36">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Preparation Sections
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('brief')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'brief'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Company Brief</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('role')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'role'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Role & Requirements</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.role.requirements.length}
              </span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Question Modules
            </div>

            <button
              onClick={() => setActiveTab('technical')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'technical'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Technical</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.questions.filter((q) => q.category === 'technical').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('system-design')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'system-design'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">System Design</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.questions.filter((q) => q.category === 'system-design').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('behavioural')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'behavioural'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Behavioural</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.questions.filter((q) => q.category === 'behavioural').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('company-fit')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'company-fit'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Company Fit</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.questions.filter((q) => q.category === 'company-fit').length}
              </span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Study & Revision
            </div>

            <Link
              to={`/kit/${id}/practice`}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all shadow-md group mb-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="whitespace-nowrap font-bold">Practice Mode</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1 shrink-0 ml-1 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Start</span>
              </span>
            </Link>

            <button
              onClick={() => setActiveTab('flashcards')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'flashcards'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="whitespace-nowrap">Flashcards</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.flashcards.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'schedule'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Study Schedule</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 shrink-0 ml-1">
                {activeKit.schedule.days.length}d
              </span>
            </button>
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <main className="w-full lg:col-span-9 space-y-5 sm:space-y-6">
          {/* TAB 1: Company Brief */}
          {activeTab === 'brief' && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-7 backdrop-blur-xl space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 sm:pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                    Company Intelligence Brief
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extracted from automated web crawling & company intelligence
                  </p>
                </div>

                {activeKit.source.company_url && (
                  <a
                    href={activeKit.source.company_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <span>Visit Website</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Company Summary & Culture
                  </label>
                  <textarea
                    rows={4}
                    value={activeKit.company_brief.summary}
                    onChange={(e) =>
                      updateCompanyBrief({ summary: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    What They Do & Engineering Landscape
                  </label>
                  <textarea
                    rows={4}
                    value={activeKit.company_brief.what_they_do}
                    onChange={(e) =>
                      updateCompanyBrief({ what_they_do: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Crawled Verification Sources ({activeKit.company_brief.sources.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeKit.company_brief.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] sm:text-xs text-slate-400 hover:text-blue-400 transition-colors max-w-full"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-[280px]">{src}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Role & Requirements */}
          {activeTab === 'role' && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-7 backdrop-blur-xl space-y-5 sm:space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                    Role Specifications & Prioritized Requirements
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extracted from JD text and mapped directly to interview questions
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Job Title
                  </label>
                  <input
                    type="text"
                    value={activeKit.role.title}
                    onChange={(e) => updateRole({ title: e.target.value })}
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Seniority Level
                  </label>
                  <input
                    type="text"
                    value={activeKit.role.seniority}
                    onChange={(e) => updateRole({ seniority: e.target.value })}
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Requirements List */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Extracted Requirements Matrix
                </h3>
                <div className="space-y-2 sm:space-y-2.5">
                  {activeKit.role.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3 sm:gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold text-xs uppercase border border-blue-500/20">
                            {req.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              req.priority === 'must'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {req.priority}
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase">
                            {req.kind}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-slate-200 pt-1 leading-relaxed">
                          {req.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3-6: Question Categories with Drag & Drop */}
          {isQuestionTab && (
            <div className="space-y-5">
              {/* Category Control Header */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-white capitalize">
                      {activeTab.replace('-', ' ')} Questions
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold">
                      {categoryQuestions.length} Total
                    </span>
                    {pinnedCategoryCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium flex items-center gap-1">
                        <Pin className="w-3 h-3 fill-current" />
                        {pinnedCategoryCount} Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Drag items to reorder priority. Any edit or reorder locks the item from automated regeneration.
                  </p>
                </div>

                {/* Actions: Add Question & Partial Regeneration */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setNewQuestionCategory(activeTab as any);
                      setShowAddQuestionModal(true);
                    }}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => regenerateCategory(activeTab)}
                    disabled={isRegenerating}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                    title="Regenerates only unpinned questions in this category, preserving hand-edited and pinned items"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isRegeneratingCategory === activeTab ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {isRegeneratingCategory === activeTab
                        ? `Regenerating...`
                        : `Regenerate`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Drag Drop Context for Questions List */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={`droppable-${activeTab}`}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {categoryQuestions.length === 0 ? (
                        <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 text-center space-y-3">
                          <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
                          <h3 className="text-sm font-semibold text-white">
                            No {activeTab} questions yet
                          </h3>
                          <p className="text-xs text-slate-400">
                            Click &quot;Add Question&quot; above to write your own, or click &quot;Regenerate&quot; to generate AI questions.
                          </p>
                        </div>
                      ) : (
                        categoryQuestions.map((question, idx) => (
                          <Draggable
                            key={question.id}
                            draggableId={question.id}
                            index={idx}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                              >
                                <QuestionCard
                                  question={question}
                                  index={idx}
                                  requirements={activeKit.role.requirements}
                                  dragHandleProps={dragProvided.dragHandleProps}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          {/* TAB 7: Flashcards */}
          {activeTab === 'flashcards' && (
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Quick Recall Flashcards
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold">
                      {activeKit.flashcards.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Core concepts, architectural trade-offs, and system heuristics
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    to={`/kit/${id}/practice`}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Practice Deck</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShowAddFlashcardModal(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Flashcard</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeKit.flashcards.map((card) => (
                  <div
                    key={card.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 ${
                      card.isPinned
                        ? 'bg-slate-900/80 border-blue-500/40'
                        : 'bg-slate-900/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {card.id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => togglePinFlashcard(card.id)}
                          className={`p-1 rounded text-xs transition-colors ${
                            card.isPinned
                              ? 'text-blue-400'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Toggle pin"
                        >
                          <Pin
                            className={`w-3.5 h-3.5 ${
                              card.isPinned ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFlashcard(card.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Concept / Question (Front)
                      </label>
                      <textarea
                        rows={2}
                        value={card.front}
                        onChange={(e) =>
                          updateFlashcard(card.id, { front: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Answer / Heuristic (Back)
                      </label>
                      <textarea
                        rows={3}
                        value={card.back}
                        onChange={(e) =>
                          updateFlashcard(card.id, { back: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: Study Schedule */}
          {activeTab === 'schedule' && <ScheduleView />}

        </main>
      </div>

      {/* Add Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-white">Add Custom Question</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newQuestionCategory}
                  onChange={(e) =>
                    setNewQuestionCategory(e.target.value as any)
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="technical">Technical</option>
                  <option value="system-design">System Design</option>
                  <option value="behavioural">Behavioural</option>
                  <option value="company-fit">Company Fit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Interview Prompt <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={newQuestionPrompt}
                  onChange={(e) => setNewQuestionPrompt(e.target.value)}
                  placeholder="Enter the question prompt..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Expected Answer Outline
                </label>
                <textarea
                  rows={3}
                  value={newQuestionOutline}
                  onChange={(e) => setNewQuestionOutline(e.target.value)}
                  placeholder="Key concepts, talking points, rubric..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Difficulty (1-3)
                </label>
                <select
                  value={newQuestionDifficulty}
                  onChange={(e) =>
                    setNewQuestionDifficulty(
                      parseInt(e.target.value) as 1 | 2 | 3
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value={1}>1 - Fundamental</option>
                  <option value={2}>2 - Intermediate</option>
                  <option value={3}>3 - Advanced / Senior</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Flashcard Modal */}
      {showAddFlashcardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-white">Add Flashcard</h3>
            <form onSubmit={handleCreateFlashcard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Concept / Question (Front) <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={newCardFront}
                  onChange={(e) => setNewCardFront(e.target.value)}
                  placeholder="e.g. What is Idempotency in distributed systems?"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Definition / Heuristic (Back) <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={newCardBack}
                  onChange={(e) => setNewCardBack(e.target.value)}
                  placeholder="Explanation of the concept..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFlashcardModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
                >
                  Add Flashcard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitBuilder;
