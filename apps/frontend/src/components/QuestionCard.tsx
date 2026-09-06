import React from 'react';
import { Question, Requirement } from '@zeno/shared';
import { useKitStore } from '../store/useKitStore';
import {
  GripVertical,
  Pin,
  Trash2,
  Tag,
  Star,
  CheckCircle2,
} from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  index: number;
  requirements?: Requirement[];
  dragHandleProps?: any;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  requirements = [],
  dragHandleProps,
}) => {
  const { updateQuestion, deleteQuestion, togglePinQuestion } = useKitStore();

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateQuestion(question.id, { prompt: e.target.value });
  };

  const handleOutlineChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateQuestion(question.id, { answer_outline: e.target.value });
  };

  const handleDifficultyChange = (difficulty: number) => {
    updateQuestion(question.id, { difficulty: difficulty as 1 | 2 | 3 });
  };

  const handleCategoryChange = (category: string) => {
    updateQuestion(question.id, {
      category: category as Question['category'],
    });
  };

  // Find mapped requirements for display
  const mappedReqs = requirements.filter((r) =>
    question.requirement_ids?.includes(r.id)
  );

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 ${
        question.isPinned
          ? 'bg-slate-900/80 border-blue-500/40 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/20'
          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70'
      }`}
    >
      {/* Top Card Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800/60 bg-slate-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <span className="text-xs font-mono font-bold text-slate-400">
            #{index + 1}
          </span>

          {/* Category Dropdown */}
          <select
            value={question.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="technical">Technical</option>
            <option value="system-design">System Design</option>
            <option value="behavioural">Behavioural</option>
            <option value="company-fit">Company Fit</option>
          </select>

          {/* Difficulty Rating Selector */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 border border-slate-800 px-1.5 sm:px-2 py-0.5 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-0.5 sm:mr-1">
              Diff:
            </span>
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleDifficultyChange(level)}
                className={`p-0.5 rounded text-xs transition-colors ${
                  question.difficulty >= level
                    ? 'text-amber-400'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
                title={`Difficulty ${level}/3`}
              >
                <Star className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-current" />
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Pin State Button */}
          <button
            type="button"
            onClick={() => togglePinQuestion(question.id)}
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              question.isPinned
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
            }`}
            title={
              question.isPinned
                ? 'Pinned: Protected from automatic regeneration'
                : 'Click to pin and protect from regeneration'
            }
          >
            <Pin
              className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${
                question.isPinned ? 'fill-current text-blue-400' : ''
              }`}
            />
            <span className="text-[10px] sm:text-[11px]">
              {question.isPinned ? 'Pinned' : 'Pin'}
            </span>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => deleteQuestion(question.id)}
            className="p-1 sm:p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Delete Question"
          >
            <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Card Body with Editable Fields */}
      <div className="p-5 space-y-4">
        {/* Question Prompt Field */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Interview Prompt</span>
            <span className="text-[10px] text-slate-500 font-mono">
              Directly editable • Auto-pins on edit
            </span>
          </label>
          <textarea
            rows={3}
            value={question.prompt}
            onChange={handlePromptChange}
            placeholder="Write interview prompt question here..."
            className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800/90 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-sans leading-relaxed transition-all resize-y"
          />
        </div>

        {/* Answer Outline & Evaluation Rubric */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Expected Answer Outline & Scoring Rubric</span>
          </label>
          <textarea
            rows={3}
            value={question.answer_outline}
            onChange={handleOutlineChange}
            placeholder="Key talking points, STAR method breakdown, algorithms, and evaluation metrics..."
            className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800/90 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-sans leading-relaxed transition-all resize-y"
          />
        </div>

        {/* Mapped Requirement Tags */}
        {mappedReqs.length > 0 && (
          <div className="pt-2 border-t border-slate-800/50 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Tests:
            </span>
            {mappedReqs.map((req) => (
              <span
                key={req.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                title={req.text}
              >
                <span className="uppercase text-blue-400 font-bold">{req.id}</span>
                <span className="max-w-[150px] truncate">{req.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionCard;
