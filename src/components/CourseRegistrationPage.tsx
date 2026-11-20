import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  Globe,
  GraduationCap,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import type { Course, EnrollmentIntakePayload, User } from '../types';
import { resolveMediaSrc } from '../assets/fallbacks';
import { formatToLocalTime } from '../utils/timezone';
import { BrandLogo } from './BrandLogo';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import {
  buildVerifiedUserFromFirebase,
  formatFirebaseAuthError,
  parseApiJsonResponse,
  setStoredCachedUser,
  setStoredSessionToken,
  syncUserProfileToFirestore,
} from '../services/firebaseService';

interface CourseRegistrationPageProps {
  course: Course | null;
  currentUser: User | null;
  customLogoUrl?: string;
  onBackToCourse: (course: Course) => void;
  onBackToCourses: () => void;
  onEnrollWithIntake: (
    courseId: string,
    intake: EnrollmentIntakePayload
  ) => Promise<void>;
  onAuthenticated?: (user: User, adminSessionToken?: string) => void;
  onOpenStudentPortal: () => void;
}

type RegistrationStep = 1 | 2 | 3 | 4;

interface RegistrationReceipt {
  referenceId: string;
  enrolledName: string;
  enrolledEmail: string;
  phoneWhatsApp: string;
  gender: 'male' | 'female';
  country: string;
  city: string;
  preferredLanguage: string;
  submittedAt: string;
}

const STEP_META: Array<{
  step: RegistrationStep;
  label: string;
  caption: string;
}> = [
  { step: 1, label: 'Course & Instructor', caption: 'Program & faculty' },
  { step: 2, label: 'Student Form', caption: 'Intake details' },
  { step: 3, label: 'Payment ($0)', caption: 'Free scholarship' },
  { step: 4, label: 'Confirmation', caption: 'Summary & access' },
];

