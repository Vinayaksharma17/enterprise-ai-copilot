import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { uploadSingle } from '../../middleware/upload.middleware';
import { documentsController } from './documents.controller';
import {
  documentIdParamSchema,
  listDocumentsQuerySchema,
  uploadDocumentSchema,
} from './documents.validator';

const router = Router();

/**
 * @swagger
 * /documents/upload:
 *   post:
 *     summary: Upload and process a knowledge document (admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               accessLevel:
 *                 type: string
 *                 enum: [public, restricted]
 *               department:
 *                 type: string
 *               allowedDepartments:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded (and processed synchronously)
 *       400:
 *         description: Invalid file or metadata
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 *       409:
 *         description: Duplicate document
 *       413:
 *         description: File too large
 */
router.post(
  '/upload',
  authenticate,
  authorize('admin'),
  uploadSingle('file'),
  validate(uploadDocumentSchema),
  documentsController.upload
);

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: List documents the current user is authorized to access
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  validate(listDocumentsQuerySchema, 'query'),
  documentsController.list
);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Retrieve a single authorized document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document retrieved
 *       404:
 *         description: Document not found or not accessible
 */
router.get(
  '/:id',
  authenticate,
  validate(documentIdParamSchema, 'params'),
  documentsController.getById
);

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document and its indexed vectors (admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Document not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(documentIdParamSchema, 'params'),
  documentsController.remove
);

export default router;
