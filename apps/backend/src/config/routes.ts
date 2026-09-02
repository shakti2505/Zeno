import { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import authRoutes from '../modules/auth/auth.routes';
import kitRoutes from '../modules/kit/kit.routes';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';

/**
 * Configures and registers all application routes, health checks,
 * fallback 404 handler, and global error handling middleware.
 */
export const configureRoutes = (app: Application): void => {
  // Health & Diagnostic Endpoint
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        service: 'zeno-backend',
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memoryUsage: process.memoryUsage(),
      },
      'Zeno backend service is operational'
    );
  });

  // Root API Information Endpoint
  app.get('/api', (_req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        version: '1.0.0',
        resources: {
          auth: '/api/auth',
          kits: '/api/kits',
          health: '/health',
        },
      },
      'Welcome to Zeno Interview Kit Builder API'
    );
  });

  // Feature Module Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/kits', kitRoutes);

  // 404 Handler for all unmatched routes
  app.use('*', notFoundHandler);

  // Global Error Handling Middleware (must be registered last)
  app.use(errorHandler);
};

export default configureRoutes;
