import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  X,
  CheckCircle2,
  BookOpen,
  Award,
  Mail,
  MessageSquare,
  Send,
  Trash2,
  ArrowUpRight,
  GraduationCap,
  LogIn,
} from 'lucide-react';
import type { Course, FacultyProfile, InstructorReview, User } from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { StarRatingDisplay, StarRatingInput } from './StarRating';

interface FacultyProfileModalProps {
  faculty: FacultyProfile | null;
  courses: Course[];
  reviews: InstructorReview[];
  currentUser: User | null;
  onClose: () => void;
  onSelectCourse: (course: Course) => void;
  onSaveInstructorReview: (payload: {
    instructorId: string;
    instructorName: string;
    rating: number;
    comment: string;
    courseId?: string;
    courseTitle?: string;
  }) => Promise<void>;
  onDeleteInstructorReview: (instructorId: string, reviewId: string) => Promise<void>;
  onNavigateAuth?: (mode: 'signin' | 'signup') => void;
}

export const FacultyProfileModal: React.FC<FacultyProfileModalProps> = ({
  faculty,
  courses,
  reviews,
  currentUser,
  onClose,
  onSelectCourse,
  onSaveInstructorReview,
  onDeleteInstructorReview,
  onNavigateAuth,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const coursesTaught = useMemo(() => {
    if (!faculty) return [];
    const targetName = faculty.fullName.trim().toLowerCase();
    return courses.filter(
      (c) =>
        c.instructorId === faculty.id ||
        c.instructorName.trim().toLowerCase() === targetName
    );
  }, [faculty, courses]);

  const facultyReviews = useMemo(() => {
    if (!faculty) return [];
    const targetName = faculty.fullName.trim().toLowerCase();
    return reviews
      .filter(
        (r) =>
          r.instructorId === faculty.id ||
          r.instructorName.trim().toLowerCase() === targetName
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [faculty, reviews]);

  const myExistingReview = useMemo(() => {
    if (!currentUser?.id) return null;
    return facultyReviews.find((r) => r.authorId === currentUser.id) || null;
  }, [facultyReviews, currentUser?.id]);

  const averageRating = useMemo(() => {
    if (facultyReviews.length === 0) return 0;
    const sum = facultyReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Number((sum / facultyReviews.length).toFixed(1));
  }, [facultyReviews]);

  useEffect(() => {
    if (myExistingReview) {
      setRating(myExistingReview.rating);
      setComment(myExistingReview.comment);
      setSelectedCourseId(myExistingReview.courseId || '');
    } else {
      setRating(5);
      setComment('');
      setSelectedCourseId(coursesTaught[0]?.id || '');
    }
    setStatusMessage(null);
  }, [faculty?.id, myExistingReview?.id]);

  if (!faculty) return null;

  const isEnrolledWithInstructor = Boolean(
    currentUser?.id &&
      coursesTaught.some((c) => c.enrolledStudentIds.includes(currentUser.id))
  );

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Please write a brief review comment.' });
      return;
    }

    const chosenCourse = coursesTaught.find((c) => c.id === selectedCourseId);
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await onSaveInstructorReview({
        instructorId: faculty.id,
        instructorName: faculty.fullName,
        rating,
        comment: trimmed,
        ...(chosenCourse ? { courseId: chosenCourse.id, courseTitle: chosenCourse.title } : {}),
      });
      setStatusMessage({
        type: 'success',
        text: myExistingReview
          ? 'Your instructor review has been updated.'
          : 'Thank you! Your instructor review is now published.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to publish review right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-profile-modal-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Top Banner & Close */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono text-[#0284C7] dark:text-[#00F2FE] uppercase tracking-wider font-semibold">
            <GraduationCap className="w-4 h-4" />
            <span>Scholastic Faculty Profile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close faculty profile"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Header Bio Card */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-6 items-start">
            <div className="shrink-0">
              <SymbolicAvatar
                gender={faculty.gender}
                name={faculty.fullName}
                avatarUrl={faculty.avatarUrl}
                size="xl"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
                  {faculty.title}
                </span>
                {faculty.isVerifiedDirector && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Academy Leadership</span>
                  </span>
                )}
              </div>

              <div>
                <h2
                  id="faculty-profile-modal-title"
                  className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
                >
                  {faculty.fullName}
                </h2>
                <p className="text-sm font-semibold text-[#0284C7] dark:text-[#00F2FE] mt-0.5">
                  {faculty.roleLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <StarRatingDisplay
                  rating={averageRating}
                  size="md"
                  reviewCount={facultyReviews.length}
                />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {coursesTaught.length} Active {coursesTaught.length === 1 ? 'Course' : 'Courses'}
                </span>
                {faculty.email && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{faculty.email}</span>
                  </span>
                )}
              </div>

              <div className="pt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Specialty: </span>
                <span className="font-semibold">{faculty.specialty}</span>
              </div>
            </div>
          </div>

          {/* Biography & Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>About &amp; Teaching Methodology</span>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {faculty.bio}
              </p>
            </div>

            <div className="md:col-span-5 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                <span>Qualifications &amp; Stewardship</span>
              </h3>
              <ul className="space-y-2">
                {(faculty.qualifications && faculty.qualifications.length > 0
                  ? faculty.qualifications
                  : ['Certified Faculty Member — Deen Hijrah Academia']
                ).map((q, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Courses Taught */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Courses Led by {faculty.firstName}
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {coursesTaught.length} Total
              </span>
            </div>

            {coursesTaught.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {coursesTaught.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectCourse(c);
                    }}
                    className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-[#00F2FE]/60 text-left transition-all flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono font-semibold text-[#0284C7] dark:text-[#00F2FE]">
                        {c.code} · {c.level}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#0284C7] dark:group-hover:text-[#00F2FE] truncate mt-0.5">
                        {c.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {c.enrolledStudentIds.length} students enrolled · {c.status}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#00F2FE] shrink-0 mt-1 transition-colors" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                Currently leading institutional curriculum oversight and upcoming term cohorts.
              </div>
            )}
          </div>

          {/* Instructor Reviews Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                  <span>Student Reviews for {faculty.fullName}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Read authentic student feedback and rate this instructor&apos;s clarity, support, and pedagogy.
                </p>
              </div>
              <StarRatingDisplay
                rating={averageRating}
                size="md"
                reviewCount={facultyReviews.length}
              />
            </div>

            {/* Leave / Update Instructor Review Form */}
            {currentUser ? (
              <form
                onSubmit={handleSubmitReview}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {myExistingReview
                      ? 'Update Your Instructor Review'
                      : `Rate & Review ${faculty.firstName}`}
                  </div>
                  {isEnrolledWithInstructor && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Enrolled Student</span>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Instructor Rating
                  </label>
                  <StarRatingInput
                    value={rating}
                    onChange={setRating}
                    disabled={isSubmitting}
                  />
                </div>

                {coursesTaught.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Related Course (Optional)
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00F2FE]"
                    >
                      <option value="">General Faculty Mentorship</option>
                      {coursesTaught.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Your Experience &amp; Feedback
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={1500}
                    disabled={isSubmitting}
                    placeholder={`Share what you appreciated about studying with ${faculty.fullName}...`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                  />
                  <div className="mt-1 text-[11px] font-mono text-slate-400 text-right tabular-nums">
                    {comment.length} / 1500
                  </div>
                </div>

                {statusMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      statusMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {myExistingReview && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setIsSubmitting(true);
                        void onDeleteInstructorReview(faculty.id, myExistingReview.id)
                          .then(() => {
                            setComment('');
                            setRating(5);
                            setStatusMessage({
                              type: 'success',
                              text: 'Your review was removed.',
                            });
                          })
                          .catch((err) =>
                            setStatusMessage({
                              type: 'error',
                              text:
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to delete review.',
                            })
                          )
                          .finally(() => setIsSubmitting(false));
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Review</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSubmitting
                        ? 'Saving...'
                        : myExistingReview
                        ? 'Update Review'
                        : 'Publish Instructor Review'}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  Sign in as a student to rate and review <strong className="text-slate-900 dark:text-white">{faculty.fullName}</strong>.
                </div>
                {onNavigateAuth && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateAuth('signin');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:brightness-110 transition-all inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In to Review</span>
                  </button>
                )}
              </div>
            )}

            {/* Existing Instructor Reviews List */}
            {facultyReviews.length > 0 ? (
              <div className="space-y-3">
                {facultyReviews.map((rev) => {
                  const canDelete =
                    currentUser &&
                    (currentUser.id === rev.authorId || currentUser.role === 'admin');
                  return (
                    <div
                      key={rev.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <SymbolicAvatar
                            gender={rev.authorGender}
                            name={rev.authorName}
                            avatarUrl={rev.authorAvatar}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {rev.authorName}
                              </span>
                              {rev.isVerifiedStudent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Verified Student
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                              <StarRatingDisplay rating={rev.rating} size="xs" showNumeric={false} />
                              {rev.courseTitle && (
                                <span className="text-[#0284C7] dark:text-[#00F2FE] truncate">
                                  · {rev.courseTitle}
                                </span>
                              )}
                              <span>
                                · {new Date(rev.updatedAt || rev.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              void onDeleteInstructorReview(faculty.id, rev.id)
                            }
                            title="Delete review"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {rev.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                No instructor reviews yet. Be the first student to share feedback on {faculty.fullName}.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
