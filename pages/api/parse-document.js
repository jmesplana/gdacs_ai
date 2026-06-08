import fs from 'fs/promises';
import formidable from 'formidable';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

const MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 60000;
const DOCUMENT_CHUNK_SIZE = 2200;
const MAX_DOCUMENT_CHUNKS = 12;

function normalizeExtractedText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function chunkDocumentText(text = '') {
  const chunks = [];
  let offset = 0;

  while (offset < text.length && chunks.length < MAX_DOCUMENT_CHUNKS) {
    const targetEnd = Math.min(offset + DOCUMENT_CHUNK_SIZE, text.length);
    const nextBreak = text.lastIndexOf('\n\n', targetEnd);
    const end = nextBreak > offset + 800 ? nextBreak : targetEnd;
    const content = text.slice(offset, end).trim();

    if (content) {
      chunks.push({
        index: chunks.length + 1,
        text: content
      });
    }

    offset = end;
  }

  return chunks;
}

function getDocumentStats(text = '', metadata = {}) {
  const words = text.match(/\S+/g) || [];
  return {
    characterCount: text.length,
    wordCount: words.length,
    pageCount: Number.isFinite(metadata.pageCount) ? metadata.pageCount : null,
    truncated: Boolean(metadata.truncated)
  };
}

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = normalizeExtractedText(result?.text || '');

    return {
      text,
      pageCount: Number.isFinite(result?.total) ? result.total : null
    };
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: normalizeExtractedText(result?.value || ''),
    pageCount: null
  };
}

function getUploadedFile(files = {}) {
  const candidate = files.file;
  return Array.isArray(candidate) ? candidate[0] : candidate;
}

function parseForm(req) {
  const form = formidable({
    maxFileSize: MAX_DOCUMENT_UPLOAD_BYTES,
    multiples: false
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let uploadedFile;

  try {
    const { files } = await parseForm(req);
    uploadedFile = getUploadedFile(files);

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const originalName = uploadedFile.originalFilename || uploadedFile.newFilename || 'attached-document';
    const lowerName = originalName.toLowerCase();
    const fileSize = uploadedFile.size || 0;

    if (fileSize > MAX_DOCUMENT_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Document uploads are limited to 15 MB.' });
    }

    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
      return res.status(400).json({ error: 'Upload a PDF or Word document (.docx).' });
    }

    const buffer = await fs.readFile(uploadedFile.filepath);
    const parsed = lowerName.endsWith('.pdf')
      ? await parsePdf(buffer)
      : await parseDocx(buffer);

    if (!parsed.text) {
      return res.status(422).json({
        error: 'No readable text could be extracted from this document. Scanned PDFs may need OCR before upload.'
      });
    }

    const truncated = parsed.text.length > MAX_EXTRACTED_TEXT_CHARS;
    const retainedText = truncated
      ? parsed.text.slice(0, MAX_EXTRACTED_TEXT_CHARS).trim()
      : parsed.text;
    const chunks = chunkDocumentText(retainedText);

    return res.status(200).json({
      fileName: originalName,
      fileType: lowerName.endsWith('.pdf') ? 'pdf' : 'docx',
      documentText: retainedText,
      documentChunks: chunks,
      documentStats: getDocumentStats(retainedText, {
        pageCount: parsed.pageCount,
        truncated
      })
    });
  } catch (error) {
    console.error('Document parse failed:', error);

    const message = error?.code === 'LIMIT_FILE_SIZE'
      ? 'Document uploads are limited to 15 MB.'
      : error?.message || 'Unable to parse that document.';

    return res.status(error?.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: message });
  } finally {
    if (uploadedFile?.filepath) {
      await fs.unlink(uploadedFile.filepath).catch(() => {});
    }
  }
}
