import { z } from 'zod';
import { quizQuestionSchema, type QuizQuestion } from '@docquiz/shared';
import { env } from '../env.js';
import { generateLocalQuiz } from './localQuizGenerator.js';
import { selectRelevantChunks } from './chunkSelector.js';

const questionsArraySchema = z.array(quizQuestionSchema);

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Extracts and parses JSON from Gemini text response, removing any markdown code blocks if present.
 */
function parseJsonFromText(rawText: string): unknown {
  const trimmed = rawText.trim();
  // Strip ```json and ``` if returned
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  // If returned an object with a questions key { questions: [...] }, unwrap it
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray((parsed as any).questions)) {
    return (parsed as any).questions;
  }

  return parsed;
}

/**
 * Calls Gemini 2.5 Flash API with generationConfig.responseMimeType = "application/json"
 */
async function callGeminiApi(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as GeminiApiResponse;
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    throw new Error('Gemini API returned an empty candidate text.');
  }

  return generatedText;
}

function buildPrompt(documentContext: string, questionCount: number, errorFeedback?: string): string {
  return `You are an expert instructional designer and examination architect.
Generate exactly ${questionCount} high-quality, rigorous multiple-choice questions based strictly on the provided document text.

Requirements:
1. Each question must test understanding of key concepts, definitions, mechanisms, or relationships in the source text.
2. Provide exactly four options per question.
3. Provide the 0-based index of the correct answer (correctIndex: 0, 1, 2, or 3).
4. Provide a clear, educational explanation explaining why the correct choice is accurate and why the other options are incorrect.
5. Provide a short citation directly quoting verbatim text from the source document that supports the answer.
6. Format output strictly as a JSON array matching this exact schema:
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0,
    "explanation": "string",
    "citation": "string"
  }
]
${errorFeedback ? `\nIMPORTANT: Your previous output had the following error:\n${errorFeedback}\nEnsure output is strictly valid JSON conforming exactly to the schema above.\n` : ''}

SOURCE DOCUMENT CONTENT:
"""
${documentContext}
"""`;
}

/**
 * Generates quiz questions using Google Gemini (gemini-2.5-flash), with automatic Zod validation,
 * single retry on invalid model output, and graceful fallback to the local generator if the API key
 * is missing or the external call fails.
 */
export async function generateQuiz(
  text: string,
  questionCount: number
): Promise<{ questions: QuizQuestion[]; source: 'gemini' | 'local' }> {
  const boundedCount = Math.min(Math.max(1, questionCount), 30);

  // If no API key configured, seamlessly fall back to local generator
  if (!env.hasGeminiKey) {
    console.log('[QuizGen] No GEMINI_API_KEY found in environment. Using local question generator.');
    const questions = generateLocalQuiz(text, boundedCount);
    return { questions, source: 'local' };
  }

  // Pick the most relevant chunks for long documents
  const documentContext = selectRelevantChunks(text, 25000);

  // Attempt 1: Call Gemini
  try {
    const prompt1 = buildPrompt(documentContext, boundedCount);
    const rawResult1 = await callGeminiApi(prompt1, env.GEMINI_API_KEY);
    const parsedJson1 = parseJsonFromText(rawResult1);
    const validation1 = questionsArraySchema.safeParse(parsedJson1);

    if (validation1.success && validation1.data.length > 0) {
      return {
        questions: validation1.data.slice(0, boundedCount),
        source: 'gemini',
      };
    }

    // Validation failed on attempt 1, retry once
    const errorDetails = validation1.success ? 'Returned empty question array' : validation1.error.message;
    console.warn(`[QuizGen] Attempt 1 validation failed: ${errorDetails}. Retrying once with error feedback...`);

    const prompt2 = buildPrompt(documentContext, boundedCount, errorDetails);
    const rawResult2 = await callGeminiApi(prompt2, env.GEMINI_API_KEY);
    const parsedJson2 = parseJsonFromText(rawResult2);
    const validation2 = questionsArraySchema.safeParse(parsedJson2);

    if (validation2.success && validation2.data.length > 0) {
      return {
        questions: validation2.data.slice(0, boundedCount),
        source: 'gemini',
      };
    }

    console.warn('[QuizGen] Attempt 2 validation also failed. Falling back to local generator.');
  } catch (apiError) {
    console.warn(
      `[QuizGen] Gemini API request failed: ${apiError instanceof Error ? apiError.message : String(apiError)}. Falling back to local generator.`
    );
  }

  // Fallback to local generator
  const fallbackQuestions = generateLocalQuiz(text, boundedCount);
  return { questions: fallbackQuestions, source: 'local' };
}
