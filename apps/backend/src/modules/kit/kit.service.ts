import { Kit, KitStatus } from './kit.model';
import { KitSchema, Kit as KitType } from '@zeno/shared';
import { KitGenerationQueue } from './kit.worker';
import { BadRequestError } from '../../utils/AppError';

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
