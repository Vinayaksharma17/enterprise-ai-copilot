import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  chunkSections,
  extractSections,
  extractTextSections,
  resolveStoredFilePath,
} from '../../src/services/document-processing.service';

describe('document-processing.service', () => {
  describe('chunkSections', () => {
    it('assigns sequential chunk indexes and preserves page metadata', async () => {
      const chunks = await chunkSections(
        [{ text: 'sentence '.repeat(200), pageNumber: 3 }],
        { chunkSize: 100, chunkOverlap: 20 }
      );

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.pageNumber).toBe(3);
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });

    it('ignores empty chunks', async () => {
      const chunks = await chunkSections(
        [{ text: '   \n  ' }, { text: 'real content here', pageNumber: 1 }],
        { chunkSize: 100, chunkOverlap: 10 }
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('real content here');
    });

    it('carries section titles through to chunks', async () => {
      const chunks = await chunkSections(
        [{ text: 'Section body text', sectionTitle: 'Remote Work Policy' }],
        { chunkSize: 100, chunkOverlap: 10 }
      );

      expect(chunks[0].sectionTitle).toBe('Remote Work Policy');
    });

    it('does not invent page numbers when none are provided', async () => {
      const chunks = await chunkSections([{ text: 'plain text document' }], {
        chunkSize: 100,
        chunkOverlap: 10,
      });

      expect(chunks[0].pageNumber).toBeUndefined();
    });
  });

  describe('extractTextSections', () => {
    it('extracts the full text of a text file', async () => {
      const filePath = path.join(os.tmpdir(), `eac-${Date.now()}.txt`);
      fs.writeFileSync(filePath, 'hello knowledge base');

      const sections = await extractTextSections(filePath);
      expect(sections).toHaveLength(1);
      expect(sections[0].text).toBe('hello knowledge base');
      expect(sections[0].pageNumber).toBeUndefined();

      fs.unlinkSync(filePath);
    });
  });

  describe('extractSections', () => {
    it('rejects unsupported mime types', async () => {
      await expect(
        extractSections('/tmp/whatever.bin', 'application/octet-stream')
      ).rejects.toThrow('Unsupported MIME type');
    });
  });

  describe('resolveStoredFilePath', () => {
    it('is deterministic and content-addressed', () => {
      const a = resolveStoredFilePath({
        fileHash: 'abc123',
        mimeType: 'application/pdf',
      });
      const b = resolveStoredFilePath({
        fileHash: 'abc123',
        mimeType: 'application/pdf',
      });

      expect(a).toBe(b);
      expect(a.endsWith('abc123.pdf')).toBe(true);
    });
  });
});
