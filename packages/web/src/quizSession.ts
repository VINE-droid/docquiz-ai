import {
  type DifficultyMode,
  type QuizQuestion,
  type QuizSession,
} from '@docquiz/shared';

export const QUIZ_SESSION_KEY = 'docquiz_quiz_session';

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createQuizSession(
  questions: QuizQuestion[],
  difficulty: DifficultyMode,
): QuizSession {
  const sessionStartedAt = Date.now();

  return {
    questions: questions.map((question) => ({
      question: question.question,
      options: shuffle(question.options),
      correctValue: question.options[question.correctIndex],
      explanation: question.explanation,
      citation: question.citation,
    })),
    difficulty,
    currentIndex: 0,
    score: 0,
    answers: [],
    selectedValue: null,
    locked: false,
    questionStartedAt: sessionStartedAt,
    completedAt: null,
    createdAt: sessionStartedAt,
  };
}

export function retryQuizSession(
  session: QuizSession,
  mistakesOnly = false,
): QuizSession {
  const questions = session.questions.filter((_, index) => {
    if (!mistakesOnly) return true;
    return session.answers[index]?.correct === false;
  }).map((question) => {
    const correctIndex = question.options.indexOf(question.correctValue);
    if (correctIndex < 0) {
      throw new Error('Quiz question is missing its correct answer.');
    }
    return {
      question: question.question,
      options: question.options,
      correctIndex,
      explanation: question.explanation,
      citation: question.citation,
    };
  });

  if (questions.length === 0) {
    throw new Error('There are no missed questions to retry.');
  }

  return createQuizSession(questions, session.difficulty);
}

export function saveQuizSession(session: QuizSession): void {
  sessionStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(session));
}

export function clearQuizSession(): void {
  sessionStorage.removeItem(QUIZ_SESSION_KEY);
}
