import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  }),

  login: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.login(req.body);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  }),

  getMe: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({
      success: true,
      message: 'User profile retrieved',
      data: user,
    });
  }),
};
