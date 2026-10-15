import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { AuthUser } from '../../utils/access-control';
import { chatService } from './chat.service';
import type { ChatRequestInput } from './chat.validator';

const toAuthUser = (req: Request): AuthUser => ({
  id: req.user!.id,
  role: req.user!.role,
  department: req.user!.department,
});

export const chatController = {
  ask: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as ChatRequestInput;
    const result = await chatService.answerQuestion(toAuthUser(req), {
      question: body.question,
      conversationId: body.conversationId,
    });

    res.status(200).json({
      success: true,
      message: 'Answer generated',
      data: result,
    });
  }),
};
