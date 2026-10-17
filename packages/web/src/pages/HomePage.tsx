import { useState, useEffect, useRef, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import {
  documentExtractResponseSchema,
  difficultyConfig,
  generateQuizResponseSchema,
  type DifficultyMode,
  type DocumentExtractResponse,
  type QuizQuestion,
} from '@docquiz/shared';
import { useLocation } from 'wouter';
import { createQuizSession, saveQuizSession } from '../quizSession';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Hash,
  Type,
  Layers,
  ArrowRight,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  FileSpreadsheet,
  File,
  Sparkles,
  HelpCircle,
  BrainCircuit,
  Quote,
  Zap,
  Target,
  Leaf,
  Infinity,
} from 'lucide-react';

const STORAGE_KEY = 'docquiz_extracted_document';
const QUIZ_STORAGE_KEY = 'docquiz_generated_quiz';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.csv', '.json'];
const PRESET_COUNTS = [3, 5, 7, 10];

export function HomePage() {
  const [, navigate] = useLocation();
  const [extractedDoc, setExtractedDoc] = useState<DocumentExtractResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chunks' | 'fullText'>('chunks');
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const [copiedChunk, setCopiedChunk] = useState<number | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);

  // Quiz Generation State
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountValue, setCustomCountValue] = useState<string>('5');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizSource, setQuizSource] = useState<'gemini' | 'local' | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyMode>('challenge');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const questionsListRef = useRef<HTMLDivElement | null>(null);

  // Initialize document and quiz from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const result = documentExtractResponseSchema.safeParse(parsed);
        if (result.success) {
          setExtractedDoc(result.data);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }

      const storedQuiz = sessionStorage.getItem(QUIZ_STORAGE_KEY);
      if (storedQuiz) {
        const parsedQuiz = JSON.parse(storedQuiz);
        const result = generateQuizResponseSchema.safeParse(parsedQuiz);
        if (result.success) {
          setGeneratedQuestions(result.data.questions);
          setQuizSource(result.data.source || null);
        } else {
          sessionStorage.removeItem(QUIZ_STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(QUIZ_STORAGE_KEY);
    }
  }, []);

  const saveExtractedDocument = (data: DocumentExtractResponse | null) => {
    setExtractedDoc(data);
    setSelectedChunkIndex(0);
    setGeneratedQuestions(null);
    setQuizSource(null);
    setQuizError(null);
    sessionStorage.removeItem(QUIZ_STORAGE_KEY);

    if (data) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const uploadFile = async (file: globalThis.File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMessage(
        `Unsupported file type "${ext}". Supported formats: PDF, DOCX, TXT, MD, CSV, JSON.`
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 25 MB limit.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/extract', {
        method: 'POST',
        body: formData,
      });

      const responseJson = await response.json();

      if (!response.ok) {
        const errorText = responseJson?.error || `Upload failed (Status ${response.status})`;
        throw new Error(errorText);
      }

      const parsed = documentExtractResponseSchema.safeParse(responseJson);
      if (!parsed.success) {
        throw new Error('Server response does not match the expected schema.');
      }

      saveExtractedDocument(parsed.data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during extraction.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      uploadFile(droppedFile);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleSelectPreset = (count: number) => {
    setIsCustomCount(false);
    setQuestionCount(count);
  };

  const handleCustomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCountValue(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
      setQuestionCount(parsed);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!extractedDoc?.text) return;

    setIsGeneratingQuiz(true);
    setQuizError(null);

    const boundedCount = Math.min(Math.max(1, questionCount), 30);

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: extractedDoc.text,
          questionCount: boundedCount,
        }),
      });

      const responseJson = await response.json();

      if (!response.ok) {
        const msg = responseJson?.error || responseJson?.message || `Quiz generation failed (${response.status})`;
        throw new Error(msg);
      }

      const parsed = generateQuizResponseSchema.safeParse(responseJson);
      if (!parsed.success) {
        throw new Error('Received invalid quiz questions schema from server.');
      }

      setGeneratedQuestions(parsed.data.questions);
      setQuizSource(parsed.data.source || null);
      sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(parsed.data));

      // Smooth scroll to questions list
      setTimeout(() => {
        questionsListRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Failed to generate quiz.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleStartQuiz = () => {
    if (!generatedQuestions?.length) return;
    saveQuizSession(createQuizSession(generatedQuestions, difficulty));
    navigate('/quiz');
  };

  const difficultyModes: DifficultyMode[] = ['blitz', 'challenge', 'relaxed', 'untimed'];
  const difficultyIcons: Record<DifficultyMode, ReactNode> = {
    blitz: <Zap className="w-4 h-4 text-yellow-400" />,
    challenge: <Target className="w-4 h-4 text-rose-400" />,
    relaxed: <Leaf className="w-4 h-4 text-emerald-400" />,
    untimed: <Infinity className="w-4 h-4 text-slate-400" />,
  };

  const copyToClipboard = async (text: string, isFullText = false, chunkIdx?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isFullText) {
        setCopiedFull(true);
        setTimeout(() => setCopiedFull(false), 2000);
      } else if (chunkIdx !== undefined) {
        setCopiedChunk(chunkIdx);
        setTimeout(() => setCopiedChunk(null), 2000);
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-400" />;
    if (ext === 'docx') return <FileText className="w-5 h-5 text-blue-400" />;
    if (ext === 'json') return <FileCode className="w-5 h-5 text-amber-400" />;
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    if (ext === 'md') return <FileText className="w-5 h-5 text-purple-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  DocQuiz AI
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Ingestion & Quiz Synthesis
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {extractedDoc && (
              <button
                id="clear-doc-button"
                onClick={() => saveExtractedDocument(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 transition-colors"
                title="Clear current document"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Document</span>
              </button>
            )}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Extraction & Quiz Engine Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-3 text-rose-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Extraction Error</p>
              <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-400 hover:text-rose-200 font-mono px-2 py-1 rounded hover:bg-rose-900/40"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Desk (Shown when no document is active) */}
        {!extractedDoc ? (
          <div className="max-w-2xl mx-auto space-y-6 pt-4">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Document Upload Desk
              </h1>
              <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
                Upload your document to automatically extract text, partition it into 12,000-character semantic chunks, and synthesize AI-generated quizzes.
              </p>
            </div>

            {/* Drag & Drop Desk Card */}
            <div
              id="upload-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-10 transition-all duration-200 text-center flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-950/20 shadow-2xl shadow-indigo-500/20 scale-[1.01]'
                  : isUploading
                  ? 'border-indigo-500/50 bg-slate-900/60 cursor-wait'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 shadow-xl'
              }`}
            >
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="py-6 flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <UploadCloud className="w-7 h-7 text-indigo-400 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white animate-pulse">
                      Processing Document...
                    </p>
                    <p className="text-xs text-slate-400">
                      Parsing text, tokenizing boundaries, and generating semantic chunks
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 mx-auto flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-900/60 transition-all duration-200 shadow-lg shadow-indigo-950">
                    <UploadCloud className="w-8 h-8" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-base font-medium text-slate-200">
                      <span className="text-indigo-400 font-semibold hover:underline">
                        Click to browse
                      </span>{' '}
                      or drag and drop your document here
                    </div>
                    <p className="text-xs text-slate-400">
                      Supports PDF, DOCX, TXT, MD, CSV, and JSON (up to 25 MB)
                    </p>
                  </div>

                  {/* Format Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {['PDF', 'DOCX', 'TXT', 'MD', 'CSV', 'JSON'].map((fmt) => (
                      <span
                        key={fmt}
                        className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>

                  {/* Quick Sample Document Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      id="load-sample-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const sampleContent = `# Deep Learning and Neural Network Architectures

## 1. Overview
Artificial intelligence and deep learning models utilize multi-layered artificial neural networks to model complex nonlinear representations of data. Supervised learning algorithms rely on labeled training examples to optimize weights through backpropagation and stochastic gradient descent.

## 2. Transformer Architectures & Self-Attention
The Transformer model, introduced in 2017, replaces recurrent sequential operations with scaled dot-product self-attention mechanisms. Self-attention calculates attention weights dynamically between all token pairs in parallel, enabling rapid training on modern GPU clusters.

## 3. Retrieval-Augmented Generation & Educational Synthesis
Retrieval-Augmented Generation (RAG) grounds language model outputs in external factual reference documents. In automated assessment generation, RAG partitions textbooks and documents into semantically coherent chunks, extracting core concepts, definitions, and relationships to formulate high-discrimination multiple-choice evaluation items.`;
                        const sampleFile = new globalThis.File([sampleContent], 'deep_learning_overview.md', {
                          type: 'text/markdown',
                        });
                        uploadFile(sampleFile);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/60 transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Load Sample Document (Demo)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 flex items-center gap-3 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Extracted documents and quizzes are cached locally in your browser session for seamless access.
              </span>
            </div>
          </div>
        ) : (
          /* Extracted Document Overview & Quiz Generation */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Document Header Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shadow-inner">
                  {getFileIcon(extractedDoc.filename)}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-white tracking-tight break-all">
                      {extractedDoc.filename}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Extracted
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Document parsed and partitioned into ~12,000 character chunks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="reupload-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750 transition-colors shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
                  <span>Upload Different Document</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Word Count */}
              <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider">Word Count</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Type className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                  {extractedDoc.wordCount.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Total words parsed</p>
              </div>

              {/* Character Count */}
              <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider">Character Count</span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Hash className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                  {extractedDoc.charCount.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Raw character length</p>
              </div>

              {/* Chunk Count */}
              <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider">Chunk Count</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                  {extractedDoc.chunks.length}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">~12k chars per chunk</p>
              </div>

              {/* Storage State */}
              <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider">Session Cache</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-lg font-bold text-emerald-400 tracking-tight">
                  Active in Cache
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Ready for quiz generation</p>
              </div>
            </div>

            {/* Quiz Generation Control Desk Card */}
            <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      AI Quiz Synthesis Desk
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Gemini 2.5 Flash / Fallback
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Select how many multiple-choice questions you want to generate. Questions include 4 options, verified correct index, explanation, and text citations.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4" role="group" aria-label="Quiz difficulty">
                    {difficultyModes.map((mode) => {
                      const config = difficultyConfig[mode];
                      const isSelected = difficulty === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          id={`difficulty-${mode}`}
                          aria-pressed={isSelected}
                          onClick={() => setDifficulty(mode)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-500/15 text-white'
                              : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          {difficultyIcons[mode]}
                          <span>
                            <span className="block text-xs font-semibold">{config.label}</span>
                            <span className="block text-[10px] text-slate-500">
                              {config.seconds === null ? 'No timer' : `${config.seconds}s / question`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Count Selector & Generate Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Selector Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
                    {PRESET_COUNTS.map((count) => {
                      const isSelected = !isCustomCount && questionCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          id={`preset-count-${count}`}
                          onClick={() => handleSelectPreset(count)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                          }`}
                        >
                          {count}
                        </button>
                      );
                    })}

                    {/* Custom button / input */}
                    {isCustomCount ? (
                      <div className="flex items-center px-2 py-0.5">
                        <span className="text-[11px] text-slate-400 mr-1.5 font-medium">Qty:</span>
                        <input
                          id="custom-count-input"
                          type="number"
                          min="1"
                          max="30"
                          value={customCountValue}
                          onChange={handleCustomChange}
                          className="w-14 bg-slate-900 border border-indigo-500/60 rounded px-2 py-1 text-xs text-center font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="1-30"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="preset-count-custom"
                        onClick={() => {
                          setIsCustomCount(true);
                          setCustomCountValue(String(questionCount));
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                      >
                        Custom
                      </button>
                    )}
                  </div>

                  {/* Generate Button */}
                  <button
                    id="generate-quiz-button"
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Generating Quiz ({questionCount} Qs)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-indigo-200" />
                        <span>Generate Quiz ({questionCount})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quiz Generation Error Notification */}
              {quizError && (
                <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center justify-between text-xs text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{quizError}</span>
                  </div>
                  <button
                    onClick={() => setQuizError(null)}
                    className="text-[11px] underline hover:text-rose-200 ml-4"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Generated Questions Display (Plain list confirming generation works) */}
            {generatedQuestions && generatedQuestions.length > 0 && (
              <div
                ref={questionsListRef}
                id="generated-quiz-results"
                className="bg-slate-900/80 border border-indigo-900/50 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-extrabold text-white tracking-tight">
                        Generated Quiz Questions
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {generatedQuestions.length} Questions
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Plain verification list verifying schema conformity, options distribution, explanations, and citations.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {quizSource && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                        Engine: <span className="font-semibold text-white capitalize">{quizSource === 'gemini' ? 'Gemini 2.5 Flash' : 'Local Fallback'}</span>
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(generatedQuestions, null, 2))}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
                      title="Copy Questions JSON"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </button>
                    <button
                      id="start-quiz-button"
                      onClick={handleStartQuiz}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-500"
                    >
                      Start Quiz <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Plain List of Questions */}
                <div className="space-y-6">
                  {generatedQuestions.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      id={`question-item-${qIndex + 1}`}
                      className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4 hover:border-slate-750 transition-colors"
                    >
                      {/* Question Header */}
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-mono font-bold text-indigo-400 shrink-0">
                          {qIndex + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-base font-semibold text-slate-100 leading-snug">
                            {q.question}
                          </p>
                        </div>
                      </div>

                      {/* 4 Options Grid/List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pl-10">
                        {q.options.map((option, optIndex) => {
                          const isCorrect = optIndex === q.correctIndex;
                          const optionLabel = String.fromCharCode(65 + optIndex); // A, B, C, D
                          return (
                            <div
                              key={optIndex}
                              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                isCorrect
                                  ? 'bg-emerald-950/30 border-emerald-600/50 text-emerald-200 font-medium'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                                    isCorrect
                                      ? 'bg-emerald-500 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {optionLabel}
                                </span>
                                <span>{option}</span>
                              </div>
                              {isCorrect && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/50">
                                  <Check className="w-3 h-3" /> Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation & Citation */}
                      <div className="pl-10 space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div className="flex items-start gap-2 text-slate-300">
                          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-200">Explanation: </span>
                            <span className="text-slate-300 leading-relaxed">{q.explanation}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60">
                          <Quote className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-300">Source Citation: </span>
                            <span className="italic text-slate-400 font-mono text-[11px]">"{q.citation}"</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inspection Tabs & Viewer */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              {/* Tab Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-2">
                  <button
                    id="tab-chunks"
                    onClick={() => setActiveTab('chunks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'chunks'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Chunks Inspector ({extractedDoc.chunks.length})
                  </button>
                  <button
                    id="tab-fulltext"
                    onClick={() => setActiveTab('fullText')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'fullText'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    Full Text Preview
                  </button>
                </div>

                {activeTab === 'fullText' ? (
                  <button
                    onClick={() => copyToClipboard(extractedDoc.text, true)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60"
                  >
                    {copiedFull ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFull ? 'Copied Full Text' : 'Copy Full Text'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => copyToClipboard(extractedDoc.chunks[selectedChunkIndex] || '', false, selectedChunkIndex)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60"
                  >
                    {copiedChunk === selectedChunkIndex ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedChunk === selectedChunkIndex ? 'Copied Chunk' : 'Copy Active Chunk'}</span>
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              <div className="p-6">
                {activeTab === 'chunks' ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Chunk Selectors List */}
                    <div className="md:col-span-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Select a Chunk
                      </div>
                      {extractedDoc.chunks.map((chunk, index) => {
                        const isSelected = selectedChunkIndex === index;
                        const chunkWords = chunk.trim().split(/\s+/).filter(Boolean).length;
                        return (
                          <div
                            key={index}
                            onClick={() => setSelectedChunkIndex(index)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/40 text-white'
                                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-755 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                                Chunk {index + 1}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {chunk.length.toLocaleString()} chars
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                              <span>{chunkWords.toLocaleString()} words</span>
                              <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                                View <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Chunk Content Preview */}
                    <div className="md:col-span-8 flex flex-col">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
                        <span>Chunk #{selectedChunkIndex + 1} Content</span>
                        <span className="font-mono">
                          {extractedDoc.chunks[selectedChunkIndex]?.length.toLocaleString() || 0} characters
                        </span>
                      </div>
                      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 h-[450px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-600 selection:text-white">
                        {extractedDoc.chunks[selectedChunkIndex] || 'No content in this chunk.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Full Text Preview */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Full Extracted Text Buffer</span>
                      <span className="font-mono">{extractedDoc.charCount.toLocaleString()} total characters</span>
                    </div>
                    <div className="bg-slate-950/80 rounded-xl p-5 border border-slate-800/80 h-[500px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-600 selection:text-white">
                      {extractedDoc.text}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
