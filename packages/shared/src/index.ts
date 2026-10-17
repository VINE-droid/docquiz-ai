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

export const difficultyModeSchema = z.enum(['blitz', 'challenge', 'relaxed', 'untimed']);
export type DifficultyMode = z.infer<typeof difficultyModeSchema>;

export const difficultyConfig = {
  blitz:     { label: 'Blitz',     seconds: 10,  emoji: '⚡' },
  challenge: { label: 'Challenge', seconds: 20,  emoji: '🎯' },
  relaxed:   { label: 'Relaxed',   seconds: 45,  emoji: '🧘' },
  untimed:   { label: 'Untimed',   seconds: null, emoji: '♾️' },
} as const;

// A question with options shuffled, but correct answer tracked by value
export const shuffledQuestionSchema = z.object({
  question:     z.string(),
  options:      z.array(z.string()).length(4),
  correctValue: z.string(),   // The text of the correct option
  explanation:  z.string(),
  citation:     z.string(),
}).refine((question) => question.options.includes(question.correctValue));
export type ShuffledQuestion = z.infer<typeof shuffledQuestionSchema>;

export const quizSessionSchema = z.object({
  questions:    z.array(shuffledQuestionSchema),
  difficulty:   difficultyModeSchema,
  currentIndex: z.number().int().min(0),
  score:        z.number().int().min(0),
  answers:      z.array(z.object({
    selectedValue: z.string().nullable(),   // null = timed out
    correct:       z.boolean(),
  })),
  selectedValue: z.string().nullable(),
  locked:       z.boolean(),
  questionStartedAt: z.number(),
  completedAt:  z.number().nullable().default(null),
  createdAt:    z.number(),  // Date.now()
});
export type QuizSession = z.infer<typeof quizSessionSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
