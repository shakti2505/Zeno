import { create } from 'zustand';
import api from '../lib/api';
import {
  Kit,
  Question,
  Flashcard,
  CompanyBrief,
  Role,
  KitSchema,
} from '@zeno/shared';

interface KitState {
  activeKit: Kit | null;
  kitId: string | null;
  status: 'idle' | 'loading' | 'saving' | 'saved' | 'failed';
  isRegenerating: boolean;
  isRegeneratingCategory: string | null;
  hasUnsavedChanges: boolean;
  errorMessage: string | null;
  flashcardProgress: Record<string, number>;
  completedQuestions: Record<string, boolean>;

  // Actions
  fetchKit: (id: string) => Promise<void>;
  setKit: (kit: Kit, id?: string, progress?: Record<string, number>) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  addQuestion: (question: Omit<Question, 'id'> & { id?: string }) => void;
  reorderQuestions: (
    category: string,
    sourceIndex: number,
    destinationIndex: number
  ) => void;
  togglePinQuestion: (id: string) => void;
  updateCompanyBrief: (updates: Partial<CompanyBrief>) => void;
  updateRole: (updates: Partial<Role>) => void;
  updateFlashcard: (id: string, updates: Partial<Flashcard>) => void;
  deleteFlashcard: (id: string) => void;
  addFlashcard: (flashcard: Omit<Flashcard, 'id'> & { id?: string }) => void;
  togglePinFlashcard: (id: string) => void;
  saveKit: () => Promise<void>;
  regenerateCategory: (category: string) => Promise<void>;

  // Practice & Progress Actions
  recordConfidence: (flashcardId: string, score: number) => Promise<void>;
  getSortedFlashcards: () => Flashcard[];
  resetPracticeProgress: () => void;
  toggleQuestionCompleted: (questionId: string) => void;
}

