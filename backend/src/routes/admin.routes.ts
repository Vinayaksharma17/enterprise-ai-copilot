import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get(
  '/health',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Admin access verified',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
