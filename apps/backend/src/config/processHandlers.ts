import http from 'http';
import mongoose from 'mongoose';
import { redisConnection } from './redis';

/**
 * Attaches process-level listeners to catch unhandled errors, unhandled promise rejections,
 * and handle graceful server shutdown.
 */
export const setupProcessErrorHandlers = (server?: http.Server): void => {
  // Catch unhandled synchronous exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 [CRITICAL] Uncaught Exception thrown:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Gracefully terminate to avoid running in indeterminate state
    process.exit(1);
  });

  // Catch unhandled asynchronous promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 [CRITICAL] Unhandled Promise Rejection detected:', {
      reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : reason,
      promise,
      timestamp: new Date().toISOString(),
    });

    // If server is passed, perform graceful shutdown
    if (server) {
      server.close(() => {
        console.log('🛑 Server closed due to unhandled rejection.');
        process.exit(1);
      });
    }
  });

  // Graceful shutdown on termination signals
  const handleGracefulShutdown = async (signal: string) => {
    console.log(` Received ${signal}. Starting graceful shutdown...`);

    if (server) {
      server.close(() => {
        console.log(' HTTP server stopped accepting new connections.');
      });
    }

    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('🍃 MongoDB connection closed gracefully.');
      }

      if (redisConnection.status === 'ready' || redisConnection.status === 'connecting') {
        await redisConnection.quit();
        console.log('🔌 Redis connection closed gracefully.');
      }
    } catch (err) {
      console.error('Error closing database/redis connections during shutdown:', err);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
};

export default setupProcessErrorHandlers;
