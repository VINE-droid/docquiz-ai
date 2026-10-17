import type { QuizQuestion } from '@docquiz/shared';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our',
  'you', 'your', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'into',
  'also', 'from', 'about', 'between', 'through', 'during', 'before', 'after', 'above', 'below',
]);

/**
 * Extracts candidate sentences with substantial factual content.
 */
function extractSentences(text: string): string[] {
  // Normalize whitespace
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
  // Split on sentence terminators (. ! ?)
  const rawSentences = cleanText.split(/(?<=[.!?])\s+/);

  return rawSentences
    .map((s) => s.trim())
    .filter((s) => {
      // Must be between 30 and 300 characters, contain punctuation, and have at least 5 words
      if (s.length < 30 || s.length > 300) return false;
      const words = s.split(/\s+/);
      return words.length >= 5 && words.length <= 45;
    });
}

/**
 * Extracts salient terms/keywords (nouns, capitalized words, acronyms, or multi-syllable terms).
 */
function extractKeywords(sentence: string): string[] {
  const words = sentence
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  // Prioritize capitalized or compound words
  words.sort((a, b) => {
    const aIsCap = /^[A-Z]/.test(a) ? 1 : 0;
    const bIsCap = /^[A-Z]/.test(b) ? 1 : 0;
    if (aIsCap !== bIsCap) return bIsCap - aIsCap;
    return b.length - a.length;
  });

  return words;
}

/**
 * Shuffles an array with Fisher-Yates.
 */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Fallback local quiz generator that builds questions from sentences in the source text,
 * using key terms from other sentences as plausible distractors.
 */
export function generateLocalQuiz(text: string, questionCount: number): QuizQuestion[] {
  const sentences = extractSentences(text);

  // If text doesn't have standard sentences, fall back to line-based or clause-based splits
  const candidatePool = sentences.length >= 2
    ? sentences
    : text
        .split(/[\n;]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20);

  if (candidatePool.length === 0) {
    // Ultimate fallback for very brief text
    const fallbackSentence = text.trim() || 'Document content';
    return [
      {
        question: 'Which of the following directly reflects the source document?',
        options: [
          fallbackSentence.slice(0, 80),
          'Unrelated external concept A',
          'Unrelated external concept B',
          'Unrelated external concept C',
        ],
        correctIndex: 0,
        explanation: `Direct excerpt from document: "${fallbackSentence.slice(0, 100)}"`,
        citation: fallbackSentence.slice(0, 120),
      },
    ];
  }

  // Collect a global pool of key terms across all sentences for distractors
  const allTermsSet = new Set<string>();
  const sentenceKeywordMap = new Map<string, string[]>();

  for (const s of candidatePool) {
    const keywords = extractKeywords(s);
    sentenceKeywordMap.set(s, keywords);
    for (const kw of keywords) {
      allTermsSet.add(kw);
    }
  }

  const globalDistractorPool = Array.from(allTermsSet);

  const questions: QuizQuestion[] = [];
  const targetCount = Math.min(questionCount, Math.max(candidatePool.length, 1));
  const selectedSentences = shuffle(candidatePool);

  for (let i = 0; i < targetCount; i++) {
    // Pick sentence (loop around if needed to satisfy questionCount)
    const sentence = selectedSentences[i % selectedSentences.length];
    const keywords = sentenceKeywordMap.get(sentence) || extractKeywords(sentence);

    let targetTerm = keywords[0];
    if (!targetTerm) {
      targetTerm = 'the primary concept';
    }

    // Build question prompt with a blank or conceptual question
    let questionText = '';
    const termRegex = new RegExp(`\\b${targetTerm}\\b`, 'i');

    if (termRegex.test(sentence)) {
      const blankedSentence = sentence.replace(termRegex, '_______');
      questionText = `Fill in the blank based on the source text: "${blankedSentence}"`;
    } else {
      questionText = `According to the source text, which key term or concept is associated with: "${sentence}"?`;
    }

    // Select 3 distractors from other sentences
    const distractors = globalDistractorPool
      .filter((term) => term.toLowerCase() !== targetTerm.toLowerCase())
      .slice(0, 15);

    const shuffledDistractors = shuffle(distractors);
    const chosenDistractors: string[] = [];

    for (const d of shuffledDistractors) {
      if (chosenDistractors.length >= 3) break;
      if (!chosenDistractors.includes(d)) {
        chosenDistractors.push(d);
      }
    }

    // If not enough unique distractors, fill with generic context-appropriate terms
    const genericBackups = ['Primary mechanism', 'Control parameter', 'Alternative baseline', 'System variable'];
    let backupIdx = 0;
    while (chosenDistractors.length < 3) {
      const backup = genericBackups[backupIdx % genericBackups.length];
      if (!chosenDistractors.includes(backup) && backup.toLowerCase() !== targetTerm.toLowerCase()) {
        chosenDistractors.push(backup);
      }
      backupIdx++;
    }

    // Combine correct answer with 3 distractors and shuffle
    const optionsPool = [targetTerm, chosenDistractors[0], chosenDistractors[1], chosenDistractors[2]];
    const shuffledOptions = shuffle(optionsPool);
    const correctIndex = shuffledOptions.indexOf(targetTerm);

    questions.push({
      question: questionText,
      options: [shuffledOptions[0], shuffledOptions[1], shuffledOptions[2], shuffledOptions[3]],
      correctIndex,
      explanation: `Based on the source text: "${sentence}", the correct answer is "${targetTerm}".`,
      citation: sentence,
    });
  }

  // If user requested more questions than unique sentences, pad up to questionCount
  while (questions.length < questionCount && questions.length > 0) {
    const base = questions[questions.length % targetCount];
    questions.push({
      ...base,
      question: `Review: ${base.question}`,
    });
  }

  return questions.slice(0, questionCount);
}
