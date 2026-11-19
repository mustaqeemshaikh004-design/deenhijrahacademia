import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  GraduationCap,
  Loader2,
  RotateCcw,
  Upload,
  X,
  XCircle,
  BookOpen,
} from 'lucide-react';
import type { AcademicAssessment, StudentSubmission } from '../types';
import {
  getAuthHeaders,
  uploadPdfDocumentSmart,
} from '../services/firebaseService';

export interface ModuleQuizRunnerProps {
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  assessment: AcademicAssessment;
  studentId: string;
  studentName: string;
  existingSubmission?: StudentSubmission;
  onSubmitted: (submission: StudentSubmission) => void;
  onClose: () => void;
  onViewTranscript?: () => void;
  onRefreshData?: () => void;
}

interface GradedSummaryState {
  submission: StudentSubmission;
  score: number;
  maxPoints: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  passingScorePercent: number;
  status: 'submitted' | 'graded';
  feedback?: string;
  answers: number[];
}

const formatCountdown = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const ModuleQuizRunner: React.FC<ModuleQuizRunnerProps> = ({
  courseId,
  courseCode,
  courseTitle,
  assessment,
  studentId,
  studentName,
  existingSubmission,
  onSubmitted,
  onClose,
  onViewTranscript,
  onRefreshData,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const questions = useMemo(
    () => (Array.isArray(assessment.quizQuestions) ? assessment.quizQuestions : []),
    [assessment.quizQuestions]
  );
  const passThreshold = assessment.passingScorePercent ?? 70;

  const buildResultFromSubmission = (sub: StudentSubmission): GradedSummaryState => {
    const answers = Array.isArray(sub.quizAnswers) ? sub.quizAnswers : [];
    const totalQ = questions.length;
    const hits =
      typeof sub.correctCount === 'number'
        ? sub.correctCount
        : questions.reduce((acc, q, i) => (answers[i] === q.correctIndex ? acc + 1 : acc), 0);
    const maxPts = sub.maxPoints || assessment.points || 100;
    const scoreVal = sub.grade ?? sub.quizScore ?? 0;
    const pct =
      totalQ > 0
        ? Math.round((hits / totalQ) * 100)
        : Math.round((scoreVal / Math.max(1, maxPts)) * 100);
    return {
      submission: sub,
      score: scoreVal,
      maxPoints: maxPts,
      percentage: pct,
      correctCount: hits,
      totalQuestions: totalQ,
      passed: typeof sub.passed === 'boolean' ? sub.passed : pct >= passThreshold,
      passingScorePercent: passThreshold,
      status: sub.status,
      feedback: sub.feedback,
      answers,
    };
  };

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => new Array(questions.length).fill(-1));
  const [writtenNotes, setWrittenNotes] = useState('');
  const [examFile, setExamFile] = useState<{ url: string; name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    assessment.durationMinutes ? assessment.durationMinutes * 60 : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradedSummaryState | null>(() =>
    existingSubmission ? buildResultFromSubmission(existingSubmission) : null
  );

  // Reset quiz state cleanly when assessment target changes
  useEffect(() => {
    setStep(0);
    setAnswers(new Array(questions.length).fill(-1));
    setWrittenNotes('');
    setExamFile(null);
    setSecondsLeft(assessment.durationMinutes ? assessment.durationMinutes * 60 : null);
    setError(null);
    setResult(existingSubmission ? buildResultFromSubmission(existingSubmission) : null);
  }, [assessment.id]);

  // Live exam/quiz countdown timer
  useEffect(() => {
    if (result || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void handleSubmitQuiz(true);
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [result, secondsLeft]);

  const handleStartRetake = () => {
    setResult(null);
    setStep(0);
    setAnswers(new Array(questions.length).fill(-1));
    setWrittenNotes('');
    setExamFile(null);
    setError(null);
    setSecondsLeft(assessment.durationMinutes ? assessment.durationMinutes * 60 : null);
  };

  const handleSelectOption = (qIndex: number, optionIndex: number) => {
    setError(null);
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optionIndex;
      return next;
    });
  };

  const handleExamFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingFile(true);
    try {
      const uploaded = await uploadPdfDocumentSmart('student_submission', file);
      setExamFile({ url: uploaded.url, name: uploaded.fileName });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmitQuiz = async (autoTriggered = false) => {
    if (submitting) return;
    setError(null);

    if (
      !autoTriggered &&
      questions.length > 0 &&
      answers.slice(0, questions.length).some((ans) => ans < 0)
    ) {
      const firstUnanswered = answers.findIndex((ans) => ans < 0);
      if (firstUnanswered >= 0) setStep(firstUnanswered);
      setError('Please answer every question before submitting for auto-grading.');
      return;
    }

    if (
      !autoTriggered &&
      assessment.type === 'exam' &&
      questions.length === 0 &&
      !writtenNotes.trim() &&
      !examFile
    ) {
      setError('Please enter written exam answers or upload a file.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/assessments/${encodeURIComponent(assessment.id)}/submit`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            courseId,
            studentId,
            studentName,
            type: assessment.type,
            content: writtenNotes.trim() || undefined,
            fileUrl: examFile?.url,
            fileName: examFile?.name,
            quizAnswers: questions.length > 0 ? answers : undefined,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.submission) {
        throw new Error(data?.error || 'Unable to save your quiz submission.');
      }

      const savedSub: StudentSubmission = data.submission;
      onSubmitted(savedSub);

      const totalQ = typeof data.totalQuestions === 'number' ? data.totalQuestions : questions.length;
      const hits =
        typeof data.correctCount === 'number'
          ? data.correctCount
          : questions.reduce((acc, q, i) => (answers[i] === q.correctIndex ? acc + 1 : acc), 0);
      const maxPts = savedSub.maxPoints || assessment.points || 100;
      const scoreVal = savedSub.grade ?? savedSub.quizScore ?? 0;
      const pct =
        typeof data.percentage === 'number'
          ? data.percentage
          : totalQ > 0
          ? Math.round((hits / totalQ) * 100)
          : Math.round((scoreVal / Math.max(1, maxPts)) * 100);

      setResult({
        submission: savedSub,
        score: scoreVal,
        maxPoints: maxPts,
        percentage: pct,
        correctCount: hits,
        totalQuestions: totalQ,
        passed: typeof data.passed === 'boolean' ? data.passed : pct >= passThreshold,
        passingScorePercent: data.passingScorePercent ?? passThreshold,
        status: savedSub.status,
        feedback: savedSub.feedback,
        answers: savedSub.quizAnswers || answers,
      });

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error submitting assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = answers.filter((a) => a >= 0).length;
  const activeQuestion = questions[step];

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-[#0B192C] border border-sky-300 dark:border-[#00F2FE]/40 space-y-5 shadow-md">
      {/* Quiz Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] font-semibold">
            {courseCode && <span>{courseCode}</span>}
            {courseCode && <span aria-hidden="true">·</span>}
            <span>
              {assessment.moduleTitle
                ? `Module Assessment: ${assessment.moduleTitle}`
                : assessment.type === 'exam'
                ? 'Timed Course Examination'
                : 'Auto-Graded Assessment Quiz'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
              {assessment.points} pts ({passThreshold}% pass)
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
            {assessment.title}
          </h4>

          {courseTitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {courseTitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {secondsLeft !== null && !result && (
            <span
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border tabular-nums inline-flex items-center gap-1.5 ${
                secondsLeft <= 60
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatCountdown(secondsLeft)}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Optional Question Paper Attachment */}
      {assessment.attachments && assessment.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assessment.attachments.map((att, idx) => (
            <a
              key={idx}
              href={`${att.url}${att.url.includes('?') ? '&' : '?'}download=1`}
              download={att.name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-sky-700 dark:text-[#00F2FE]"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download Paper: {att.name}</span>
            </a>
          ))}
        </div>
      )}

      {/* VIEW A: AUTO-GRADED RESULT & RECORD CONFIRMATION */}
      {result ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* Score Summary Banner */}
          <div
            className={`p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              result.status !== 'graded'
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-700/60'
                : result.passed
                ? 'bg-emerald-50 dark:bg-emerald-950/45 border-emerald-200 dark:border-emerald-600/60'
                : 'bg-amber-50 dark:bg-amber-950/45 border-amber-200 dark:border-amber-600/60'
            }`}
          >
            <div className="flex items-start gap-3.5">
              {result.status !== 'graded' || result.passed ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Award className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600 dark:text-slate-300">
                  {result.status === 'graded'
                    ? result.passed
                      ? 'Auto-Graded · Passed'
                      : 'Auto-Graded · Review Recommended'
                    : 'Submitted for Instructor Grading'}
                </div>
                <h5 className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {result.status === 'graded'
                    ? `${result.score} / ${result.maxPoints} Points (${result.percentage}%)`
                    : 'Pending Review'}
                </h5>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {result.totalQuestions > 0 && (
                    <span className="font-semibold">
                      {result.correctCount} of {result.totalQuestions} questions answered correctly ·{' '}
                    </span>
                  )}
                  <span>
                    Saved to Academic Record ({studentName} · Ref #{result.submission.id})
                  </span>
                </p>
                {result.feedback && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                    {result.feedback}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleStartRetake}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>
              {onViewTranscript && (
                <button
                  type="button"
                  onClick={onViewTranscript}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>View Grades Record</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 hover:brightness-110 text-white whitespace-nowrap"
              >
                Done
              </button>
            </div>
          </div>

          {/* Per-Question Answer Key & Explanation Breakdown */}
          {questions.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Answer Review &amp; Explanations</span>
              </div>

              <div className="space-y-3">
                {questions.map((q, qIdx) => {
                  const chosenIdx = result.answers[qIdx];
                  const isCorrect = chosenIdx === q.correctIndex;
                  const chosenText =
                    typeof chosenIdx === 'number' && chosenIdx >= 0
                      ? q.options[chosenIdx] ?? 'Not answered'
                      : 'Not answered';
                  const correctText = q.options[q.correctIndex] ?? '';

                  return (
                    <div
                      key={q.id || qIdx}
                      className="p-4 rounded-xl bg-white dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-slate-900 dark:text-white leading-snug">
                          Q{qIdx + 1}. {q.question}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold shrink-0 ${
                            isCorrect
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Your Answer: </span>
                          <span
                            className={
                              isCorrect
                                ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                : 'text-rose-700 dark:text-rose-300 font-semibold'
                            }
                          >
                            {chosenText}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">Correct Answer: </span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              {correctText}
                            </span>
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <strong>Explanation:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        /* VIEW B: INTERACTIVE QUIZ RUNNER */
        <div className="space-y-4">
          {questions.length > 0 && activeQuestion && (
            <>
              {/* Stepper Rail & Progress Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {questions.map((q, qIdx) => {
                    const isCurrent = qIdx === step;
                    const isAnswered = answers[qIdx] >= 0;
                    return (
                      <button
                        key={q.id || qIdx}
                        type="button"
                        onClick={() => setStep(qIdx)}
                        className={`min-w-[34px] h-8 px-2.5 rounded-lg text-xs font-mono font-bold transition-colors border tabular-nums ${
                          isCurrent
                            ? 'bg-[#0284C7] dark:bg-[#00F2FE] text-white dark:text-slate-950 border-transparent'
                            : isAnswered
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {answeredCount} / {questions.length} Answered
                </span>
              </div>

              {/* Active Question Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeQuestion.id || step}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-950/85 border border-slate-200 dark:border-slate-800 space-y-3.5"
                >
                  <div className="text-xs font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
                    Question {step + 1} of {questions.length}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {activeQuestion.question}
                  </div>

                  <div className="space-y-2 pt-1">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const selected = answers[step] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(step, optIdx)}
                          className={`w-full p-3.5 rounded-xl text-left text-xs sm:text-sm transition-colors flex items-center justify-between gap-3 border ${
                            selected
                              ? 'bg-sky-50 dark:bg-[#00F2FE]/15 text-sky-950 dark:text-[#00F2FE] border-sky-500 dark:border-[#00F2FE]/70 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center shrink-0 border ${
                                selected
                                  ? 'bg-[#0284C7] dark:bg-[#00F2FE] text-white dark:text-slate-950 border-transparent'
                                  : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="leading-snug">{opt}</span>
                          </span>
                          {selected && (
                            <Check className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Step Navigation */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {step < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white inline-flex items-center gap-1.5"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Final question reached
                  </span>
                )}
              </div>
            </>
          )}

          {/* Optional Written Exam Section */}
          {assessment.type === 'exam' && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Written Exam Answer / Working Notes{' '}
                  {questions.length > 0 ? '(Optional)' : '*'}
                </label>
                <textarea
                  rows={4}
                  value={writtenNotes}
                  onChange={(e) => setWrittenNotes(e.target.value)}
                  placeholder="Write your detailed exam answer..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {assessment.allowFileUpload !== false && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {examFile ? `Attached: ${examFile.name}` : 'Optional: Upload completed Exam PDF'}
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer">
                    {uploadingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{examFile ? 'Replace File' : 'Upload PDF/Doc'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,image/*"
                      onChange={handleExamFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/50 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={submitting || uploadingFile}
            onClick={() => void handleSubmitQuiz(false)}
            className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {submitting
                ? 'Grading & Saving to Student Record...'
                : assessment.type === 'exam'
                ? 'Submit Exam & Auto-Grade'
                : 'Submit Quiz for Auto-Grading'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
