import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware';
import { validate } from '../../middleware/validate.middleware';
import { chatController } from './chat.controller';
import { chatRequestSchema } from './chat.validator';

const router = Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Ask a question grounded in authorized knowledge-base documents
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *               conversationId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Answer generated with source citations
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.post('/', authenticate, validate(chatRequestSchema), chatController.ask);

export default router;
