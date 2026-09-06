import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useKitStore } from '../store/useKitStore';
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  AlertCircle,
  Zap,
  Flame,
  ThumbsUp,
  Award,
  BookOpen,
} from 'lucide-react';

export const PracticeMode: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    activeKit,
    kitId,
    status,
    fetchKit,
    flashcardProgress,
    recordConfidence,
    getSortedFlashcards,
  } = useKitStore();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [sessionRatings, setSessionRatings] = useState<Record<string, number>>({});

  // Ensure kit is loaded
  useEffect(() => {
    if (id && (!activeKit || kitId !== id)) {
      fetchKit(id);
    }
  }, [id, activeKit, kitId, fetchKit]);

  // Derived sorted flashcards (using store's spaced repetition priority logic)
  const sortedCards = getSortedFlashcards();
  const totalCards = sortedCards.length;
  const currentCard = sortedCards[currentIndex];
  const isCompleted = totalCards > 0 && currentIndex >= totalCards;

  // Handle Confidence Score Selection
  const handleRate = useCallback(
    (score: 1 | 2 | 3) => {
      if (!currentCard) return;

      // Record in global store
      recordConfidence(currentCard.id, score);

      // Record in current session metrics
      setSessionRatings((prev) => ({
        ...prev,
        [currentCard.id]: score,
      }));

      // Flip back and advance to next card
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    },
    [currentCard, recordConfidence]
  );

  // Restart Session (re-sorts cards with latest confidence ratings)
  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionRatings({});
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (isCompleted) {
        if (e.key === 'r' || e.key === 'R') {
          handleRestart();
        }
        return;
      }

      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsFlipped(true);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleRate(1);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate(2);
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate(3);
        } else if (e.key === ' ' || e.key === 'ArrowUp') {
          e.preventDefault();
          setIsFlipped(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isCompleted, handleRate, handleRestart]);

  if (status === 'loading' && !activeKit) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
        </div>
        <p className="text-sm font-medium text-slate-400">Loading Practice Mode...</p>
      </div>
    );
  }

  if (!activeKit) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <h2 className="text-xl font-bold text-white">Kit Not Found</h2>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (totalCards === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-4 text-slate-100">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl inline-block text-amber-400">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">No Flashcards in this Kit</h2>
        <p className="text-sm text-slate-400 max-w-md">
          This kit doesn&apos;t have any flashcards generated yet. Add flashcards in the Kit Builder to start practicing.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/kit/${id}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Kit Builder</span>
        </button>
      </div>
    );
  }

  // Session Statistics Calculation
  const hardCount = Object.values(sessionRatings).filter((s) => s === 1).length;
  const goodCount = Object.values(sessionRatings).filter((s) => s === 2).length;
  const easyCount = Object.values(sessionRatings).filter((s) => s === 3).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-black">
      {/* Top Header & Progress */}
      <header className="border-b border-slate-800 bg-slate-950/95 sm:bg-slate-900/95 backdrop-blur-xl px-3 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sticky top-16 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/kit/${id}`)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-colors shrink-0"
            title="Exit Practice Mode"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                Practice Mode
              </span>
              <span className="text-slate-600 hidden xs:inline">•</span>
              <span className="text-xs font-medium text-slate-300 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">
                {activeKit.source.company} ({activeKit.role.title})
              </span>
            </div>
          </div>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-[11px] sm:text-xs font-mono font-semibold text-slate-300">
              Card <span className="text-amber-400 font-bold">{currentIndex + 1}</span> of{' '}
              <span className="text-white">{totalCards}</span>
            </div>
            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Restart session"
            >
              <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Progress Track at top */}
      {!isCompleted && (
        <div className="h-1.5 w-full bg-slate-900 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ease-out"
            style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
          />
        </div>
      )}

      {/* Main Flashcard Arena */}
      <main className="flex-1 flex items-center justify-center p-3.5 sm:p-8 max-w-4xl w-full mx-auto">
        {isCompleted ? (
          /* Session Completed Celebration Screen */
          <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-10 backdrop-blur-2xl text-center space-y-5 sm:space-y-6 shadow-2xl animate-fadeIn">
            <div className="relative inline-block">
              <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-2xl sm:rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                <Trophy className="w-8 sm:w-10 h-8 sm:h-10 animate-bounce" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-lg">
                ✓
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Session Complete! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                You reviewed all {totalCards} flashcards in this deck.
              </p>
            </div>

            {/* Performance Breakdown */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
              <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <div className="text-rose-400 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1">
                  <Flame className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  Hard (1)
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1">
                  {hardCount}
                </div>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-amber-400 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1">
                  <ThumbsUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  Good (2)
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1">
                  {goodCount}
                </div>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-emerald-400 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1">
                  <Zap className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  Easy (3)
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1">
                  {easyCount}
                </div>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800">
              💡 Spaced repetition will prioritize cards marked <strong className="text-rose-400">Hard</strong> and unseen cards first in your next practice session.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span>Restart Session</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/kit/${id}`)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span>Back to Kit Builder</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Flashcard View */
          <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
            {/* The Flashcard */}
            <div
              className={`relative rounded-2xl sm:rounded-3xl p-5 sm:p-10 border transition-all duration-300 shadow-2xl flex flex-col justify-between min-h-[300px] sm:min-h-[360px] cursor-pointer select-none ${
                isFlipped
                  ? 'bg-slate-900/90 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => {
                if (!isFlipped) setIsFlipped(true);
              }}
            >
              {/* Card Header Tag */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full border ${
                      isFlipped
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {isFlipped ? 'Answer / Heuristic' : 'Concept / Question'}
                  </span>

                  {/* Previous Score Badge if exists */}
                  {flashcardProgress[currentCard.id] && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      Prior: Score {flashcardProgress[currentCard.id]}
                    </span>
                  )}
                </div>

                <span className="text-[10px] sm:text-xs font-mono text-slate-500">
                  {currentCard.id}
                </span>
              </div>

              {/* Card Body */}
              <div className="my-auto py-4 sm:py-8 text-center">
                {!isFlipped ? (
                  /* FRONT */
                  <div className="space-y-4">
                    <h3 className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
                      {currentCard.front}
                    </h3>
                  </div>
                ) : (
                  /* BACK */
                  <div className="space-y-3 sm:space-y-4 text-left">
                    <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Answer & Explanation
                    </div>
                    <p className="text-sm sm:text-lg text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {currentCard.back}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer Action / Status */}
              <div className="border-t border-slate-800/80 pt-3 sm:pt-4 flex items-center justify-between text-xs text-slate-400">
                {!isFlipped ? (
                  <div className="w-full flex items-center justify-between">
                    <span className="text-slate-500 hidden sm:inline text-xs">
                      Click card or press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">Space</kbd>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                      className="w-full sm:w-auto ml-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Show Answer</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      ← Flip Back
                    </button>
                    <span className="text-slate-500 text-[11px] hidden sm:inline">
                      Rate confidence below to continue
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Confidence Buttons (Only visible when flipped) */}
            {isFlipped && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 sm:p-4 backdrop-blur-xl space-y-2.5 sm:space-y-3 animate-fadeIn">
                <div className="text-center text-[11px] sm:text-xs font-semibold text-slate-400">
                  How well did you know this concept?
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Hard Button (1) */}
                  <button
                    type="button"
                    onClick={() => handleRate(1)}
                    className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 transition-all font-semibold text-[11px] sm:text-xs active:scale-95 group"
                  >
                    <Flame className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    <span>Hard (1)</span>
                    <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-rose-950 text-rose-300 text-[10px] rounded border border-rose-800 font-mono">
                      1
                    </kbd>
                  </button>

                  {/* Good Button (2) */}
                  <button
                    type="button"
                    onClick={() => handleRate(2)}
                    className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all font-semibold text-[11px] sm:text-xs active:scale-95 group"
                  >
                    <ThumbsUp className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Good (2)</span>
                    <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-amber-950 text-amber-300 text-[10px] rounded border border-amber-800 font-mono">
                      2
                    </kbd>
                  </button>

                  {/* Easy Button (3) */}
                  <button
                    type="button"
                    onClick={() => handleRate(3)}
                    className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition-all font-semibold text-[11px] sm:text-xs active:scale-95 group"
                  >
                    <Zap className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Easy (3)</span>
                    <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-emerald-950 text-emerald-300 text-[10px] rounded border border-emerald-800 font-mono">
                      3
                    </kbd>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PracticeMode;
