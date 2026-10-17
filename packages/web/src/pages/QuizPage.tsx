import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  quizSessionSchema,
  difficultyConfig,
  type QuizSession,
} from '@docquiz/shared';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Infinity,
  Leaf,
  RotateCcw,
  Quote,
  Target,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  clearQuizSession,
  QUIZ_SESSION_KEY,
  retryQuizSession,
  saveQuizSession,
} from '../quizSession';

type QuizFontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_KEY = 'docquiz_font_size';
const SOUND_KEY = 'docquiz_sound_enabled';
const FONT_SIZE_CLASSES: Record<QuizFontSize, { question: string; option: string; details: string }> = {
  small: { question: 'text-base sm:text-lg', option: 'text-xs', details: 'text-[11px]' },
  medium: { question: 'text-lg sm:text-xl', option: 'text-sm', details: 'text-xs' },
  large: { question: 'text-2xl sm:text-3xl', option: 'text-base', details: 'text-sm' },
};

function readFontSize(): QuizFontSize {
  try {
    const value = localStorage.getItem(FONT_SIZE_KEY);
    return value === 'small' || value === 'large' ? value : 'medium';
  } catch (error) {
    console.error('Could not read quiz font size preference:', error);
    return 'medium';
  }
}

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'true';
  } catch (error) {
    console.error('Could not read quiz sound preference:', error);
    return false;
  }
}

function playAnswerTone(correct: boolean): void {
  if (typeof window.AudioContext === 'undefined') return;

  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = correct ? 660 : 220;
    volume.gain.setValueAtTime(0.0001, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.19);
    oscillator.addEventListener('ended', () => void context.close(), { once: true });
  } catch (error) {
    console.error('Could not play quiz sound effect:', error);
  }
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function loadSession(): QuizSession | null {
  try {
    const raw = sessionStorage.getItem(QUIZ_SESSION_KEY);
    if (!raw) return null;
    const parsed = quizSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function recordTimeout(session: QuizSession): QuizSession {
  const nextIndex = session.currentIndex + 1;
  return {
    ...session,
    answers: [...session.answers, { selectedValue: null, correct: false }],
    currentIndex: nextIndex,
    selectedValue: null,
    locked: false,
    questionStartedAt: Date.now(),
    completedAt: nextIndex >= session.questions.length ? Date.now() : null,
  };
}

function DifficultyIcon({ mode }: { mode: QuizSession['difficulty'] }) {
  if (mode === 'blitz') return <Zap className="h-4 w-4 text-yellow-400" />;
  if (mode === 'challenge') return <Target className="h-4 w-4 text-rose-400" />;
  if (mode === 'relaxed') return <Leaf className="h-4 w-4 text-emerald-400" />;
  return <Infinity className="h-4 w-4 text-slate-400" />;
}

function QuizToolbar({
  fontSize,
  onFontSizeChange,
  soundEnabled,
  onSoundChange,
  onRestart,
}: {
  fontSize: QuizFontSize;
  onFontSizeChange: (size: QuizFontSize) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
      <label className="flex items-center gap-2">
        <span>Font size</span>
        <select
          aria-label="Quiz font size"
          value={fontSize}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'small' || value === 'medium' || value === 'large') {
              onFontSizeChange(value);
            }
          }}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(event) => onSoundChange(event.target.checked)}
          className="accent-indigo-500"
        />
        Sound effects
      </label>
      <button
        type="button"
        onClick={onRestart}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 transition-colors hover:border-indigo-500/60 hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restart quiz
      </button>
    </div>
  );
}

