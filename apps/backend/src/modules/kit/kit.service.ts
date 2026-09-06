import { z } from 'zod';
import { Kit, KitStatus } from './kit.model';
import { KitSchema, Kit as KitType, Question, QuestionSchema } from '@zeno/shared';
import { KitGenerationQueue } from './kit.worker';
import { BadRequestError, NotFoundError } from '../../utils/AppError';
import { getChatModel } from './graph/nodes';
import { generateSchedule } from './scheduler.service';

export interface CreateKitInput {
  jobDescription: string;
  companyUrl?: string;
  days?: number;
}

export interface KitCreationResult {
  _id: string;
  status: KitStatus;
  createdAt: Date;
}

/**
 * 1. Creates new Kit in MongoDB with status: 'generating'
 * 2. Enqueues background BullMQ job for asynchronous LLM generation
 * 3. Returns the created kit ID and status
 */
export const createKit = async (userId: string, payload: CreateKitInput): Promise<KitCreationResult> => {
  if (!payload || !payload.jobDescription || payload.jobDescription.trim().length === 0) {
    throw new BadRequestError('Job description text is required to generate an interview preparation kit.');
  }

  // 1 & 2. Create and save new Kit document to MongoDB
  const kit = new Kit({
    userId,
    status: 'generating',
    data: null,
    errorMessage: null,
  });
  await kit.save();

  // 3. Enqueue background LLM generation job in BullMQ
  await KitGenerationQueue.add(
    'generate-kit',
    {
      kitId: kit._id.toString(),
      userId,
      jobDescription: payload.jobDescription.trim(),
      companyUrl: payload.companyUrl?.trim(),
      days: payload.days,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );

  // 4. Return kit ID and status immediately to the caller
  return {
    _id: kit._id.toString(),
    status: kit.status,
    createdAt: kit.createdAt,
  };
};

/**
 * Fetches all kits for a user with unhydrated lean() query for high performance
 */
export const getUserKits = async (userId: string): Promise<any[]> => {
  return Kit.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Fetches a single kit by ID for a user unhydrated via lean()
 */
export const getKitById = async (userId: string, kitId: string): Promise<any | null> => {
  return Kit.findOne({ _id: kitId, userId }).lean();
};

/**
 * Atomically updates a kit document using $set operator to eliminate race conditions
 * and reads unhydrated result via lean()
 */
export const updateKit = async (userId: string, kitId: string, kitData: unknown): Promise<any | null> => {
  // CRITICAL: Validate with strict KitSchema Zod schema. If validation fails, ZodError throws here.
  const validatedData = KitSchema.parse(kitData);

  // Atomic database update using MongoDB $set operator to avoid race conditions
  return Kit.findOneAndUpdate(
    { _id: kitId, userId },
    {
      $set: {
        data: validatedData,
        status: 'completed',
        errorMessage: null,
      },
    },
    { new: true, runValidators: true }
  ).lean();
};

/**
 * Atomically updates kit generation status / errors directly in DB
 */
export const updateKitStatus = async (
  userId: string,
  kitId: string,
  status: KitStatus,
  errorMessage: string | null = null
): Promise<any | null> => {
  return Kit.findOneAndUpdate(
    { _id: kitId, userId },
    {
      $set: {
        status,
        errorMessage,
      },
    },
    { new: true, runValidators: true }
  ).lean();
};

/**
 * Atomically deletes a kit document and returns unhydrated result
 */
export const deleteKit = async (userId: string, kitId: string): Promise<any | null> => {
  return Kit.findOneAndDelete({ _id: kitId, userId }).lean();
};

/**
 * Partially regenerates questions for a specific category while strictly
 * preserving:
 * 1. All questions in other categories
 * 2. Any pinned questions in this category (user-edited or explicitly pinned)
 */
export const regenerateCategoryService = async (
  userId: string,
  kitId: string,
  category: string
): Promise<KitType> => {
  // 1. Fetch the Kit from MongoDB
  const kitDoc = await Kit.findOne({ _id: kitId, userId });
  if (!kitDoc || !kitDoc.data) {
    throw new NotFoundError(`Interview kit with ID '${kitId}' was not found.`);
  }

  const currentKit: KitType = KitSchema.parse(kitDoc.data);

  // 2. Filter retained questions: keep all questions where category !== target OR isPinned === true
  const retainedQuestions: Question[] = currentKit.questions.filter(
    (q) => q.category !== category || q.isPinned === true
  );

  // 3. Identify requirements matching the target category
  let matchingRequirements = (currentKit.role?.requirements || []).filter((r) => {
    if (category === 'technical') return r.kind === 'technical' || r.kind === 'domain';
    if (category === 'system-design') return r.kind === 'technical' || r.kind === 'domain';
    if (category === 'behavioural') return r.kind === 'behavioural';
    return true;
  });

  if (matchingRequirements.length === 0) {
    matchingRequirements = currentKit.role?.requirements || [];
  }

  const validReqIds = matchingRequirements.map((r) => r.id);
  if (validReqIds.length === 0) {
    throw new BadRequestError('Cannot regenerate questions: No requirements found in this kit.');
  }

  // 4. Use LLM with structured output to generate 3-4 new questions
  const model = getChatModel();
  const RegenerateOutputSchema = z.object({
    questions: z.array(
      z.object({
        id: z.string().describe('Unique ID like q_technical_1'),
        requirement_ids: z.array(z.string()).describe('List of requirement IDs tested'),
        category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
        prompt: z.string().describe('Interview question prompt'),
        answer_outline: z.string().describe('Comprehensive outline of good answer'),
        difficulty: z.number().int().min(1).max(3).default(2).describe('Difficulty score from 1 to 3'),
      })
    ),
  });

  const prompt = `You are an expert technical interviewer and curriculum designer.
Generate 3 to 4 brand new, highly realistic, and in-depth interview questions specifically for the category: "${category}".

Target Role:
- Title: ${currentKit.role.title}
- Seniority: ${currentKit.role.seniority || 'Mid-Senior'}
- Responsibilities: ${(currentKit.role.responsibilities || []).join('; ') || 'N/A'}

Company Context:
- Company: ${currentKit.source.company}
- Summary: ${currentKit.company_brief.summary}

Applicable Requirements to Target:
${matchingRequirements.map((r) => `- [${r.id}] (${r.priority.toUpperCase()} / ${r.kind}): ${r.text}`).join('\n')}

Instructions:
1. Category must strictly be "${category}".
2. Explicitly link at least one valid requirement ID from [${validReqIds.join(', ')}] in "requirement_ids".
3. Provide a clear, substantive "prompt" and detailed "answer_outline".
4. MUST explicitly include "difficulty": 1 (Easy), 2 (Medium), or 3 (Hard) for each question.
5. Generate unique question IDs (e.g. q_${category}_${Date.now()}_1).`;

  let newQuestions: Question[] = [];

  try {
    const structuredLlm = model.withStructuredOutput(RegenerateOutputSchema);
    const output = (await structuredLlm.invoke(prompt)) as { questions: Question[] };

    // 5. Apply strict guardrails on LLM output
    newQuestions = (output.questions || []).map((q, idx) => ({
      id: q.id || `q_${category}_${Date.now()}_${idx + 1}`,
      category: category as any,
      prompt: q.prompt,
      answer_outline: q.answer_outline || '',
      difficulty: (q.difficulty >= 1 && q.difficulty <= 3 ? q.difficulty : 2) as 1 | 2 | 3,
      requirement_ids: (q.requirement_ids || []).filter((id) => validReqIds.includes(id)),
      isPinned: false,
    })).map((q) => ({
      ...q,
      requirement_ids: q.requirement_ids.length > 0 ? q.requirement_ids : [validReqIds[0]],
    }));
  } catch (err: any) {
    console.warn(`⚠️ [regenerateCategory] LLM call failed (${err.message}). Using fallback question generation.`);
    newQuestions = matchingRequirements.slice(0, 3).map((req, idx) => ({
      id: `q_${category}_${Date.now()}_${idx + 1}`,
      requirement_ids: [req.id],
      category: category as any,
      prompt: `Can you explain your in-depth experience with ${req.text} at ${currentKit.source.company}?`,
      answer_outline: `Demonstrate structured technical proficiency, trade-offs, and production impact aligned with ${req.text}.`,
      difficulty: 2,
      isPinned: false,
    }));
  }

  // 6. Merge retainedQuestions with the safe newly generated questions
  const updatedQuestions = [...retainedQuestions, ...newQuestions];

  // 7. Recalculate schedule
  const updatedSchedule = generateSchedule(
    updatedQuestions,
    currentKit.role.requirements,
    currentKit.schedule?.days_available || 3
  );

  const updatedKitData: KitType = {
    ...currentKit,
    questions: updatedQuestions,
    schedule: updatedSchedule,
  };

  // Validate with strict KitSchema
  const validKit = KitSchema.parse(updatedKitData);

  // 8. Save to MongoDB atomically
  await Kit.findOneAndUpdate(
    { _id: kitId, userId },
    {
      $set: {
        data: validKit,
        status: 'completed',
        errorMessage: null,
      },
    },
    { new: true, runValidators: true }
  );

  return validKit;
};

/**
 * Updates or sets the confidence score (1, 2, or 3) for a flashcard
 * within a kit's flashcardProgress map and returns the updated progress.
 */
export const updateFlashcardProgress = async (
  userId: string,
  kitId: string,
  flashcardId: string,
  score: number
): Promise<Record<string, number>> => {
  if (!flashcardId || typeof flashcardId !== 'string') {
    throw new BadRequestError('Flashcard ID is required.');
  }

  const numericScore = Number(score);
  if (![1, 2, 3].includes(numericScore)) {
    throw new BadRequestError('Confidence score must be 1 (Hard), 2 (Good), or 3 (Easy).');
  }

  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) {
    throw new NotFoundError(`Interview kit with ID '${kitId}' was not found.`);
  }

  if (!kit.flashcardProgress) {
    kit.flashcardProgress = new Map<string, number>();
  }

  kit.flashcardProgress.set(flashcardId, numericScore);
  kit.markModified('flashcardProgress');
  await kit.save();

  // Convert Map to plain Record for clean JSON serialization
  const progressRecord: Record<string, number> = {};
  if (kit.flashcardProgress instanceof Map) {
    kit.flashcardProgress.forEach((val, key) => {
      progressRecord[key] = val;
    });
  } else if (typeof kit.flashcardProgress === 'object') {
    Object.assign(progressRecord, kit.flashcardProgress);
  }

  return progressRecord;
};