export const useKitStore = create<KitState>((set, get) => ({
  activeKit: null,
  kitId: null,
  status: 'idle',
  isRegenerating: false,
  isRegeneratingCategory: null,
  hasUnsavedChanges: false,
  errorMessage: null,
  flashcardProgress: {},
  completedQuestions: {},

  fetchKit: async (id: string) => {
    set({ status: 'loading', errorMessage: null, kitId: id });
    try {
      const response = await api.get(`/kits/${id}`);
      const kitDoc = response.data?.data?.kit;
      if (!kitDoc) {
        throw new Error('Kit not found');
      }

      if (kitDoc.status === 'failed') {
        set({
          status: 'failed',
          errorMessage: kitDoc.errorMessage || 'Kit generation failed.',
        });
        return;
      }

      const parsedKit = KitSchema.parse(kitDoc.data);
      const serverProgress = kitDoc.flashcardProgress || {};
      set({
        activeKit: parsedKit,
        kitId: id,
        flashcardProgress: serverProgress,
        status: 'idle',
        hasUnsavedChanges: false,
      });
    } catch (err: any) {
      set({
        status: 'failed',
        errorMessage: err.message || 'Failed to fetch kit details.',
      });
    }
  },

  setKit: (kit: Kit, id?: string, progress?: Record<string, number>) => {
    set((state) => ({
      activeKit: kit,
      kitId: id !== undefined ? id : state.kitId,
      flashcardProgress: progress !== undefined ? progress : state.flashcardProgress,
      hasUnsavedChanges: false,
    }));
  },

  updateQuestion: (id: string, updates: Partial<Question>) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const updatedQuestions = activeKit.questions.map((q) => {
      if (q.id === id) {
        return {
          ...q,
          ...updates,
          // CRITICAL: Any user modification pins the question
          isPinned: true,
        };
      }
      return q;
    });

    set({
      activeKit: {
        ...activeKit,
        questions: updatedQuestions,
      },
      hasUnsavedChanges: true,
    });
  },

  deleteQuestion: (id: string) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const updatedQuestions = activeKit.questions.filter((q) => q.id !== id);

    // Also remove from schedule question_ids
    const updatedScheduleDays = activeKit.schedule.days.map((day) => ({
      ...day,
      question_ids: day.question_ids.filter((qId) => qId !== id),
    }));

    set({
      activeKit: {
        ...activeKit,
        questions: updatedQuestions,
        schedule: {
          ...activeKit.schedule,
          days: updatedScheduleDays,
        },
      },
      hasUnsavedChanges: true,
    });
  },

  addQuestion: (questionData) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const newId = questionData.id || `q_user_${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      requirement_ids: questionData.requirement_ids || [],
      category: questionData.category || 'technical',
      prompt: questionData.prompt || '',
      answer_outline: questionData.answer_outline || '',
      difficulty: questionData.difficulty || 2,
      // User created question is pinned by default
      isPinned: true,
    };

    set({
      activeKit: {
        ...activeKit,
        questions: [...activeKit.questions, newQuestion],
      },
      hasUnsavedChanges: true,
    });
  },

  reorderQuestions: (
    category: string,
    sourceIndex: number,
    destinationIndex: number
  ) => {
    const { activeKit } = get();
    if (!activeKit) return;

    // Get all questions in this category
    const categoryQuestions = activeKit.questions.filter(
      (q) => q.category === category
    );
    const otherQuestions = activeKit.questions.filter(
      (q) => q.category !== category
    );

    if (
      sourceIndex < 0 ||
      sourceIndex >= categoryQuestions.length ||
      destinationIndex < 0 ||
      destinationIndex >= categoryQuestions.length
    ) {
      return;
    }

    const reorderedCategoryQuestions = Array.from(categoryQuestions);
    const [movedItem] = reorderedCategoryQuestions.splice(sourceIndex, 1);

    // CRITICAL: Reordering an item marks it as pinned
    const pinnedMovedItem = {
      ...movedItem,
      isPinned: true,
    };

    reorderedCategoryQuestions.splice(destinationIndex, 0, pinnedMovedItem);

    // Assemble new questions array maintaining category group
    set({
      activeKit: {
        ...activeKit,
        questions: [...otherQuestions, ...reorderedCategoryQuestions],
      },
      hasUnsavedChanges: true,
    });
  },

  togglePinQuestion: (id: string) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const updatedQuestions = activeKit.questions.map((q) => {
      if (q.id === id) {
        return {
          ...q,
          isPinned: !q.isPinned,
        };
      }
      return q;
    });

    set({
      activeKit: {
        ...activeKit,
        questions: updatedQuestions,
      },
      hasUnsavedChanges: true,
    });
  },

  updateCompanyBrief: (updates: Partial<CompanyBrief>) => {
    const { activeKit } = get();
    if (!activeKit) return;

    set({
      activeKit: {
        ...activeKit,
        company_brief: {
          ...activeKit.company_brief,
          ...updates,
        },
      },
      hasUnsavedChanges: true,
    });
  },

  updateRole: (updates: Partial<Role>) => {
    const { activeKit } = get();
    if (!activeKit) return;

    set({
      activeKit: {
        ...activeKit,
        role: {
          ...activeKit.role,
          ...updates,
        },
      },
      hasUnsavedChanges: true,
    });
  },

  updateFlashcard: (id: string, updates: Partial<Flashcard>) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const updatedFlashcards = activeKit.flashcards.map((f) => {
      if (f.id === id) {
        return {
          ...f,
          ...updates,
          isPinned: true,
        };
      }
      return f;
    });

    set({
      activeKit: {
        ...activeKit,
        flashcards: updatedFlashcards,
      },
      hasUnsavedChanges: true,
    });
  },

  deleteFlashcard: (id: string) => {
    const { activeKit } = get();
    if (!activeKit) return;

    set({
      activeKit: {
        ...activeKit,
        flashcards: activeKit.flashcards.filter((f) => f.id !== id),
      },
      hasUnsavedChanges: true,
    });
  },

  addFlashcard: (flashcardData) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const newId = flashcardData.id || `f_user_${Date.now()}`;
    const newCard: Flashcard = {
      id: newId,
      front: flashcardData.front || '',
      back: flashcardData.back || '',
      requirement_ids: flashcardData.requirement_ids || [],
      isPinned: true,
    };

    set({
      activeKit: {
        ...activeKit,
        flashcards: [...activeKit.flashcards, newCard],
      },
      hasUnsavedChanges: true,
    });
  },

  togglePinFlashcard: (id: string) => {
    const { activeKit } = get();
    if (!activeKit) return;

    const updatedCards = activeKit.flashcards.map((f) => {
      if (f.id === id) {
        return {
          ...f,
          isPinned: !f.isPinned,
        };
      }
      return f;
    });

    set({
      activeKit: {
        ...activeKit,
        flashcards: updatedCards,
      },
      hasUnsavedChanges: true,
    });
  },

  saveKit: async () => {
    const { activeKit, kitId } = get();
    if (!activeKit || !kitId) return;

    set({ status: 'saving', errorMessage: null });

    try {
      // Strict client-side validation before sending to API
      const validPayload = KitSchema.parse(activeKit);

      const response = await api.put(`/kits/${kitId}`, {
        data: validPayload,
      });

      const updatedDoc = response.data?.data?.kit;
      if (updatedDoc?.data) {
        set({
          activeKit: KitSchema.parse(updatedDoc.data),
          status: 'saved',
          hasUnsavedChanges: false,
        });
      } else {
        set({
          activeKit: validPayload,
          status: 'saved',
          hasUnsavedChanges: false,
        });
      }

      // Reset 'saved' status back to 'idle' after 2.5 seconds
      setTimeout(() => {
        if (get().status === 'saved') {
          set({ status: 'idle' });
        }
      }, 2500);
    } catch (err: any) {
      set({
        status: 'failed',
        errorMessage: err.message || 'Failed to save kit changes.',
      });
      throw err;
    }
  },

  regenerateCategory: async (category: string) => {
    const { activeKit, kitId } = get();
    if (!activeKit || !kitId) return;

    set({ isRegenerating: true, isRegeneratingCategory: category, errorMessage: null });

    try {
      const response = await api.post(`/kits/${kitId}/regenerate`, {
        category,
      });

      const kitDoc = response.data?.data?.kit;
      const returnedData = kitDoc?.data || kitDoc || response.data?.data;

      if (returnedData) {
        const parsedKit = KitSchema.parse(returnedData);
        set({
          activeKit: parsedKit,
          hasUnsavedChanges: false,
          errorMessage: null,
        });
      }
    } catch (err: any) {
      set({
        errorMessage: err.message || `Failed to regenerate ${category} questions.`,
      });
      throw err;
    } finally {
      set({ isRegenerating: false, isRegeneratingCategory: null });
    }
  },

  recordConfidence: async (flashcardId: string, score: number) => {
    // 1. Optimistic UI update (immediate feel)
    set((state) => ({
      flashcardProgress: {
        ...state.flashcardProgress,
        [flashcardId]: score,
      },
    }));

    // 2. Persist to backend asynchronously
    try {
      const { kitId } = get();
      if (kitId) {
        await api.patch(`/kits/${kitId}/flashcards/progress`, {
          flashcardId,
          score,
        });
      }
    } catch (error) {
      console.error('Failed to save flashcard progress to backend:', error);
    }
  },

  getSortedFlashcards: () => {
    const { activeKit, flashcardProgress } = get();
    if (!activeKit || !activeKit.flashcards) return [];

    return [...activeKit.flashcards].sort((a, b) => {
      const scoreA = flashcardProgress[a.id];
      const scoreB = flashcardProgress[b.id];

      // Priority ranking:
      // Score 1 (Low Confidence / Hard): rank 0 (come first)
      // Unseen (undefined): rank 1 (mixed in the middle/early)
      // Score 2 (Medium / Good): rank 2
      // Score 3 (High Confidence / Easy): rank 3 (come last)
      const getRank = (score: number | undefined) => {
        if (score === 1) return 0;
        if (score === undefined || score === null) return 1;
        if (score === 2) return 2;
        if (score === 3) return 3;
        return 1;
      };

      const rankDiff = getRank(scoreA) - getRank(scoreB);
      if (rankDiff !== 0) return rankDiff;
      return 0;
    });
  },

  resetPracticeProgress: () => {
    set({ flashcardProgress: {} });
  },

  toggleQuestionCompleted: (questionId: string) => {
    set((state) => ({
      completedQuestions: {
        ...state.completedQuestions,
        [questionId]: !state.completedQuestions[questionId],
      },
    }));
  },
}));


export default useKitStore;
