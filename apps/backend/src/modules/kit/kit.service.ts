import { Kit, IKit, KitStatus } from './kit.model';
import { KitSchema, Kit as KitType } from '@zeno/shared';

export interface CreateKitPayload {
  status?: KitStatus;
  data?: KitType;
  errorMessage?: string;
}

/**
 * Creates a new interview kit record atomically
 */
export const createKit = async (userId: string, payload?: CreateKitPayload): Promise<any> => {
  const [createdKit] = await Kit.create(
    [
      {
        userId,
        status: payload?.status || 'generating',
        data: payload?.data || null,
        errorMessage: payload?.errorMessage || null,
      },
    ],
    { validateBeforeSave: true }
  );

  return createdKit.toObject();
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
