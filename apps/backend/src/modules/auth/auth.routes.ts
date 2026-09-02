import { Router } from 'express';
import * as authController from './auth.controller';
import { authMiddleware } from './auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.getMe);

export default router;
