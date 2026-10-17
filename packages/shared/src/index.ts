import { z } from 'zod';

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number().optional(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

export const documentExtractResponseSchema = z.object({
  filename: z.string(),
  text: z.string(),
  wordCount: z.number(),
  charCount: z.number(),
  chunks: z.array(z.string()),
});

export type DocumentExtractResponse = z.infer<typeof documentExtractResponseSchema>;

export const quizQuestionSchema = z.object({
  question: z.string().min(1, 'Question text cannot be empty'),
  options: z.array(z.string()).length(4, 'Must provide exactly four options'),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1, 'Explanation cannot be empty'),
  citation: z.string().min(1, 'Citation cannot be empty'),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const generateQuizRequestSchema = z.object({
  text: z.string().min(1, 'Source text cannot be empty'),
  questionCount: z.number().int().min(1).max(30).default(5),
});

export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;

export const generateQuizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema),
  source: z.enum(['gemini', 'local']).optional(),
});

export type GenerateQuizResponse = z.infer<typeof generateQuizResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
