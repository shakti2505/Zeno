import React, { useState } from 'react';
import { useKitStore } from '../store/useKitStore';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Building2,
  Award,
  Check,
} from 'lucide-react';
import { Question } from '@zeno/shared';

export const ScheduleView: React.FC = () => {
  const { activeKit, completedQuestions, toggleQuestionCompleted } = useKitStore();
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  if (!activeKit || !activeKit.schedule || !activeKit.schedule.days) {
    return (
      <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
        <p className="text-sm text-slate-400">No schedule available for this kit.</p>
      </div>
    );
  }

  const { days, days_available } = activeKit.schedule;
  const allQuestions = activeKit.questions;

  // Helper to lookup a Question object by ID
  const getQuestionById = (id: string): Question | undefined => {
    return allQuestions.find((q) => q.id === id);
  };

  // Calculate overall statistics
  const totalScheduleQuestions = days.reduce(
    (acc, day) => acc + day.question_ids.length,
    0
  );

  const completedCount = days.reduce((acc, day) => {
    const dayCompleted = day.question_ids.filter(
      (qId) => completedQuestions[qId]
    ).length;
    return acc + dayCompleted;
  }, 0);

  const totalMinutes = days.reduce((acc, day) => acc + (day.minutes || 0), 0);
  const completionPercentage =
    totalScheduleQuestions > 0
      ? Math.round((completedCount / totalScheduleQuestions) * 100)
      : 0;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical':
        return <HelpCircle className="w-3.5 h-3.5 text-blue-400" />;
      case 'system-design':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'behavioural':
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
      case 'company-fit':
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getDifficultyBadge = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Lvl 1 (Easy)
          </span>
        );
      case 2:
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Lvl 2 (Med)
          </span>
        );
      case 3:
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
            Lvl 3 (Hard)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Schedule Header & Metrics Summary */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-xl space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-4 sm:pb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
              <span>Deterministic Study Schedule</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                {days_available} Days
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Prioritized preparation roadmap with hard and must-have requirements sequenced first
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Total: {totalMinutes} mins</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{completedCount} / {totalScheduleQuestions} Completed</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Schedule Completion Progress</span>
            <span className="font-mono font-bold text-emerald-400">{completionPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline of Days */}
      <div className="space-y-4">
        {days.map((day) => {
          const dayQuestions = day.question_ids
            .map((qId) => getQuestionById(qId))
            .filter((q): q is Question => Boolean(q));

          const dayCompletedCount = day.question_ids.filter(
            (qId) => completedQuestions[qId]
          ).length;
          const isDayFullyComplete =
            day.question_ids.length > 0 &&
            dayCompletedCount === day.question_ids.length;

          return (
            <div
              key={day.day}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isDayFullyComplete
                  ? 'bg-slate-900/40 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-900/60 border-slate-800/80'
              }`}
            >
              {/* Day Header Banner */}
              <div className="p-5 sm:p-6 bg-slate-950/40 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-colors ${
                      isDayFullyComplete
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {isDayFullyComplete ? (
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      `D${day.day}`
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">
                        Day {day.day}: {day.focus}
                      </h3>
                      {isDayFullyComplete && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Complete
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {day.minutes} minutes allocated
                      </span>
                      <span>•</span>
                      <span>{day.question_ids.length} target questions</span>
                    </div>
                  </div>
                </div>

                {/* Day Progress Indicator */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-medium text-slate-400">
                    {dayCompletedCount} / {day.question_ids.length}
                  </span>
                  <div className="w-20 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${
                          day.question_ids.length > 0
                            ? (dayCompletedCount / day.question_ids.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Day Questions Checklist */}
              <div className="p-5 sm:p-6 space-y-3">
                {dayQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No questions scheduled for this day.
                  </p>
                ) : (
                  dayQuestions.map((q) => {
                    const isCompleted = Boolean(completedQuestions[q.id]);
                    const isExpanded = expandedQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl border transition-all duration-150 ${
                          isCompleted
                            ? 'bg-slate-950/40 border-slate-800/60 opacity-75'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700/80'
                        }`}
                      >
                        <div className="p-3.5 flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleQuestionCompleted(q.id)}
                            className="mt-0.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5 transition-transform active:scale-90"
                            title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>

                          {/* Question Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-xs font-semibold leading-relaxed transition-colors ${
                                  isCompleted
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-100'
                                }`}
                              >
                                {q.prompt}
                              </p>

                              {/* Toggle Outline Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedQuestionId(
                                    isExpanded ? null : q.id
                                  )
                                }
                                className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors shrink-0"
                                title="Toggle expected answer outline"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                {getCategoryIcon(q.category)}
                                {q.category}
                              </span>
                              {getDifficultyBadge(q.difficulty)}
                              {q.isPinned && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                  Pinned
                                </span>
                              )}
                            </div>

                            {/* Expandable Expected Outline */}
                            {isExpanded && (
                              <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1.5 animate-fadeIn">
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-amber-400" />
                                  Expected Answer Rubric
                                </div>
                                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                                  {q.answer_outline ||
                                    'No answer outline provided for this question.'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleView;
