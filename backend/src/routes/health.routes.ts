import * as express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Basic health check
router.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'enterprise-ai-copilot-backend',
  });
});

// Readiness check for essential dependencies
router.get('/health/ready', async (_req: express.Request, res: express.Response) => {
  const checks: { [key: string]: boolean } = {
    mongodb: false,
  };

  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      checks.mongodb = true;
    }
  } catch (error) {
    checks.mongodb = false;
  }

  const isReady = checks.mongodb; // MongoDB is required
  const status = isReady ? 200 : 503;

  res.status(status).json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