export const CourseRegistrationPage: React.FC<CourseRegistrationPageProps> = ({
  course,
  currentUser,
  customLogoUrl,
  onBackToCourse,
  onBackToCourses,
  onEnrollWithIntake,
  onAuthenticated,
  onOpenStudentPortal,
}) => {
  const [step, setStep] = useState<RegistrationStep>(1);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [educationBackground, setEducationBackground] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<
    'English' | 'Urdu' | 'Hindi' | 'Bi-lingual' | 'Kashmiri'
  >('English');
  const [motivation, setMotivation] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<RegistrationReceipt | null>(null);

  useEffect(() => {
    setStep(1);
    setSubmittedReceipt(null);
    setErrorMsg(null);
  }, [course?.id]);

  useEffect(() => {
    if (currentUser) {
      setFullName((prev) =>
        prev.trim() ? prev : `${currentUser.firstName} ${currentUser.lastName}`.trim()
      );
      setEmail((prev) => (prev.trim() ? prev : currentUser.email || ''));
      setGender(currentUser.gender === 'female' ? 'female' : 'male');
    }
  }, [currentUser?.id, currentUser?.email]);

  const goToStep = (nextStep: RegistrationStep) => {
    setErrorMsg(null);
    setStep(nextStep);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Course Registration Not Found
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Please select an active course from the catalog to begin your free enrollment.
        </p>
        <button
          type="button"
          onClick={onBackToCourses}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs whitespace-nowrap"
        >
          Browse Courses Catalog
        </button>
      </div>
    );
  }

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';
  const isEnrolled = currentUser
    ? course.enrolledStudentIds.includes(currentUser.id)
    : false;

  const maxSpots = Math.max(1, course.maxSpots ?? 50);
  const enrolledCount = course.enrolledStudentIds.length;
  const spotsAvailable = Math.max(0, maxSpots - enrolledCount);
  const fillPct = Math.min(100, Math.round((enrolledCount / maxSpots) * 100));
  const lowSpotsThreshold = Math.max(5, Math.floor(maxSpots * 0.2));
  const isBatchFull = spotsAvailable === 0;

  const deadlineMs = course.enrollmentDeadlineUtc
    ? Date.parse(course.enrollmentDeadlineUtc)
    : NaN;
  const hasDeadline = !Number.isNaN(deadlineMs);
  const isDeadlinePassed = hasDeadline && Date.now() > deadlineMs;
  const formattedDeadline = hasDeadline
    ? formatToLocalTime(course.enrollmentDeadlineUtc!)
    : null;

  const isBlockedForStudent = (isBatchFull || isDeadlinePassed) && !isStaff && !isEnrolled;
  const instructorInitials = (course.instructorName || 'MS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleGoogleQuickFill = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const displayName = fbUser.displayName || 'Scholar User';
      const [first, ...rest] = displayName.split(' ');
      const last = rest.join(' ') || 'User';
      const idToken = await fbUser.getIdToken();

      let syncedUser: User | null = null;
      let sessionToken = '';
      let adminSessionToken = '';

      try {
        const res = await fetch('/api/auth/google-callback', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            uid: fbUser.uid,
            email: fbUser.email || '',
            firstName: first,
            lastName: last,
            avatarUrl: fbUser.photoURL || undefined,
            requestedRole: 'student',
          }),
        });
        const parsed = await parseApiJsonResponse<{
          user?: User;
          sessionToken?: string;
          adminSessionToken?: string;
        }>(res, 'Could not authenticate with Google.');
        if (parsed.ok && parsed.data?.user) {
          syncedUser = parsed.data.user;
          sessionToken = parsed.data.sessionToken || '';
          adminSessionToken = parsed.data.adminSessionToken || '';
        }
      } catch {
        // Fallback to verified Firebase user below
      }

      const resolvedUser = syncedUser || buildVerifiedUserFromFirebase(fbUser, 'student');
      await Promise.allSettled([
        syncUserProfileToFirestore({
          ...resolvedUser,
          id: fbUser.uid,
          email: fbUser.email || resolvedUser.email,
          avatarUrl: fbUser.photoURL || resolvedUser.avatarUrl,
        }),
      ]);
      const activeToken = adminSessionToken || sessionToken;
      if (activeToken) setStoredSessionToken(activeToken);
      setStoredCachedUser(resolvedUser);
      if (onAuthenticated) {
        onAuthenticated(resolvedUser, activeToken);
      }
      setFullName(`${resolvedUser.firstName} ${resolvedUser.lastName}`.trim());
      setEmail(resolvedUser.email || '');
    } catch (err: any) {
      setErrorMsg(
        formatFirebaseAuthError(err, 'Google authentication could not be completed.')
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMsg('Please enter your Full Name to continue.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid Email Address to continue.');
      return;
    }

    goToStep(3);
  };

  const handleCompleteFreeEnrollment = async () => {
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Please enter your Full Name and Email Address.');
      goToStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      await onEnrollWithIntake(course.id, {
        courseId: course.id,
        studentId: currentUser?.id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneWhatsApp: phoneWhatsApp.trim(),
        age: age.trim(),
        gender,
        country: country.trim(),
        city: city.trim(),
        educationBackground: educationBackground.trim(),
        preferredLanguage,
        motivation: motivation.trim(),
      });

      const refStamp = Date.now().toString(36).toUpperCase().slice(-5);
      const cleanCode = (course.code || 'DHA').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      setSubmittedReceipt({
        referenceId: `DHA-${cleanCode}-${refStamp}`,
        enrolledName: fullName.trim(),
        enrolledEmail: email.trim().toLowerCase(),
        phoneWhatsApp: phoneWhatsApp.trim(),
        gender,
        country: country.trim(),
        city: city.trim(),
        preferredLanguage,
        submittedAt: new Date().toLocaleString(),
      });
      goToStep(4);

      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#00F2FE', '#10B981', '#F59E0B'],
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to submit free registration right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveStep: RegistrationStep = submittedReceipt ? 4 : step;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Navigation & Fee Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onBackToCourse(course)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0284C7] dark:hover:text-[#00F2FE] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course Explanation</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>{course.code}</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
            Tuition Fee: $0.00 (Free)
          </span>
        </div>
      </div>

      {/* 4-Step Sequential Enrollment Progress Bar (SeerahVerse Style) */}
      <nav
        aria-label="Course Enrollment Steps"
        className="rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STEP_META.map((item) => {
            const isActive = effectiveStep === item.step;
            const isCompleted = effectiveStep > item.step || (item.step === 4 && !!submittedReceipt);
            const canClickStep =
              !submittedReceipt && item.step < effectiveStep && item.step <= 3;

            return (
              <button
                key={item.step}
                type="button"
                disabled={!canClickStep}
                onClick={() => {
                  if (canClickStep) goToStep(item.step);
                }}
                className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                  isActive
                    ? 'bg-sky-50 dark:bg-[#00F2FE]/12 border-[#0284C7] dark:border-[#00F2FE]/60 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-700/50 hover:border-emerald-400'
                    : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-75'
                } ${canClickStep ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-xs font-extrabold shrink-0 tabular-nums ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? 'bg-[#0284C7] dark:bg-[#00F2FE] text-white dark:text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : `0${item.step}`}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-bold truncate ${
                      isActive
                        ? 'text-slate-950 dark:text-white'
                        : isCompleted
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.caption}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Responsive Wizard Layout */}
      <AnimatePresence mode="wait">
        {/* STEP 4: CONFIRMATION NOTIFICATION & REGISTRATION SUMMARY PAGE */}
        {effectiveStep === 4 && submittedReceipt ? (
          <motion.div
            key="step-4-confirmation"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto space-y-6"
          >
            {/* Prominent Confirmation Notification Banner */}
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/75 border border-emerald-300 dark:border-emerald-500/50 p-4 sm:p-5 flex items-start gap-3.5 shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  Enrollment Notification · Course Added to Your Student Dashboard
                </div>
                <p className="text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  You have successfully registered for <span className="font-bold">{course.title}</span> with <span className="font-bold">{course.instructorName}</span> at <span className="font-mono font-bold">$0.00 (Free)</span>. Open your Student Dashboard anytime to view your enrolled courses, live classrooms, and recordings.
                </p>
              </div>
            </div>

            {/* Official Registration Summary Card */}
            <div className="rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
                      Step 4 · Course Registration Summary
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                      Welcome to {course.title}
                    </h1>
                  </div>
                </div>
                <div className="text-left sm:text-right font-mono text-xs shrink-0">
                  <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase">
                    Registration Ref
                  </div>
                  <div className="font-extrabold text-[#0284C7] dark:text-[#00F2FE] tabular-nums">
                    {submittedReceipt.referenceId}
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Course &amp; Instructor Summary
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Course Code</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {course.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Instructor</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {course.instructorName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Duration</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {course.durationLabel || '12 Weeks'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Tuition Paid</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        $0.00 (Free)
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Enrolled Student Details
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Student Name</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {submittedReceipt.enrolledName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Email Address</span>
                      <span className="font-mono text-[#0284C7] dark:text-[#00F2FE] truncate max-w-[200px]">
                        {submittedReceipt.enrolledEmail}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Cohort Track</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {submittedReceipt.gender === 'female' ? 'Sisters' : 'Brothers'} · {submittedReceipt.preferredLanguage}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Phone (Optional)</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {submittedReceipt.phoneWhatsApp || 'Not provided (optional)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-slate-600 dark:text-slate-300">
                    Registered at <span className="font-mono font-semibold">{submittedReceipt.submittedAt}</span>
                    {submittedReceipt.city || submittedReceipt.country ? (
                      <span>
                        {' '}· {[submittedReceipt.city, submittedReceipt.country].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Admission Active · Full Access Unlocked
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onOpenStudentPortal}
                    className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Go to My Dashboard (Enrolled Courses)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onBackToCourse(course)}
                      className="px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      Open Course Workspace
                    </button>
                    <button
                      type="button"
                      onClick={onBackToCourses}
                      className="px-4 py-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      All Courses
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`step-${effectiveStep}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* LEFT SUMMARY SIDEBAR: Persistent Program Snapshot & Limits */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
              <div className="rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg">
                <div className="relative aspect-[16/9] w-full bg-slate-950">
                  <img
                    src={resolveMediaSrc(course.thumbnail, 'course')}
                    alt={course.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071120] via-black/25 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-[#00F2FE]/40">
                    <BrandLogo customLogoUrl={customLogoUrl} size="xs" theme="dark" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold">
                      {course.code}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                    <span className="font-semibold truncate">{course.instructorName}</span>
                    <span className="font-mono font-bold text-[#10B981] whitespace-nowrap tabular-nums">
                      Fee: $0
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
                      Selected Cohort
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 leading-snug">
                      {course.title}
                    </h2>
                  </div>

                  {/* Seat Limit & Duration Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                        <span>Seat Cap</span>
                      </div>
                      <div className="font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                        {enrolledCount} / {maxSpots}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Duration</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {course.durationLabel || '12 Weeks'}
                      </div>
                    </div>
                  </div>

                  {/* Occupancy Meter */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">
                        Spots Remaining
                      </span>
                      <span
                        className={`font-bold ${
                          isBatchFull
                            ? 'text-rose-600 dark:text-rose-400'
                            : spotsAvailable <= lowSpotsThreshold
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {spotsAvailable} of {maxSpots} Open
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isBatchFull
                            ? 'bg-rose-500'
                            : spotsAvailable <= lowSpotsThreshold
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  {formattedDeadline && (
                    <div
                      className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                        isDeadlinePassed
                          ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
                          : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70 text-sky-800 dark:text-sky-200'
                      }`}
                    >
                      <CalendarClock className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">
                          {isDeadlinePassed ? 'Time Limit Closed' : 'Enrollment Deadline'}
                        </div>
                        <div className="font-mono text-[11px] mt-0.5 tabular-nums">
                          {formattedDeadline.localTimeStr} · {formattedDeadline.localDayStr}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Free Tuition Summary Breakdown ($0) */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/8 dark:bg-emerald-950/35 border border-emerald-500/30 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>Tuition Fee</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        100% Waived
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between font-extrabold text-sm">
                      <span className="text-slate-900 dark:text-white">Total Due</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                        $0.00 (Free)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* RIGHT ACTIVE WIZARD STEP PANEL */}
            <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
              {isEnrolled ? (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/60 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        You are already enrolled in {course.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        This course is active on your Student Dashboard with all private lecture recordings, PDFs, module quizzes, and live Zoom sessions unlocked.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={onOpenStudentPortal}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] whitespace-nowrap shrink-0"
                    >
                      Go to My Dashboard →
                    </button>
                    <button
                      type="button"
                      onClick={() => onBackToCourse(course)}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0"
                    >
                      Open Course Workspace
                    </button>
                  </div>
                </div>
              ) : isBlockedForStudent ? (
                <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 space-y-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                        {isDeadlinePassed
                          ? 'Enrollment Time Limit Reached'
                          : 'Cohort Student Capacity Full'}
                      </h3>
                      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                        {isDeadlinePassed
                          ? 'The instructor/admin time window for this cohort has ended. Please explore other open cohorts in the catalog.'
                          : `All ${maxSpots} student seats are filled for this cohort. Please browse other open courses or check back for the next intake.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToCourses}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    Browse Open Courses
                  </button>
                </div>
              ) : (
                <>
                  {/* STEP 1: COURSE & INSTRUCTOR DETAILS */}
                  {effectiveStep === 1 && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-bold">
                            Step 1 of 4 · Course &amp; Instructor Overview
                          </div>
                          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                            Meet Your Instructor &amp; Review Cohort
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Review the lead faculty profile, curriculum format, and seat limits before completing your free application.
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs whitespace-nowrap tabular-nums">
                          Fee: $0.00
                        </span>
                      </div>

                      {/* Lead Course Instructor Spotlight Card */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0284C7] to-[#10B981] text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-md ring-2 ring-[#0284C7]/25 dark:ring-[#00F2FE]/30">
                            {instructorInitials || 'MS'}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="text-[10px] font-mono uppercase tracking-widest text-[#0284C7] dark:text-[#00F2FE] font-bold">
                              Course Instructor · Lead Faculty
                            </div>
                            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                              {course.instructorName}
                            </h2>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              Direct live instruction, structured weekly feedback, and Q&amp;A mentorship throughout all {course.totalLectures} lectures ({course.durationLabel || '12 Weeks'}).
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Video className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
                            <span>
                              <strong className="tabular-nums">{course.videoArchives.length}</strong> Video Lectures
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <BookOpen className="w-4 h-4 text-[#10B981] shrink-0" />
                            <span>
                              <strong className="tabular-nums">{course.modules.length}</strong> Structured Modules
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              <strong className="tabular-nums">{course.assignments.length}</strong> Quizzes &amp; Tasks
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Course Overview & Live Class Preview */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                          Program Explanation &amp; Cohort Format
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {course.description}
                        </p>

                        {course.schedules.length > 0 && (
                          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-2 text-xs">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <CalendarClock className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                              <span>Upcoming Live Session Schedule</span>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 font-mono">
                              {course.schedules[0].title} ·{' '}
                              {formatToLocalTime(
                                course.schedules[0].timeUtc,
                                course.schedules[0].dayOfWeek
                              ).localDayStr}{' '}
                              at{' '}
                              {formatToLocalTime(
                                course.schedules[0].timeUtc,
                                course.schedules[0].dayOfWeek
                              ).localTimeStr}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onBackToCourse(course)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          ← Course Page
                        </button>

                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                        >
                          <span>Continue to Student Form</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: STUDENT REGISTRATION FORM (PHONE OPTIONAL) */}
                  {effectiveStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-bold">
                            Step 2 of 4 · Student Admission Form
                          </div>
                          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                            Enter Your Student Details
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Complete the form below to reserve your seat. Phone / WhatsApp is completely optional.
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs whitespace-nowrap tabular-nums">
                          Fee: $0.00
                        </span>
                      </div>

                      {!currentUser && (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <GraduationCap className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                              <span>Fast-Track with Google Account</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Auto-fill your name &amp; email cleanly via Google Sign-In.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleGoogleQuickFill}
                            disabled={isGoogleLoading}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-white bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              />
                            </svg>
                            <span>{isGoogleLoading ? 'Connecting...' : 'Continue with Google'}</span>
                          </button>
                        </div>
                      )}

                      <form onSubmit={handleProceedToPayment} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Full Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="e.g. Zayd Farooq"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Email Address <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              WhatsApp / Phone Number{' '}
                              <span className="text-slate-400 dark:text-slate-500 font-normal">
                                (Optional)
                              </span>
                            </label>
                            <input
                              type="tel"
                              value={phoneWhatsApp}
                              onChange={(e) => setPhoneWhatsApp(e.target.value)}
                              placeholder="+1 555 234 5678 (optional)"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Age
                              </label>
                              <input
                                type="number"
                                min={10}
                                max={99}
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="24"
                                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Track <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={gender}
                                onChange={(e) =>
                                  setGender(e.target.value === 'female' ? 'female' : 'male')
                                }
                                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                              >
                                <option value="male">Brothers</option>
                                <option value="female">Sisters</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Country
                            </label>
                            <input
                              type="text"
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              placeholder="e.g. United Kingdom"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              City
                            </label>
                            <input
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="e.g. London"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Educational Background
                            </label>
                            <input
                              type="text"
                              value={educationBackground}
                              onChange={(e) => setEducationBackground(e.target.value)}
                              placeholder="High School / University / Alimiyyah"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              Preferred Language
                            </label>
                            <select
                              value={preferredLanguage}
                              onChange={(e) => setPreferredLanguage(e.target.value as any)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                            >
                              <option value="English">English</option>
                              <option value="Urdu">Urdu</option>
                              <option value="Hindi">Hindi</option>
                              <option value="Bi-lingual">Bi-lingual</option>
                              <option value="Kashmiri">Kashmiri</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Study Goals &amp; Questions for Instructor (Optional)
                          </label>
                          <textarea
                            rows={3}
                            value={motivation}
                            onChange={(e) => setMotivation(e.target.value)}
                            placeholder={`Share your learning objectives for ${course.title}...`}
                            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                          />
                        </div>

                        {errorMsg && (
                          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
                            {errorMsg}
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => goToStep(1)}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                          >
                            ← Back to Course &amp; Instructor
                          </button>

                          <button
                            type="submit"
                            className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                          >
                            <span>Continue to Payment ($0)</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* STEP 3: FREE PAYMENT ($0) CHECKOUT REVIEW */}
                  {effectiveStep === 3 && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-bold">
                            Step 3 of 4 · Tuition Fee &amp; Checkout ($0)
                          </div>
                          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                            Free Scholarship Checkout — $0.00
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Review your applicant details and confirm zero-fee admission. No payment card or bank transfer is required.
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs whitespace-nowrap tabular-nums">
                          Total Due: $0.00
                        </span>
                      </div>

                      {/* Applicant Summary Snippet */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono uppercase tracking-wider text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            Applicant Summary
                          </span>
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            className="text-[#0284C7] dark:text-[#00F2FE] font-semibold hover:underline"
                          >
                            Edit Form Details
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Student: </span>
                            <span className="font-bold text-slate-900 dark:text-white">{fullName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Email: </span>
                            <span className="font-mono text-[#0284C7] dark:text-[#00F2FE]">{email}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Cohort Track: </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {gender === 'female' ? 'Sisters' : 'Brothers'} · {preferredLanguage}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Phone: </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {phoneWhatsApp.trim() || 'Not provided (optional)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* $0 Invoice / Fee Breakdown */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-emerald-500/8 dark:bg-emerald-950/35 border border-emerald-500/35 space-y-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white pb-2 border-b border-emerald-500/20">
                          <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Tuition Fee Statement · Full Institutional Scholarship</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Course Tuition ({course.code} · {course.instructorName})</span>
                          <span className="font-mono tabular-nums">$0.00</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Live Zoom Classrooms &amp; Full Video Archive</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            Included ($0.00)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Module Assessments, PDFs &amp; Progress Transcript</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            Included ($0.00)
                          </span>
                        </div>

                        <div className="pt-3 border-t border-emerald-500/25 flex items-center justify-between text-base font-extrabold">
                          <span className="text-slate-900 dark:text-white">
                            Total Payable Today
                          </span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                            $0.00 (FREE)
                          </span>
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300">
                          {errorMsg}
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          disabled={isSubmitting}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          ← Back to Form
                        </button>

                        <button
                          type="button"
                          onClick={handleCompleteFreeEnrollment}
                          disabled={isSubmitting || isBlockedForStudent}
                          className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>
                            {isSubmitting
                              ? 'Confirming Free Enrollment...'
                              : 'Confirm & Complete Free Enrollment ($0.00)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Instant admission · Zero charge ($0) · No card needed
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                  Deen Hijrah Academia Official Cohort Portal
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
