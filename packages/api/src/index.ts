import express from 'express';
import cors from 'cors';
import {
  healthCheckResponseSchema,
  generateQuizRequestSchema,
  generateQuizResponseSchema,
  type HealthCheckResponse,
} from '@docquiz/shared';
import { env } from './env.js';
import { documentsRouter } from './routes/documents.js';
import { generateQuiz } from './services/geminiQuizGenerator.js';

const app = express();
const PORT = env.PORT;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Document extraction route
app.use('/api/documents', documentsRouter);

// Quiz generation route
app.post('/api/generate-quiz', async (req, res) => {
  const parseResult = generateQuizRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid quiz generation payload',
      details: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
  }

  const { text, questionCount } = parseResult.data;

  try {
    const result = await generateQuiz(text, questionCount);
    const validated = generateQuizResponseSchema.safeParse(result);
    if (!validated.success) {
      return res.status(500).json({
        error: 'Generated quiz failed schema validation',
        details: validated.error.message,
      });
    }

    return res.json(validated.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown generation error';
    return res.status(500).json({
      error: 'Failed to generate quiz',
      message,
    });
  }
});

// Health check route
app.get('/api/healthz', (_req, res) => {
  const payload: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };

  const parsed = healthCheckResponseSchema.safeParse(payload);
  if (!parsed.success) {
    res.status(500).json({ error: 'Internal health check validation failed' });
    return;
  }

  res.json(parsed.data);
});

app.listen(PORT, () => {
  console.log(`[API] Server listening on http://localhost:${PORT}`);
});
