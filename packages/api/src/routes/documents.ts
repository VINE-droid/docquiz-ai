import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { documentExtractResponseSchema, type DocumentExtractResponse } from '@docquiz/shared';
import { chunkText, countWords, countChars } from '../services/chunker.js';

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File size exceeds the 25 MB limit.',
          });
        }
        return res.status(400).json({
          error: `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'File upload failed.',
      });
    }
    next();
  });
}

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
]);

documentsRouter.post('/extract', uploadMiddleware, async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
  const file = files[0];

  if (!file) {
    return res.status(400).json({
      error: 'No file uploaded. Please provide a file to extract.',
    });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return res.status(400).json({
      error: `Unsupported file type "${ext || 'unknown'}". Supported formats are PDF (.pdf), DOCX (.docx), TXT (.txt), MD (.md), CSV (.csv), and JSON (.json).`,
    });
  }

  let extractedText = '';

  try {
    if (ext === '.pdf') {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text || '';
    } else if (ext === '.docx') {
      const docxData = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = docxData.value || '';
    } else if (['.txt', '.md', '.markdown', '.csv', '.json'].includes(ext)) {
      extractedText = file.buffer.toString('utf-8');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    return res.status(400).json({
      error: `Failed to extract text from "${file.originalname}": ${message}`,
    });
  }

  const trimmedText = extractedText.trim();
  if (!trimmedText) {
    return res.status(400).json({
      error: `The uploaded file "${file.originalname}" does not contain any readable text.`,
    });
  }

  const wordCount = countWords(extractedText);
  const charCount = countChars(extractedText);
  const chunks = chunkText(extractedText, 12000);

  const payload: DocumentExtractResponse = {
    filename: file.originalname,
    text: extractedText,
    wordCount,
    charCount,
    chunks,
  };

  const validated = documentExtractResponseSchema.safeParse(payload);
  if (!validated.success) {
    return res.status(500).json({
      error: 'Extracted document payload failed schema validation.',
      details: validated.error.message,
    });
  }

  return res.json(validated.data);
});
