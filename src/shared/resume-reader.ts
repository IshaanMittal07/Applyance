import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

declare global {
  interface Window {
    mammoth?: {
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
  }
}

const MAX_RESUME_BYTES = 15 * 1024 * 1024;
type ResumeFile = Blob & { name: string };

async function readPdf(file: ResumeFile): Promise<string> {
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  if (document.numPages > 60) {
    await document.destroy();
    throw new Error('This resume has more than 60 pages. Upload a shorter file.');
  }

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => 'str' in item ? `${item.str}${'hasEOL' in item && item.hasEOL ? '\n' : ' '}` : '').join(''));
  }
  await document.destroy();
  return pages.join('\n');
}

export async function extractResumeText(file: ResumeFile): Promise<string> {
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error('Choose a resume smaller than 15 MB.');
  }

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    return readPdf(file);
  }
  if (fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!window.mammoth) {
      throw new Error('The local Word document parser did not load. Reload Applyance and try again.');
    }
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (fileName.endsWith('.txt') || file.type === 'text/plain') {
    return file.text();
  }
  throw new Error('Choose a PDF, DOCX, or plain-text resume.');
}