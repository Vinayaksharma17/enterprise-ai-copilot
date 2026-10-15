import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import pdfParse from 'pdf-parse';
import { config } from '../config/env';
import { Document as DocumentModel, IDocument } from '../models/document.model';
import { DocumentChunk } from '../models/document-chunk.model';
import { getEmbeddingsProvider } from '../integrations/llm/embeddings.service';
import {
  getVectorStore,
  VectorChunkRecord,
} from '../integrations/vector-store/vector-store.service';

export interface ExtractedSection {
  text: string;
  pageNumber?: number;
  sectionTitle?: string;
}

export interface ChunkDraft {
  chunkIndex: number;
  text: string;
  pageNumber?: number;
  sectionTitle?: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

/**
 * Resolves the on-disk path for an uploaded document. The filename is derived
 * deterministically from the content hash, so retries and duplicate detection
 * never depend on client-supplied filenames.
 */
export const resolveStoredFilePath = (doc: {
  fileHash: string;
  mimeType: string;
}): string => {
  const extension = EXTENSION_BY_MIME[doc.mimeType] ?? '';
  return path.join(path.resolve(config.upload.dir), `${doc.fileHash}${extension}`);
};

/**
 * Extracts text from a PDF, preserving page boundaries where the parser
 * provides them. Page numbers are 1-indexed.
 */
export const extractPdfSections = async (
  buffer: Buffer
): Promise<ExtractedSection[]> => {
  const pageTexts: string[] = [];

  await pdfParse(buffer, {
    pagerender: async (pageData: {
      getTextContent: (options?: Record<string, unknown>) => Promise<{
        items: Array<{ str?: string }>;
      }>;
    }) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      const text = textContent.items
        .map((item) => item.str ?? '')
        .join(' ')
        .trim();
      pageTexts.push(text);
      return text;
    },
  });

  return pageTexts
    .map((text, index) => ({ text, pageNumber: index + 1 }))
    .filter((section) => section.text.length > 0);
};

export const extractTextSections = async (
  filePath: string
): Promise<ExtractedSection[]> => {
  const text = await fsp.readFile(filePath, 'utf-8');
  return [{ text }];
};

/**
 * Extracts text sections from an uploaded file based on its MIME type. No page
 * number is invented for formats (such as TXT) that do not provide one.
 */
export const extractSections = async (
  filePath: string,
  mimeType: string
): Promise<ExtractedSection[]> => {
  if (mimeType === 'application/pdf') {
    const buffer = await fsp.readFile(filePath);
    return extractPdfSections(buffer);
  }

  if (mimeType === 'text/plain') {
    return extractTextSections(filePath);
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`);
};

/**
 * Splits extracted sections into chunks using a LangChain text splitter. Chunk
 * size and overlap are configurable. Metadata (page number, section title) is
 * preserved and empty chunks are discarded.
 */
export const chunkSections = async (
  sections: ExtractedSection[],
  options: { chunkSize: number; chunkOverlap: number } = config.chunking
): Promise<ChunkDraft[]> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
  });

  const chunks: ChunkDraft[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const parts = await splitter.splitText(section.text);
    for (const part of parts) {
      const text = part.trim();
      if (!text) {
        continue;
      }
      chunks.push({
        chunkIndex,
        text,
        pageNumber: section.pageNumber,
        sectionTitle: section.sectionTitle,
      });
      chunkIndex += 1;
    }
  }

  return chunks;
};

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || 'Processing failed';
};

/**
 * Removes any previously persisted chunks and vectors for a document. Used both
 * before (re)processing to keep retries idempotent and as best-effort cleanup on
 * partial failure.
 */
const cleanupArtifacts = async (documentId: string): Promise<void> => {
  await DocumentChunk.deleteMany({ documentId }).catch(() => undefined);
  await getVectorStore()
    .deleteByDocumentIds([documentId])
    .catch(() => undefined);
};

/**
 * Full ingestion pipeline for a single document:
 * extract -> split -> embed -> persist vectors (ChromaDB) -> persist chunk
 * provenance (MongoDB) -> mark processed.
 *
 * The document is never marked `processed` until both the vectors and the chunk
 * metadata have been written. On failure the document is marked `failed` with a
 * sanitized reason and partial artifacts are cleaned up so stale vectors are not
 * left searchable.
 */
export const processDocument = async (doc: IDocument): Promise<IDocument> => {
  const documentId = doc._id.toString();

  doc.status = 'processing';
  doc.processingError = undefined;
  await doc.save();

  try {
    const filePath = resolveStoredFilePath(doc);
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file is missing from storage');
    }

    const sections = await extractSections(filePath, doc.mimeType);
    const chunks = await chunkSections(sections);

    if (chunks.length === 0) {
      throw new Error('Document contains no extractable text');
    }

    await cleanupArtifacts(documentId);

    const embeddings = await getEmbeddingsProvider().embedDocuments(
      chunks.map((chunk) => chunk.text)
    );

    if (embeddings.length !== chunks.length) {
      throw new Error('Embedding provider returned an unexpected number of vectors');
    }

    const expectedDimensions = embeddings[0]?.length ?? 0;
    if (
      expectedDimensions === 0 ||
      embeddings.some(
        (embedding) =>
          !Array.isArray(embedding) || embedding.length !== expectedDimensions
      )
    ) {
      throw new Error('Embedding provider returned vectors with inconsistent dimensions');
    }

    const records: VectorChunkRecord[] = chunks.map((chunk, index) => {
      const chunkId = `${documentId}:${chunk.chunkIndex}`;
      return {
        chunkId,
        embedding: embeddings[index],
        text: chunk.text,
        metadata: {
          documentId,
          chunkId,
          chunkIndex: chunk.chunkIndex,
          department: doc.department,
          accessLevel: doc.accessLevel,
          allowedDepartments: doc.allowedDepartments.join(','),
          documentName: doc.name,
          pageNumber: chunk.pageNumber,
          embeddingModel: config.llm.embeddingModel,
        },
      };
    });

    await getVectorStore().upsertChunks(records);

    await DocumentChunk.insertMany(
      chunks.map((chunk) => ({
        documentId: doc._id,
        chunkId: `${documentId}:${chunk.chunkIndex}`,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        department: doc.department,
        accessLevel: doc.accessLevel,
        allowedDepartments: doc.allowedDepartments,
      }))
    );

    doc.status = 'processed';
    doc.chunkCount = chunks.length;
    doc.processingError = undefined;
    await doc.save();

    return doc;
  } catch (error) {
    await cleanupArtifacts(documentId);

    doc.status = 'failed';
    doc.processingError = sanitizeError(error);
    await doc.save();

    return doc;
  }
};

export const documentProcessingService = {
  processDocument,
  extractSections,
  chunkSections,
  resolveStoredFilePath,
};