export function QuizPage() {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [fontSize, setFontSize] = useState<QuizFontSize>(readFontSize);
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleFontSizeChange = (size: QuizFontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem(FONT_SIZE_KEY, size);
    } catch (error) {
      console.error('Could not save quiz font size preference:', error);
    }
  };

  const handleSoundChange = (enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(SOUND_KEY, String(enabled));
    } catch (error) {
      console.error('Could not save quiz sound preference:', error);
    }
  };

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      navigate('/');
      return;
    }

    if (stored.currentIndex >= stored.questions.length && stored.completedAt === null) {
      stored.completedAt = Date.now();
      saveQuizSession(stored);
    }

    const seconds = difficultyConfig[stored.difficulty].seconds;
    if (stored.currentIndex < stored.questions.length && seconds !== null && !stored.locked) {
      const remaining = Math.ceil(
        (stored.questionStartedAt + seconds * 1000 - Date.now()) / 1000,
      );
      if (remaining <= 0) {
        const timedOut = recordTimeout(stored);
        saveQuizSession(timedOut);
        setSession(timedOut);
        setTimeLeft(seconds);
        if (timedOut.currentIndex >= timedOut.questions.length) setDone(true);
      } else {
        setSession(stored);
        setTimeLeft(remaining);
      }
    } else {
      setSession(stored);
      setTimeLeft(seconds);
    }

    if (stored.currentIndex >= stored.questions.length) setDone(true);
  }, [navigate]);

  const currentQuestion = session?.questions[session.currentIndex] ?? null;
  const config = session ? difficultyConfig[session.difficulty] : null;
  const isTimed = config?.seconds !== null && config !== null;

  const advance = useCallback(() => {
    if (!session || !currentQuestion || !session.locked) return;

    const correct = session.selectedValue === currentQuestion.correctValue;
    const nextIndex = session.currentIndex + 1;
    const completedAt = nextIndex >= session.questions.length ? Date.now() : null;
    const nextSession: QuizSession = {
      ...session,
      answers: [...session.answers, { selectedValue: session.selectedValue, correct }],
      score: session.score + (correct ? 1 : 0),
      currentIndex: nextIndex,
      selectedValue: null,
      locked: false,
      questionStartedAt: Date.now(),
      completedAt,
    };
    saveQuizSession(nextSession);
    setSession(nextSession);

    if (nextIndex >= session.questions.length) {
      setDone(true);
      return;
    }

    setTimeLeft(config?.seconds ?? null);
  }, [config?.seconds, currentQuestion, session]);

  const pickAnswer = useCallback((value: string) => {
    if (!session || session.locked || !currentQuestion) return;

    const answeredSession: QuizSession = {
      ...session,
      selectedValue: value,
      locked: true,
    };
    if (soundEnabled) playAnswerTone(value === currentQuestion.correctValue);
    saveQuizSession(answeredSession);
    setSession(answeredSession);
  }, [currentQuestion, session, soundEnabled]);

  const startRetry = (mistakesOnly = false) => {
    if (!session) return;
    try {
      const nextSession = retryQuizSession(session, mistakesOnly);
      saveQuizSession(nextSession);
      setSession(nextSession);
      setDone(false);
      setTimeLeft(difficultyConfig[nextSession.difficulty].seconds);
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not restart the quiz.');
    }
  };

  useEffect(() => {
    if (!session || !currentQuestion || !isTimed || session.locked || done || config.seconds === null) {
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((session.questionStartedAt + config.seconds! * 1000 - Date.now()) / 1000),
      );
      setTimeLeft(remaining);

      if (remaining === 0) {
        if (soundEnabled) playAnswerTone(false);
        const timedOut = recordTimeout(session);
        saveQuizSession(timedOut);
        setSession(timedOut);
        setTimeLeft(difficultyConfig[timedOut.difficulty].seconds);
        if (timedOut.currentIndex >= timedOut.questions.length) setDone(true);
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [config, currentQuestion, done, isTimed, session, soundEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return;
      }
      if (event.key === 'Enter' && session?.locked && !done) {
        event.preventDefault();
        advance();
      } else if (/^[1-4]$/.test(event.key) && currentQuestion && !session?.locked) {
        const option = currentQuestion.options[Number(event.key) - 1];
        if (option !== undefined) pickAnswer(option);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, currentQuestion, done, pickAnswer, session?.locked]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
      </div>
    );
  }

  const total = session.questions.length;
  if (done || session.currentIndex >= total) {
    const completedAt = session.completedAt ?? Date.now();
    const elapsed = completedAt - session.createdAt;
    const percentage = total > 0 ? Math.round((session.score / total) * 100) : 0;
    const missedQuestions = session.answers.flatMap((answer, index) => (
      answer.correct ? [] : [{ answer, question: session.questions[index], index }]
    ));

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <QuizToolbar
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
          soundEnabled={soundEnabled}
          onSoundChange={handleSoundChange}
          onRestart={() => startRetry()}
        />
        <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl sm:p-10">
            <Trophy className="mx-auto h-10 w-10 text-amber-400" />
            <h1 className="mt-3 text-2xl font-bold text-white">Quiz results</h1>
            <p className="mt-1 text-slate-400">Final score</p>
            <p className="mt-2 font-mono text-5xl font-extrabold text-white">{percentage}%</p>
            <p className="mt-2 text-sm text-slate-300">{session.score} correct out of {total}</p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Correct</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-300">{session.score} / {total}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Total time</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">{formatDuration(elapsed)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Average per question</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {total > 0 ? `${(elapsed / total / 1000).toFixed(1)}s` : '—'}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Mistake review</h2>
              <span className="rounded-full border border-rose-900/70 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-300">
                {missedQuestions.length} missed
              </span>
            </div>
            {missedQuestions.length === 0 ? (
              <p className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-5 text-sm text-emerald-200">
                Perfect score — no mistakes to review.
              </p>
            ) : (
              <div className="space-y-3">
                {missedQuestions.map(({ answer, question, index }) => question && (
                  <article key={index} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                    <h3 className={`${FONT_SIZE_CLASSES[fontSize].option} font-semibold leading-snug text-white`}>
                      <span className="mr-2 text-xs font-mono text-slate-500">Q{index + 1}</span>
                      {question.question}
                    </h3>
                    <div className={`grid gap-2 sm:grid-cols-2 ${FONT_SIZE_CLASSES[fontSize].details}`}>
                      <p className="rounded-lg bg-rose-950/30 p-3 text-rose-200">
                        <span className="block text-xs text-rose-400">Your answer</span>
                        {answer.selectedValue ?? 'Timed out — no answer selected'}
                      </p>
                      <p className="rounded-lg bg-emerald-950/30 p-3 text-emerald-200">
                        <span className="block text-xs text-emerald-400">Correct answer</span>
                        {question.correctValue}
                      </p>
                    </div>
                    <p className={`${FONT_SIZE_CLASSES[fontSize].details} leading-relaxed text-slate-300`}>
                      <span className="font-semibold text-slate-200">Explanation: </span>
                      {question.explanation}
                    </p>
                    <p className={`flex items-start gap-2 ${FONT_SIZE_CLASSES[fontSize].details} leading-relaxed text-slate-400`}>
                      <Quote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <span><span className="font-semibold text-slate-300">Source: </span>{question.citation}</span>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {actionError && (
            <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-300">
              {actionError}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => startRetry()}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
            >
              Retry same quiz
            </button>
            <button
              onClick={() => startRetry(true)}
              disabled={missedQuestions.length === 0}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retry mistakes only
            </button>
            <button
              onClick={() => {
                clearQuizSession();
                sessionStorage.removeItem('docquiz_extracted_document');
                sessionStorage.removeItem('docquiz_generated_quiz');
                navigate('/');
              }}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              New document
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!currentQuestion || !config) return null;

  const timerPercent = isTimed && config.seconds !== null && timeLeft !== null
    ? Math.max(0, (timeLeft / config.seconds) * 100)
    : 100;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit Quiz</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-3 text-xs">
            <span className="font-mono font-bold text-slate-300">
              {session.currentIndex + 1} / {total}
            </span>
            <div className="h-1.5 max-w-[160px] flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(session.currentIndex / total) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-300">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="font-mono">{session.score} / {total}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-400">
              <DifficultyIcon mode={session.difficulty} />
              <span>{config.label}</span>
            </div>
          </div>
        </div>

        <QuizToolbar
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
          soundEnabled={soundEnabled}
          onSoundChange={handleSoundChange}
          onRestart={() => startRetry()}
        />

        {isTimed && (
          <div className="h-1 w-full bg-slate-800/80">
            <div
              className={`h-full transition-[width] duration-250 ${
                timeLeft !== null && config.seconds !== null && timeLeft / config.seconds > 0.5
                  ? 'bg-emerald-500'
                  : timeLeft !== null && config.seconds !== null && timeLeft / config.seconds > 0.25
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-3xl space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-500">
              Question {session.currentIndex + 1} of {total}
            </span>
            {isTimed && !session.locked && timeLeft !== null && (
              <div className={`flex items-center gap-1.5 font-mono text-sm font-bold ${
                timeLeft <= 5 ? 'animate-pulse text-rose-400' :
                timeLeft <= 10 ? 'text-amber-400' : 'text-slate-300'
              }`}>
                <Timer className="h-4 w-4" /> {timeLeft}s
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
            <p className={`${FONT_SIZE_CLASSES[fontSize].question} font-semibold leading-snug text-white`}>
              {currentQuestion.question}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = option === currentQuestion.correctValue;
              const isSelected = option === session.selectedValue;
              const state = !session.locked ? 'idle' : isCorrect ? 'correct' : isSelected ? 'wrong' : 'neutral';
              return (
                <button
                  key={`${index}-${option}`}
                  id={`option-${index}`}
                  onClick={() => pickAnswer(option)}
                  disabled={session.locked}
                  className={`group relative w-full rounded-xl border p-4 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    state === 'idle' ? 'cursor-pointer border-slate-800 bg-slate-900/60 hover:border-indigo-500/60 hover:bg-indigo-950/20 active:scale-[0.98]' :
                    state === 'correct' ? 'cursor-default border-emerald-500/70 bg-emerald-950/40 shadow-md' :
                    state === 'wrong' ? 'cursor-default border-rose-500/60 bg-rose-950/40' :
                    'cursor-default border-slate-800/50 bg-slate-950/30 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      state === 'correct' ? 'bg-emerald-500 text-slate-950' :
                      state === 'wrong' ? 'bg-rose-500 text-white' :
                      state === 'neutral' ? 'bg-slate-700 text-slate-400' :
                      'bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                      {state === 'correct' ? <CheckCircle2 className="h-4 w-4" /> :
                       state === 'wrong' ? <XCircle className="h-4 w-4" /> : String(index + 1)}
                    </span>
                    <span className={`text-sm font-medium leading-snug ${
                      state === 'correct' ? 'text-emerald-200' :
                      state === 'wrong' ? 'text-rose-200' :
                      state === 'neutral' ? 'text-slate-500' : 'text-slate-200'
                    } ${FONT_SIZE_CLASSES[fontSize].option}`}>{option}</span>
                    {state === 'idle' && (
                      <span className="ml-auto text-[10px] font-mono text-slate-600 transition-colors group-hover:text-indigo-400">
                        {index + 1}
                      </span>
                    )}
                    {state === 'correct' && (
                      <span className="ml-auto rounded border border-emerald-700/50 bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Correct
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {session.locked && session.selectedValue === null && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-950/40 p-3 text-xs font-medium text-amber-300">
              <Timer className="h-4 w-4 shrink-0" />
              Time&apos;s up! The correct answer is highlighted above.
            </div>
          )}

          {session.locked && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold text-slate-200">Explanation: </span>
                  <span className="text-slate-300">{currentQuestion.explanation}</span>
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-950/60 p-4">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold text-slate-300">Source: </span>
                  <span className="font-mono italic text-slate-400">&ldquo;{currentQuestion.citation}&rdquo;</span>
                </p>
              </div>
              <button
                id="next-btn"
                onClick={advance}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-500 active:scale-[0.98]"
              >
                {session.currentIndex + 1 >= total ? 'Finish Quiz' : 'Next Question'}
                <ChevronRight className="h-4 w-4" />
                <span className="ml-1 text-xs font-normal text-indigo-300">Enter</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
