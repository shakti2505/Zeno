import { Request, Response, NextFunction } from 'express';
import * as kitService from './kit.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { NotFoundError, BadRequestError } from '../../utils/AppError';

export const createKit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { jobDescription, companyUrl, days } = req.body;

    const result = await kitService.createKit(userId, {
      jobDescription,
      companyUrl,
      days: days ? Number(days) : undefined,
    });

    sendCreated(res, result, 'Interview preparation kit generation queued successfully.');
  } catch (error) {
    next(error);
  }
};

export const getKits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const kits = await kitService.getUserKits(userId);

    sendSuccess(res, { kits, count: kits.length }, 'Fetched user interview preparation kits successfully.');
  } catch (error) {
    next(error);
  }
};

export const getKitById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const kit = await kitService.getKitById(userId, id);
    if (!kit) {
      throw new NotFoundError(`Interview kit with ID '${id}' was not found.`);
    }

    sendSuccess(res, { kit }, 'Interview kit details retrieved successfully.');
  } catch (error) {
    next(error);
  }
};

export const updateKit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // The kit data can be passed in req.body.data or directly in req.body
    const kitData = req.body.data !== undefined ? req.body.data : req.body;

    const updatedKit = await kitService.updateKit(userId, id, kitData);
    if (!updatedKit) {
      throw new NotFoundError(`Cannot update kit: Interview kit with ID '${id}' was not found.`);
    }

    sendSuccess(res, { kit: updatedKit }, 'Interview preparation kit updated and validated successfully.');
  } catch (error) {
    next(error);
  }
};

export const deleteKit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deletedKit = await kitService.deleteKit(userId, id);
    if (!deletedKit) {
      throw new NotFoundError(`Cannot delete kit: Interview kit with ID '${id}' was not found.`);
    }

    sendSuccess(res, { id }, `Interview kit '${id}' was deleted successfully.`);
  } catch (error) {
    next(error);
  }
};

export const regenerateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { category } = req.body;

    if (!category || typeof category !== 'string') {
      throw new BadRequestError('A valid category name is required for partial regeneration.');
    }

    const updatedKitData = await kitService.regenerateCategoryService(userId, id, category);

    sendSuccess(
      res,
      { kit: { _id: id, data: updatedKitData } },
      `Category '${category}' regenerated successfully.`
    );
  } catch (error) {
    next(error);
  }
};

export const updateFlashcardConfidence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { flashcardId, score } = req.body;

    const updatedProgress = await kitService.updateFlashcardProgress(
      userId,
      id,
      flashcardId,
      score
    );

    sendSuccess(
      res,
      { flashcardProgress: updatedProgress },
      'Flashcard confidence score updated successfully.'
    );
  } catch (error) {
    next(error);
  }
};


