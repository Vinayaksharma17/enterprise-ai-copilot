import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  computeFileHash,
  validateFileContent,
} from '../../src/modules/documents/documents.service';

const writeTemp = (name: string, content: Buffer | string): string => {
  const filePath = path.join(os.tmpdir(), `eac-test-${Date.now()}-${name}`);
  fs.writeFileSync(filePath, content);
  return filePath;
};

describe('documents.service file validation', () => {
  describe('validateFileContent', () => {
    it('accepts a real PDF signature', async () => {
      const filePath = writeTemp('ok.pdf', Buffer.from('%PDF-1.7\n%%EOF'));
      await expect(validateFileContent(filePath, 'application/pdf')).resolves.toBeUndefined();
      fs.unlinkSync(filePath);
    });

    it('rejects content declared as PDF without the PDF signature', async () => {
      const filePath = writeTemp('fake.pdf', Buffer.from('this is not really a pdf'));
      await expect(
        validateFileContent(filePath, 'application/pdf')
      ).rejects.toThrow('does not match the PDF format');
      fs.unlinkSync(filePath);
    });

    it('accepts valid text content', async () => {
      const filePath = writeTemp('ok.txt', 'plain text content');
      await expect(validateFileContent(filePath, 'text/plain')).resolves.toBeUndefined();
      fs.unlinkSync(filePath);
    });

    it('rejects binary content declared as text', async () => {
      const filePath = writeTemp('bin.txt', Buffer.from([0x68, 0x00, 0x69]));
      await expect(validateFileContent(filePath, 'text/plain')).rejects.toThrow(
        'valid text file'
      );
      fs.unlinkSync(filePath);
    });

    it('rejects unsupported mime types', async () => {
      const filePath = writeTemp('x.bin', Buffer.from('data'));
      await expect(
        validateFileContent(filePath, 'application/octet-stream')
      ).rejects.toThrow('Unsupported file type');
      fs.unlinkSync(filePath);
    });
  });

  describe('computeFileHash', () => {
    it('produces a stable SHA-256 hash for identical content', async () => {
      const a = writeTemp('h1.txt', 'same content');
      const b = writeTemp('h2.txt', 'same content');
      const c = writeTemp('h3.txt', 'different content');

      const hashA = await computeFileHash(a);
      const hashB = await computeFileHash(b);
      const hashC = await computeFileHash(c);

      expect(hashA).toBe(hashB);
      expect(hashA).not.toBe(hashC);
      expect(hashA).toHaveLength(64);

      [a, b, c].forEach((file) => fs.unlinkSync(file));
    });
  });
});
