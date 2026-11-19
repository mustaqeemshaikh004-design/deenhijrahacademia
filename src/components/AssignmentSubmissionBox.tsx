import React, { useState } from 'react';
import {
  Upload,
  Link2,
  Send,
  Loader2,
  CheckCircle2,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react';
import type { AcademicAssessment, StudentSubmission } from '../types';
import { getAuthHeaders, uploadPdfDocumentSmart } from '../services/firebaseService';

export interface AssignmentSubmissionBoxProps {
  courseId: string;
  assessment: Pick<AcademicAssessment, 'id' | 'title' | 'type' | 'points' | 'allowFileUpload'>;
  studentId: string;
  studentName: string;
  onSubmitted: (submission: StudentSubmission) => void;
  onCancel?: () => void;
  onRefreshData?: () => void;
}

const ACCEPTED_FORMATS =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.zip,image/*';

export const AssignmentSubmissionBox: React.FC<AssignmentSubmissionBoxProps> = ({
  courseId,
  assessment,
  studentId,
  studentName,
  onSubmitted,
  onCancel,
  onRefreshData,
}) => {
  const [content, setContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const allowFiles = assessment.allowFileUpload !== false;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccessMsg(null);
    setUploadingFile(true);
    try {
      const res = await uploadPdfDocumentSmart('student_submission', file);
      setUploadedFile({ url: res.url, name: res.fileName });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to upload assignment file. Please try again.'
      );
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedContent = content.trim();
    const trimmedLink = linkUrl.trim();
    const trimmedLabel = linkLabel.trim();

    if (trimmedLink) {
      try {
        const parsed = new URL(trimmedLink);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setError('External link must start with https:// or http://');
          return;
        }
      } catch {
        setError('Please enter a valid external URL starting with https:// or http://');
        return;
      }
    }

    if (!trimmedContent && !uploadedFile && !trimmedLink) {
      setError(
        'Please upload an assignment file, provide an external link, or write your response notes before submitting.'
      );
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
            content: trimmedContent || undefined,
            fileUrl: uploadedFile?.url,
            fileName: uploadedFile?.name,
            linkUrl: trimmedLink || undefined,
            linkLabel: trimmedLabel || undefined,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          data?.error || 'Failed to submit assignment. Please verify your enrollment and sign-in.'
        );
      }

      if (data.submission) {
        onSubmitted(data.submission as StudentSubmission);
      }
      setSuccessMsg('Assignment submitted successfully! Delivered to the instructor review inbox.');
      setContent('');
      setUploadedFile(null);
      setLinkUrl('');
      setLinkLabel('');
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/95 border border-sky-300 dark:border-[#00F2FE]/35 shadow-sm space-y-4 text-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-bold">
            {assessment.id === 'general-coursework'
              ? 'Coursework & Practice Review'
              : `${assessment.type.replace('_', ' ')} Submission`}{' '}
            · {assessment.points} pts
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            {assessment.title}
          </h4>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        )}
      </div>

      {/* Upload File & External Link Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option A: File Upload */}
        {allowFiles && (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Upload Assignment File</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                PDF, Word (.doc/.docx), Slides, Excel, TXT/MD, ZIP, or Images (max 20 MB).
              </p>
            </div>

            {uploadedFile ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                    {uploadedFile.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100">
                    Replace
                    <input
                      type="file"
                      accept={ACCEPTED_FORMATS}
                      onChange={handleFileChange}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label="Remove uploaded file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer transition-colors whitespace-nowrap">
                {uploadingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{uploadingFile ? 'Uploading File...' : 'Choose Assignment File'}</span>
                <input
                  type="file"
                  accept={ACCEPTED_FORMATS}
                  onChange={handleFileChange}
                  disabled={uploadingFile}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {/* Option B: External Link */}
        <div
          className={`p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 ${
            !allowFiles ? 'md:col-span-2' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Provide External Link</span>
            </div>
            {(linkUrl || linkLabel) && (
              <button
                type="button"
                onClick={() => {
                  setLinkUrl('');
                  setLinkLabel('');
                }}
                className="text-[11px] text-slate-400 hover:text-rose-500"
              >
                Clear link
              </button>
            )}
          </div>

          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://docs.google.com/... or Drive / GitHub / Loom"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
          />

          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Optional link label (e.g. Week 3 Tajwid Recording / Essay Doc)"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
          />
        </div>
      </div>

      {/* Written Response / Notes */}
      <div>
        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Written Notes / Summary for Instructor
        </label>
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add written answers, questions for your instructor, or context about your uploaded file/link..."
          className="w-full p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          You can attach a file, share a link, or combine both in one submission.
        </span>
        <button
          type="submit"
          disabled={submitting || uploadingFile}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{submitting ? 'Submitting for Review...' : 'Submit Assignment for Review'}</span>
        </button>
      </div>
    </form>
  );
};
