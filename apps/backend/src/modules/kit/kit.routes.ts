import { Router } from 'express';
import * as kitController from './kit.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Apply auth middleware to protect all kit routes
router.use(authMiddleware);

router.get('/', kitController.getKits);
router.get('/:id', kitController.getKitById);
router.post('/', kitController.createKit);
router.post('/:id/regenerate', kitController.regenerateCategory);
router.patch('/:id/flashcards/progress', kitController.updateFlashcardConfidence);
router.put('/:id', kitController.updateKit);
router.delete('/:id', kitController.deleteKit);

export default router;
