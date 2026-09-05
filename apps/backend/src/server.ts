// Initialize background queue worker listeners on startup
import './modules/kit/kit.worker';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { configureRoutes } from './config/routes';
import { setupProcessErrorHandlers } from './config/processHandlers';

// Setup process-level error handlers early before running any code
setupProcessErrorHandlers();

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Core Global Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Centralized Route Configuration (Mounts feature routes, 404 handler, and global errorHandler)
configureRoutes(app);

// Initialize Database and Start Server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Zeno Backend running on http://localhost:${PORT}`);
    });

    // Wire up graceful shutdown with the active HTTP server instance
    setupProcessErrorHandlers(server);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
