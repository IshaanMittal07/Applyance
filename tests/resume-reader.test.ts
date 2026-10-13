import { describe, expect, it } from 'vitest';
import { extractResumeText } from '../src/shared/resume-reader';

describe('resume reader', () => {
  it('reads plain-text resumes locally', async () => {
    const contents = 'Ishaan Mittal\nimittal@example.com';
    const file = Object.assign(new Blob([contents], { type: 'text/plain' }), { name: 'resume.txt', text: async () => contents });

    await expect(extractResumeText(file)).resolves.toBe('Ishaan Mittal\nimittal@example.com');
  });

  it('rejects unsupported document formats with a clear message', async () => {
    const file = Object.assign(new Blob(['resume'], { type: 'application/rtf' }), { name: 'resume.rtf' });

    await expect(extractResumeText(file)).rejects.toThrow('Choose a PDF, DOCX, or plain-text resume.');
  });
});