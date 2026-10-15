import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { AuthUser } from '../../utils/access-control';
import { documentsService } from './documents.service';
import type { UploadDocumentInput, ListDocumentsQuery } from './documents.validator';

const toAuthUser = (req: Request): AuthUser => ({
  id: req.user!.id,
  role: req.user!.role,
  department: req.user!.department,
});

export const documentsController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UploadDocumentInput;
    const document = await documentsService.createDocument(
      toAuthUser(req),
      req.file,
      {
        name: body.name,
        accessLevel: body.accessLevel,
        department: body.department,
        allowedDepartments: body.allowedDepartments,
      }
    );

    res.status(201).json({
      success: true,
      message:
        document.status === 'processed'
          ? 'Document uploaded and processed successfully'
          : 'Document uploaded',
      data: document,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListDocumentsQuery;
    const result = await documentsService.listDocuments(toAuthUser(req), {
      page: query.page,
      limit: query.limit,
      status: query.status,
    });

    res.status(200).json({
      success: true,
      message: 'Documents retrieved',
      data: result,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const document = await documentsService.getDocumentById(
      toAuthUser(req),
      String(req.params.id)
    );

    res.status(200).json({
      success: true,
      message: 'Document retrieved',
      data: document,
    });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await documentsService.deleteDocument(toAuthUser(req), String(req.params.id));

    res.status(200).json({
      success: true,
      message: 'Document deleted',
    });
  }),
};
