import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Sparkles,
  GraduationCap,
  Inbox,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  Clock,
  Award,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  AcademicAssessment,
  AssessmentType,
  Course,
  QuizQuestion,
  StudentSubmission,
} from '../types';
import { getAuthHeaders, uploadPdfDocumentSmart } from '../services/firebaseService';
import { resolveAssessmentTitle } from '../utils/moduleQuizHelper';

interface AssessmentsStudioProps {
  courses: Course[];
  onCoursesUpdated: (courses: Course[]) => void;
  defaultSubTab?: 'homework' | 'quiz' | 'exam' | 'submissions';
  defaultCourseFilter?: string;
  defaultStatusFilter?: 'all' | 'submitted' | 'graded';
}

export const AssessmentsStudio: React.FC<AssessmentsStudioProps> = ({
  courses,
  onCoursesUpdated,
  defaultSubTab = 'homework',
  defaultCourseFilter = 'all',
  defaultStatusFilter = 'all',
}) => {
  const [studioTab, setStudioTab] = useState<'homework' | 'quiz' | 'exam' | 'submissions'>(
    defaultSubTab
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 5);
    return d.toISOString().slice(0, 16);
  });
  const [points, setPoints] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passingScorePercent, setPassingScorePercent] = useState(70);
  const [allowFileUpload, setAllowFileUpload] = useState(true);

  const [attachmentFile, setAttachmentFile] = useState<{ name: string; url: string } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: `q-${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submissions Inbox State
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);
  const [inboxCourseFilter, setInboxCourseFilter] = useState<string>(defaultCourseFilter);
  const [inboxStatusFilter, setInboxStatusFilter] = useState<'all' | 'submitted' | 'graded'>(
    defaultStatusFilter
  );

  useEffect(() => {
    setStudioTab(defaultSubTab);
  }, [defaultSubTab]);

  useEffect(() => {
    setInboxCourseFilter(defaultCourseFilter);
  }, [defaultCourseFilter]);

  useEffect(() => {
    setInboxStatusFilter(defaultStatusFilter);
  }, [defaultStatusFilter]);

  useEffect(() => {
    if (!selectedCourseId && courses[0]?.id) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    setSelectedModuleId('');
  }, [selectedCourseId]);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/submissions', { headers });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          setSubmissions(data);
        }
      }
    } catch {
      // Ignore transient errors
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (studioTab === 'submissions') {
      fetchSubmissions();
    }
  }, [studioTab]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    setErrorMessage(null);
    try {
      const res = await uploadPdfDocumentSmart('assessment_attachment', file);
      setAttachmentFile({ name: res.fileName, url: res.url });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload PDF worksheet.');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${prev.length + 1}`,
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const updateQuestionField = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      })
    );
  };

  const handlePublishAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedCourseId) {
      setErrorMessage('Please select a target course.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Assessment title is required.');
      return;
    }

    const mappedType: AssessmentType =
      studioTab === 'quiz' ? 'pop_quiz' : studioTab === 'exam' ? 'exam' : 'homework';

    const validQuestions = questions
      .filter((q) => q.question.trim() && q.options.some((o) => o.trim()))
      .map((q) => ({
        ...q,
        options: q.options.map((o, idx) => o.trim() || `Option ${idx + 1}`),
      }));

    if (mappedType === 'pop_quiz' && validQuestions.length === 0) {
      setErrorMessage('Please add at least one question with answer options for the Animated Quiz.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const selectedMod = selectedCourse?.modules?.find((m) => m.id === selectedModuleId);
      const payload = {
        moduleId: selectedMod?.id || undefined,
        moduleTitle: selectedMod?.title || undefined,
        title: title.trim(),
        description:
          description.trim() ||
          (mappedType === 'homework'
            ? 'Complete the homework worksheet and submit your work before the due date.'
            : mappedType === 'pop_quiz'
            ? 'Interactive animated knowledge check.'
            : 'Formal course examination.'),
        type: mappedType,
        assignedDateUtc: new Date().toISOString(),
        dueDateUtc: new Date(dueDate).toISOString(),
        points: Number(points) || 50,
        durationMinutes: mappedType === 'homework' ? undefined : Number(durationMinutes) || 30,
        passingScorePercent: mappedType === 'homework' ? undefined : Number(passingScorePercent) || 70,
        allowFileUpload: mappedType === 'homework' || mappedType === 'exam' ? allowFileUpload : false,
        quizQuestions: validQuestions,
        attachments: attachmentFile ? [attachmentFile] : [],
      };

      const resp = await fetch(`/api/courses/${selectedCourseId}/assessments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const created: AcademicAssessment = await resp.json();
      if (!resp.ok) {
        throw new Error((created as any)?.error || 'Failed to assign assessment.');
      }

      onCoursesUpdated(
        courses.map((c) =>
          c.id === selectedCourseId
            ? { ...c, assignments: [...(c.assignments || []), created] }
            : c
        )
      );

      setTitle('');
      setDescription('');
      setAttachmentFile(null);
      setQuestions([
        {
          id: `q-${Date.now()}`,
          question: '',
          options: ['', '', '', ''],
          correctIndex: 0,
          explanation: '',
        },
      ]);
      setStatusMessage(
        `${
          mappedType === 'homework'
            ? 'Homework Assignment'
            : mappedType === 'pop_quiz'
            ? 'Animated Quiz'
            : 'Timed Exam'
        } assigned cleanly to the course!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssessment = async (courseId: string, assId: string) => {
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/courses/${courseId}/assessments/${assId}`, {
        method: 'DELETE',
        headers,
      });
      if (resp.ok) {
        onCoursesUpdated(
          courses.map((c) =>
            c.id === courseId
              ? { ...c, assignments: (c.assignments || []).filter((a) => a.id !== assId) }
              : c
          )
        );
      }
    } catch {
      // Ignore error
    }
  };

  const handleSaveGrade = async (sub: StudentSubmission) => {
    const input = gradeInputs[sub.id];
    const numericGrade = Number(input?.grade ?? sub.grade ?? sub.maxPoints);
    const feedbackText = input?.feedback ?? sub.feedback ?? '';
    if (Number.isNaN(numericGrade)) return;

    setSavingGradeId(sub.id);
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const resp = await fetch(`/api/submissions/${sub.id}/grade`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ grade: numericGrade, feedback: feedbackText }),
      });
      const updated = await resp.json();
      if (resp.ok) {
        setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
      }
    } finally {
      setSavingGradeId(null);
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* Studio Mode Selector Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            id: 'homework' as const,
            label: 'Homework Upload',
            sub: 'Assign & collect files/PDFs',
            icon: FileText,
            accent: 'text-sky-600 dark:text-cyan-400',
          },
          {
            id: 'quiz' as const,
            label: 'Animated Quiz',
            sub: 'Interactive MCQ builder',
            icon: Sparkles,
            accent: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            id: 'exam' as const,
            label: 'Assign Exam',
            sub: 'Timed exam & question paper',
            icon: GraduationCap,
            accent: 'text-amber-600 dark:text-amber-400',
          },
          {
            id: 'submissions' as const,
            label: 'Submissions Inbox',
            sub: 'Review work & assign grades',
            icon: Inbox,
            accent: 'text-indigo-600 dark:text-indigo-400',
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = studioTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStudioTab(tab.id);
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                active
                  ? 'bg-sky-50 dark:bg-[#0B192C] border-sky-500 dark:border-[#00F2FE] shadow-md'
                  : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-5 h-5 ${tab.accent}`} />
                {active && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-[#00F2FE]">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{tab.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tab.sub}</p>
            </button>
          );
        })}
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Creation Form for Homework / Animated Quiz / Exam */}
      {studioTab !== 'submissions' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handlePublishAssessment}
            className="xl:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {studioTab === 'homework'
                    ? 'Create & Upload Homework Assignment'
                    : studioTab === 'quiz'
                    ? 'Animated Quiz Creation & Assign'
                    : 'Assign Timed Course Exam'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Immediately visible to enrolled students in their Student Portal & Course Syllabus.
                </p>
              </div>
            </div>

            {/* Metadata Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Course
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Module (Optional Post-Module Link)
                </label>
                <select
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                >
                  <option value="">General Course Assessment</option>
                  {(selectedCourse?.modules || []).map((m, mIdx) => (
                    <option key={m.id} value={m.id}>
                      Stage {mIdx + 1}: {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {studioTab === 'homework'
                    ? 'Homework Title'
                    : studioTab === 'quiz'
                    ? 'Quiz Title'
                    : 'Exam Title'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    studioTab === 'homework'
                      ? 'e.g., Week 3 Tadabbur Reflection & Worksheet'
                      : studioTab === 'quiz'
                      ? 'e.g., Makkan Seerah Animated Pop Quiz'
                      : 'e.g., Midterm Comprehensive Examination'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Total Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
                {studioTab !== 'homework' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowFileUpload}
                        onChange={(e) => setAllowFileUpload(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Allow File Upload
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Instructions / Prompt
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write clear instructions, grading rubric, or reflection prompts..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>

            {/* PDF Worksheet / Exam Paper Upload Box */}
            {(studioTab === 'homework' || studioTab === 'exam') && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#071120] border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {studioTab === 'homework'
                      ? 'Optional Homework PDF Worksheet'
                      : 'Optional Exam Question Paper (PDF)'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {attachmentFile
                      ? `Attached: ${attachmentFile.name}`
                      : 'Attach downloadable PDF instructions for students'}
                  </p>
                </div>
                <label className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
                  {uploadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{attachmentFile ? 'Replace PDF' : 'Upload PDF'}</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Animated Question Builder for Quiz and Exam */}
            {(studioTab === 'quiz' || studioTab === 'exam') && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Interactive Questions Builder
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Students experience smooth step-by-step animated transitions and instant feedback.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>Pass %:</span>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={passingScorePercent}
                        onChange={(e) => setPassingScorePercent(Number(e.target.value))}
                        className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-500/25"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {questions.map((q, qIdx) => (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-sky-600 dark:text-cyan-400">
                          Question #{qIdx + 1}
                        </span>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIdx)}
                            className="text-rose-500 hover:text-rose-400 text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestionField(qIdx, { question: e.target.value })}
                        placeholder="Enter question prompt..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 p-2 rounded-lg border ${
                              q.correctIndex === optIdx
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B192C]'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctIndex === optIdx}
                              onChange={() => updateQuestionField(qIdx, { correctIndex: optIdx })}
                              title="Mark as correct answer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white outline-none"
                            />
                          </div>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) => updateQuestionField(qIdx, { explanation: e.target.value })}
                        placeholder="Optional answer explanation shown after quiz submission..."
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 outline-none"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || uploadingPdf}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 dark:from-[#00F2FE] dark:to-emerald-400 text-white dark:text-slate-950 font-bold text-sm shadow-lg hover:opacity-95 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <span>
                  {studioTab === 'homework'
                    ? 'Assign Homework to Course'
                    : studioTab === 'quiz'
                    ? 'Publish & Assign Animated Quiz'
                    : 'Assign Timed Exam to Course'}
                </span>
              )}
            </button>
          </form>

          {/* Existing Assessments Box for Selected Course */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Assigned in {selectedCourse?.code || 'Course'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedCourse?.assignments?.length || 0} active homework, quizzes & exams
              </p>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {(selectedCourse?.assignments || []).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  No assessments assigned yet for this course.
                </p>
              ) : (
                (selectedCourse?.assignments || []).map((ass) => (
                  <div
                    key={ass.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-cyan-400">
                        {ass.type.replace('_', ' ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssessment(selectedCourse!.id, ass.id)}
                        className="text-rose-500 hover:text-rose-400 p-1"
                        title="Remove assessment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{ass.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Award className="w-3 h-3" /> {ass.points} pts
                      </span>
                      {ass.durationMinutes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {ass.durationMinutes} min
                        </span>
                      )}
                      <span>Due {new Date(ass.dueDateUtc).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Student Submissions & Grading Inbox */
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Student Homework, Quiz & Exam Submissions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review uploaded files, external links, written responses, and publish numeric grades & feedback.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={inboxCourseFilter}
                onChange={(e) => setInboxCourseFilter(e.target.value)}
                aria-label="Filter submissions by course"
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>

              <select
                value={inboxStatusFilter}
                onChange={(e) => setInboxStatusFilter(e.target.value as any)}
                aria-label="Filter submissions by status"
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Pending Review</option>
                <option value="graded">Graded</option>
              </select>

              <button
                type="button"
                onClick={fetchSubmissions}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Refresh Inbox
              </button>
            </div>
          </div>

          {loadingSubmissions ? (
            <div className="py-12 flex items-center justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading student submissions...</span>
            </div>
          ) : (
            (() => {
              const filteredSubmissions = submissions.filter((s) => {
                if (inboxCourseFilter !== 'all' && s.courseId !== inboxCourseFilter) return false;
                if (inboxStatusFilter !== 'all' && s.status !== inboxStatusFilter) return false;
                return true;
              });

              if (filteredSubmissions.length === 0) {
                return (
                  <p className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    {submissions.length === 0
                      ? 'No student submissions recorded yet.'
                      : 'No submissions match your selected course or status filter.'}
                  </p>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSubmissions.map((sub) => {
                    const course = courses.find((c) => c.id === sub.courseId);
                    const assessmentLabel = resolveAssessmentTitle(course, sub.assessmentId);
                    const isExternalSubmissionUrl = Boolean(
                      sub.fileUrl &&
                        /^https?:\/\//i.test(sub.fileUrl) &&
                        !sub.fileUrl.includes('/api/docs/')
                    );
                    const extractedLinks = Array.from(
                      new Set(
                        (sub.content || '').match(/https?:\/\/[^\s<>"']+/gi) || []
                      )
                    ).filter((url) => url !== sub.fileUrl);

                    const draft = gradeInputs[sub.id] || {
                      grade:
                        sub.grade !== undefined
                          ? String(sub.grade)
                          : String(sub.quizScore ?? sub.maxPoints),
                      feedback: sub.feedback || '',
                    };

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {sub.studentName}
                            </p>
                            <p className="text-xs text-sky-600 dark:text-cyan-400">
                              {assessmentLabel} • {course?.code || sub.courseId}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                              sub.status === 'graded'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {sub.status === 'graded' ? 'Graded' : 'Pending Review'}
                          </span>
                        </div>

                        {sub.content && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0B192C] p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                            {sub.content}
                          </p>
                        )}

                        {(sub.fileUrl || extractedLinks.length > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {sub.fileUrl && (
                              <a
                                href={
                                  isExternalSubmissionUrl
                                    ? sub.fileUrl
                                    : `${sub.fileUrl}${
                                        sub.fileUrl.includes('?') ? '&' : '?'
                                      }download=1`
                                }
                                download={
                                  !isExternalSubmissionUrl ? sub.fileName || true : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                  isExternalSubmissionUrl
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-sky-500/15 text-sky-700 dark:text-cyan-300'
                                }`}
                              >
                                {isExternalSubmissionUrl ? (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isExternalSubmissionUrl
                                    ? `Open Link: ${sub.fileName || sub.fileUrl}`
                                    : `Download File: ${sub.fileName || 'Submission'}`}
                                </span>
                              </a>
                            )}

                            {extractedLinks.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold max-w-full"
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{url}</span>
                              </a>
                            ))}
                          </div>
                        )}

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">
                          Grade (/ {sub.maxPoints})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={sub.maxPoints}
                          value={draft.grade}
                          onChange={(e) =>
                            setGradeInputs((prev) => ({
                              ...prev,
                              [sub.id]: { ...draft, grade: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-500 mb-1">Feedback</label>
                        <input
                          type="text"
                          value={draft.feedback}
                          onChange={(e) =>
                            setGradeInputs((prev) => ({
                              ...prev,
                              [sub.id]: { ...draft, feedback: e.target.value },
                            }))
                          }
                          placeholder="Add instructor note..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={savingGradeId === sub.id}
                      onClick={() => handleSaveGrade(sub)}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-60"
                    >
                      {savingGradeId === sub.id ? 'Saving Grade...' : 'Save Grade & Feedback'}
                    </button>
                  </div>
                );
              })}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};
