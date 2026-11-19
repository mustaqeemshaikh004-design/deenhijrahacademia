import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  Video,
  FileText,
  CheckCircle2,
  Sparkles,
  Bot,
  Send,
  ChevronDown,
  ChevronUp,
  Lock,
  FileDown,
  Globe,
  UserCheck,
  X,
  Upload,
  ExternalLink,
  ClipboardCheck,
  Award,
  Users,
  CalendarClock,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type {
  AcademicAssessment,
  Course,
  EnrollmentIntakePayload,
  StudentSubmission,
  User,
} from '../types';
import { formatToLocalTime, getUserTimezoneShort } from '../utils/timezone';
import { resolveMediaSrc } from '../assets/fallbacks';
import { getAuthHeaders } from '../services/firebaseService';
import { CourseRecordingsWorkspace } from './CourseRecordingsWorkspace';
import { AssignmentSubmissionBox } from './AssignmentSubmissionBox';
import { ModuleQuizRunner } from './ModuleQuizRunner';
import {
  findQuizForModule,
  loadCompletedModuleIds,
  saveCompletedModuleIds,
  resolveAssessmentTitle,
  MODULE_COMPLETION_EVENT,
} from '../utils/moduleQuizHelper';

interface CourseDetailPageProps {
  course: Course | null;
  currentUser: User | null;
  customLogoUrl?: string;
  onBackToCourses: () => void;
  onEnrollWithIntake: (
    courseId: string,
    intake: EnrollmentIntakePayload
  ) => Promise<void>;
  onJoinClassWithAttendance: (courseId: string, scheduleId: string) => void;
  onStartMeeting?: (info: {
    title: string;
    courseId: string;
    courseTitle: string;
    scheduleId: string;
    instructorName: string;
    meetingId: string;
    meetingPasscode?: string;
    joinUrl?: string;
  }) => void;
  onNavigateToPortal: () => void;
  onNavigateToRegistration?: (course: Course) => void;
  onRefreshData?: () => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({
  course,
  currentUser,
  customLogoUrl,
  onBackToCourses,
  onEnrollWithIntake,
  onJoinClassWithAttendance,
  onStartMeeting,
  onNavigateToPortal,
  onNavigateToRegistration,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'recordings' | 'syllabus' | 'schedules' | 'materials' | 'assignments' | 'tutor'
  >('recordings');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [enrollDrawerOpen, setEnrollDrawerOpen] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // SeerahVerse Structured Enrollment Intake Form State
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

  // Embedded AI Tutor state
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorMessages, setTutorMessages] = useState<
    Array<{ sender: 'user' | 'tutor'; text: string }>
  >([]);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

  // Student assignment submissions & post-module quiz state
  const [mySubmissions, setMySubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [activeAssignmentTarget, setActiveAssignmentTarget] = useState<Pick<
    AcademicAssessment,
    'id' | 'title' | 'type' | 'points' | 'allowFileUpload'
  > | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [activeModuleQuiz, setActiveModuleQuiz] = useState<AcademicAssessment | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(`${currentUser.firstName} ${currentUser.lastName}`.trim());
      setEmail(currentUser.email || '');
      setGender(currentUser.gender === 'female' ? 'female' : 'male');
    }
  }, [currentUser?.id, currentUser?.email]);

  useEffect(() => {
    if (!currentUser?.id || !course?.id) {
      setMySubmissions([]);
      setCompletedModuleIds([]);
      return;
    }
    setCompletedModuleIds(loadCompletedModuleIds(currentUser.id, course.id));

    const handleSyncCompletion = (ev: Event) => {
      const detail = (ev as CustomEvent<{ studentId: string; courseId: string; moduleIds: string[] }>).detail;
      if (detail?.studentId === currentUser.id && detail?.courseId === course.id) {
        setCompletedModuleIds(detail.moduleIds);
      }
    };
    window.addEventListener(MODULE_COMPLETION_EVENT, handleSyncCompletion);

    let active = true;
    setLoadingSubmissions(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/submissions/me', {
          headers,
          credentials: 'include',
        });
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMySubmissions(data);
          }
        }
      } catch {
        // Ignore transient network errors
      } finally {
        if (active) setLoadingSubmissions(false);
      }
    })();
    return () => {
      active = false;
      window.removeEventListener(MODULE_COMPLETION_EVENT, handleSyncCompletion);
    };
  }, [currentUser?.id, course?.id]);

  useEffect(() => {
    setActiveAssignmentTarget(null);
    setActiveModuleQuiz(null);
  }, [course?.id]);

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Course Not Found
        </h2>
        <button
          type="button"
          onClick={onBackToCourses}
          className="px-4 py-2 rounded-xl bg-[#00F2FE] text-slate-950 font-bold text-xs"
        >
          Back to Course Catalog
        </button>
      </div>
    );
  }

  const isEnrolled = currentUser
    ? course.enrolledStudentIds.includes(currentUser.id)
    : false;
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';
  const orientationCount = (course.videoArchives || []).filter((r) => r.isOrientation).length;
  const courseSubmissions = mySubmissions.filter((s) => s.courseId === course.id);

  // Live SeerahVerse-style cohort seat math
  const maxSpots = Math.max(1, course.maxSpots ?? 50);
  const enrolledCount = course.enrolledStudentIds.length;
  const spotsAvailable = Math.max(0, maxSpots - enrolledCount);
  const seatFillPct = Math.min(100, Math.round((enrolledCount / maxSpots) * 100));
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
  const courseDurationLabel = course.durationLabel || '12 Weeks';
  const isRegistrationBlocked = (isBatchFull || isDeadlinePassed) && !isStaff;

  const seatStatusLabel = isDeadlinePassed
    ? 'Time Limit Closed'
    : isBatchFull
    ? 'Batch Full'
    : spotsAvailable <= lowSpotsThreshold
    ? 'Filling Fast'
    : 'Seats Open';
  const seatTextTone =
    isBatchFull || isDeadlinePassed
      ? 'text-rose-600 dark:text-rose-400'
      : spotsAvailable <= lowSpotsThreshold
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';
  const seatBarColor =
    isBatchFull || isDeadlinePassed
      ? 'bg-rose-500'
      : spotsAvailable <= lowSpotsThreshold
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const isModuleOpen = (id: string, idx: number) =>
    expandedModules[id] !== undefined ? expandedModules[id] : idx === 0;

  const toggleModule = (id: string, idx: number) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !(prev[id] !== undefined ? prev[id] : idx === 0),
    }));
  };

  const handleOpenEnrollmentForm = () => {
    if (onNavigateToRegistration) {
      onNavigateToRegistration(course);
      return;
    }
    setEnrollError(null);
    setEnrollDrawerOpen(true);
  };

  const handleSubmitEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    if (!fullName.trim() || !email.trim()) {
      setEnrollError('Please enter your Full Name and Email Address to complete enrollment.');
      return;
    }

    setIsEnrolling(true);
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
      setEnrollDrawerOpen(false);
      setEnrollmentSuccess(true);
      setActiveTab('recordings');
      confetti({
        particleCount: 85,
        spread: 72,
        origin: { y: 0.6 },
        colors: ['#00F2FE', '#10B981', '#38BDF8'],
      });
      setTimeout(() => setEnrollmentSuccess(false), 7000);
    } catch (err: unknown) {
      setEnrollError(
        err instanceof Error ? err.message : 'Unable to process enrollment right now.'
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuery.trim() || isAskingTutor) return;

    const userText = tutorQuery.trim();
    setTutorMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setTutorQuery('');
    setIsAskingTutor(true);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: course.title,
          moduleContext: course.modules,
          query: userText,
        }),
      });
      const data = await res.json();
      setTutorMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text:
            data.answer ||
            'Thank you for your question. Please review the syllabus modules.',
        },
      ]);
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: 'I am temporarily unable to reach the knowledge base. Please check back shortly.',
        },
      ]);
    } finally {
      setIsAskingTutor(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToCourses}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0284C7] dark:hover:text-[#00F2FE] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Courses</span>
        </button>

        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {course.code} · {course.level} Track
        </div>
      </div>

      {/* SeerahVerse-Inspired Course Overview Hero */}
      <section className="rounded-3xl bg-white dark:bg-gradient-to-br dark:from-[#0F2942]/90 dark:via-[#0A192F] dark:to-[#071120] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Hero Split Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 lg:p-10 items-stretch">
          {/* Course Narrative & Primary Action */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-[#0284C7] dark:text-[#00F2FE] font-bold">
                  {course.code}
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-slate-600 dark:text-slate-300">{course.level} Level</span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {course.status}
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-slate-500 dark:text-slate-400">Free Tuition Cohort</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight text-balance">
                {course.title}
              </h1>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {course.description}
              </p>
            </div>

            {/* Primary CTA Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isEnrolled ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4" />
                    Enrolled Cohort Member
                  </span>
                  <button
                    type="button"
                    onClick={onNavigateToPortal}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:brightness-110 transition-all shadow-md whitespace-nowrap"
                  >
                    Open Student Portal →
                  </button>
                </>
              ) : isRegistrationBlocked ? (
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" />
                  {isDeadlinePassed
                    ? 'Enrollment Time Limit Passed'
                    : 'Batch Full (0 Spots Available)'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenEnrollmentForm}
                  className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,254,0.3)] flex items-center gap-2 whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Register for Course — Free ($0)
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('recordings')}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Video className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                {orientationCount > 0
                  ? `Watch Free Orientation (${orientationCount})`
                  : 'View Recordings Curriculum'}
              </button>
            </div>
          </div>

          {/* Course Visual Preview Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="relative aspect-video lg:h-full min-h-[210px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-lg bg-slate-950">
              <img
                src={resolveMediaSrc(course.thumbnail, 'course')}
                alt={course.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-white">
                <span className="tabular-nums">{courseDurationLabel} · {course.modules.length} Modules</span>
                <span className="text-[#00F2FE] tabular-nums">
                  {course.videoArchives.length} Recordings
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Batch Availability, Time Limit & Free Tuition Bar */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/65 px-6 sm:px-8 lg:px-10 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Students Enrolled
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                {enrolledCount}{' '}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  / {maxSpots} limit
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Spots Available
              </div>
              <div className={`text-lg font-extrabold font-mono tabular-nums mt-0.5 ${seatTextTone}`}>
                {spotsAvailable}{' '}
                <span className="text-xs font-semibold">· {seatStatusLabel}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Duration &amp; Time Limit
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {courseDurationLabel}
              </div>
              {formattedDeadline && (
                <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] mt-0.5 tabular-nums flex items-center gap-1">
                  <CalendarClock className="w-3 h-3 shrink-0" />
                  <span>Cutoff: {formattedDeadline.localTimeStr}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1.5 tabular-nums">
                <span>Cohort Occupancy</span>
                <span>{seatFillPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${seatBarColor}`}
                  style={{ width: `${seatFillPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Program Tuition Fee
              </div>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                Free ($0){' '}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  · Waived
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SeerahVerse-Style Deep Course Explanation & Program Outcomes Showcase */}
      <section className="rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
              Course Explanation &amp; Academic Scope
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              About This Program &amp; Learning Architecture
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {course.totalLectures} Lectures · {courseDurationLabel} · Free ($0)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <BookOpen className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
              <span>Course Explanation &amp; Thesis</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {course.description} Taught with primary classical texts, chronological synthesis, and guided contextual reflection led by {course.instructorName}.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Award className="w-4 h-4 text-[#10B981]" />
              <span>Core Learning Outcomes</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {(course.modules.slice(0, 3).map((m) => m.title).length > 0
                ? course.modules.slice(0, 3).map((m) => m.title)
                : ['Master foundational concepts and primary text analysis', 'Apply methodology through supervised exercises', 'Complete structured assessments with faculty feedback']
              ).map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Eligibility, Cap &amp; Schedule</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Student Cap:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{maxSpots} Seats Max</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Cohort Duration:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{courseDurationLabel}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Registration Fee:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">$0.00 (Free)</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Registration Status:</span>
                <span className={`font-semibold ${seatTextTone}`}>
                  {isDeadlinePassed ? 'Deadline Passed' : isBatchFull ? 'Full' : 'Open'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SeerahVerse-Inspired 4-Step Free Enrollment Process */}
      <section className="rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
              Cohort Admission Workflow
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              How Free Enrollment Works
            </h2>
          </div>

          {!isEnrolled && !isRegistrationBlocked && (
            <button
              type="button"
              onClick={handleOpenEnrollmentForm}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:brightness-110 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Open Registration Page ($0 Fee) →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Verify Seat Availability',
              detail: `${spotsAvailable} of ${maxSpots} cohort spots currently available (${enrolledCount} enrolled).`,
            },
            {
              step: '02',
              title: 'Submit Intake Application',
              detail: 'Enter your contact details, Brothers/Sisters track, educational background, and preferred language.',
            },
            {
              step: '03',
              title: 'Tuition Fee: Free ($0)',
              detail: 'Full institutional fee waiver — zero payment, no bank transfer, and no receipt verification required.',
            },
            {
              step: '04',
              title: 'Instant Cohort Access',
              detail: 'Immediately unlock private lecture recordings, worksheets, live Zoom rooms, and homework review.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="text-xs font-mono font-bold text-[#0284C7] dark:text-[#00F2FE] tabular-nums">
                Step {item.step}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Post-Enrollment Unlock Banner */}
      {enrollmentSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/50 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-3 shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Enrollment confirmed! All cohort class recordings, Supplementary PDFs, and live classroom rooms are now unlocked for this course.
          </span>
        </motion.div>
      )}

      {/* 2-Column Asymmetric Course Workspace (Left Sticky Rail + Right Multi-Column Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sticky Rail: Section Switcher & 2x2 Bento Course Facts */}
        <aside className="lg:col-span-3 space-y-5 lg:sticky lg:top-20">
          {/* Course Navigation Tiles (2-col on mobile, vertical rail on desktop) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 p-3 space-y-2 shadow-sm">
            <div className="px-2 pt-1 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Course Sections
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {[
                {
                  key: 'recordings',
                  label: 'Recordings',
                  sub: `${course.videoArchives.length} Videos`,
                  icon: Video,
                },
                {
                  key: 'syllabus',
                  label: 'Syllabus & Stages',
                  sub: `${course.modules.length} Modules`,
                  icon: BookOpen,
                },
                {
                  key: 'schedules',
                  label: 'Live Classes',
                  sub: `${course.schedules.length} Scheduled`,
                  icon: Calendar,
                },
                {
                  key: 'materials',
                  label: 'Materials & PDFs',
                  sub: `${course.materials.length} Packets`,
                  icon: FileText,
                },
                {
                  key: 'assignments',
                  label: 'Assignments',
                  sub: `${course.assignments.length} Tasks`,
                  icon: ClipboardCheck,
                },
                {
                  key: 'tutor',
                  label: 'Course AI Tutor',
                  sub: 'Interactive Q&A',
                  icon: Bot,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 border ${
                      isActive
                        ? 'bg-sky-50 dark:bg-[#00F2FE]/15 border-[#0284C7] dark:border-[#00F2FE]/60 text-slate-950 dark:text-white shadow-sm'
                        : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-[#0284C7] dark:bg-[#00F2FE] text-white dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{tab.label}</div>
                      <div className="text-[10px] font-mono opacity-75 truncate tabular-nums">
                        {tab.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2x2 Course Overview Bento Cards */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                Students Enrolled
              </div>
              <div className="font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                {enrolledCount} / {maxSpots}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                Spots Available
              </div>
              <div className={`font-bold mt-1 font-mono tabular-nums ${seatTextTone}`}>
                {spotsAvailable} ({seatStatusLabel})
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                Instructor
              </div>
              <div className="font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                {course.instructorName}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                Tuition Fee
              </div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 leading-snug font-mono tabular-nums">
                Free ($0 · Waived)
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Course Stage */}
        <div className="lg:col-span-9 min-w-0 space-y-6">

      {/* TAB 1: SourceCode Academy 2-Zone Recordings Workspace */}
      {activeTab === 'recordings' && (
        <CourseRecordingsWorkspace
          course={course}
          isEnrolled={isEnrolled}
          isAdmin={currentUser?.role === 'admin'}
          isStaff={isStaff}
          viewerEmail={currentUser?.email}
          customLogoUrl={customLogoUrl}
          onEnroll={handleOpenEnrollmentForm}
        />
      )}

      {/* TAB 2: Progressive Syllabus Modules & Post-Module Auto-Graded Quizzes */}
      {activeTab === 'syllabus' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{course.modules.length} Structured Curriculum Stages</span>
            <span className="font-mono tabular-nums">
              {completedModuleIds.length} / {course.modules.length} Completed · Post-Module Quizzes Enabled
            </span>
          </div>

          {/* Inline Module Assessment Runner */}
          {(isEnrolled || isStaff) && activeModuleQuiz && currentUser && (
            <ModuleQuizRunner
              courseId={course.id}
              courseCode={course.code}
              courseTitle={course.title}
              assessment={activeModuleQuiz}
              studentId={currentUser.id}
              studentName={`${currentUser.firstName} ${currentUser.lastName}`.trim()}
              existingSubmission={courseSubmissions.find(
                (s) => s.assessmentId === activeModuleQuiz.id
              )}
              onSubmitted={(sub) => {
                setMySubmissions((prev) => [
                  sub,
                  ...prev.filter((existing) => existing.id !== sub.id),
                ]);
              }}
              onClose={() => setActiveModuleQuiz(null)}
              onViewTranscript={onNavigateToPortal}
              onRefreshData={onRefreshData}
            />
          )}

          {course.modules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {course.modules.map((module, idx) => {
                const expanded = isModuleOpen(module.id, idx);
                const moduleQuiz = findQuizForModule(course, module, idx);
                const quizSubmission = courseSubmissions.find(
                  (s) => s.assessmentId === moduleQuiz.id
                );
                const isCompleted =
                  completedModuleIds.includes(module.id) || Boolean(quizSubmission);

                const handleToggleComplete = () => {
                  if (!currentUser?.id) return;
                  const nextIds = isCompleted
                    ? completedModuleIds.filter((id) => id !== module.id)
                    : [...completedModuleIds, module.id];
                  setCompletedModuleIds(
                    saveCompletedModuleIds(currentUser.id, course.id, nextIds)
                  );
                };

                const handleCompleteAndLaunchQuiz = () => {
                  if (currentUser?.id && !isCompleted) {
                    const nextIds = [...completedModuleIds, module.id];
                    setCompletedModuleIds(
                      saveCompletedModuleIds(currentUser.id, course.id, nextIds)
                    );
                  }
                  setActiveModuleQuiz(moduleQuiz);
                };

                return (
                  <div
                    key={module.id}
                    className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id, idx)}
                      className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] font-semibold">
                          <span>
                            Stage {String(idx + 1).padStart(2, '0')} · {module.lecturesCount} Lectures
                          </span>
                          {isCompleted && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              · Completed
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                          {module.title}
                        </h3>
                      </div>
                      {expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {expanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/70 space-y-3 text-xs sm:text-sm">
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {module.description}
                        </p>

                        {module.learningObjectives && module.learningObjectives.length > 0 && (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white mb-1.5 text-xs">
                              Learning Objectives:
                            </div>
                            <ul className="space-y-1 text-slate-600 dark:text-slate-400 pl-4 list-disc text-xs">
                              {module.learningObjectives.map((obj, i) => (
                                <li key={i}>{obj}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {module.instructorNotes && (
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Instructor Note:{' '}
                            </span>
                            {module.instructorNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Post-Module Completion & Auto-Graded Quiz Bar */}
                    <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {moduleQuiz.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {moduleQuiz.quizQuestions?.length || 0} Questions · {moduleQuiz.points} pts
                          {quizSubmission && (
                            <span className="ml-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                              · Score: {quizSubmission.grade ?? quizSubmission.quizScore ?? 0}/
                              {quizSubmission.maxPoints}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isEnrolled || isStaff ? (
                          <>
                            <button
                              type="button"
                              onClick={handleToggleComplete}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                                isCompleted
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCompleteAndLaunchQuiz}
                              className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Play className="w-3 h-3" />
                              <span>
                                {quizSubmission
                                  ? 'View Result / Retake'
                                  : isCompleted
                                  ? 'Take Module Quiz'
                                  : 'Complete & Take Quiz'}
                              </span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenEnrollmentForm}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Enroll Free to Unlock Quiz</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
              Modules will be published shortly by {course.instructorName}.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live Schedules */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
              <span>
                Local Timezone Detected:{' '}
                <strong className="font-mono text-slate-900 dark:text-white">
                  {getUserTimezoneShort()}
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Auto-Clock Active
            </span>
          </div>

          {course.schedules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.schedules.map((sch) => {
                const localTime = formatToLocalTime(sch.timeUtc, sch.dayOfWeek);
                return (
                  <div
                    key={sch.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-sm"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {sch.title}
                        </span>
                        {sch.isLiveNow && (
                          <span className="text-[11px] font-bold text-rose-500 uppercase font-mono">
                            · Live Now
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        Instructor: {sch.instructorName || course.instructorName}
                      </div>
                      <div className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <span className="text-[#0284C7] dark:text-[#00F2FE] font-bold">
                          {localTime.localTimeStr}
                        </span>{' '}
                        ({sch.dateStr ? `${sch.dateStr} · ` : ''}
                        {localTime.localDayStr}) · {sch.durationMinutes} mins
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isStaff && onStartMeeting && (
                        <button
                          type="button"
                          onClick={() =>
                            onStartMeeting({
                              title: sch.title,
                              courseId: course.id,
                              courseTitle: course.title,
                              scheduleId: sch.id,
                              instructorName: sch.instructorName || course.instructorName,
                              meetingId: sch.zoomMeetingId,
                              meetingPasscode: sch.zoomPasscode,
                              joinUrl: sch.zoomJoinUrl,
                            })
                          }
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Start Meeting (Host)
                        </button>
                      )}
                      {isEnrolled || isStaff ? (
                        <button
                          type="button"
                          onClick={() => onJoinClassWithAttendance(course.id, sch.id)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-1.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join Meeting
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenEnrollmentForm}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Enroll Free to Join Live
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
              No live sessions scheduled currently.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Supplementary PDFs & Reading Materials (2-Column Split Grid) */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* Column 1: Lecture Supplementary Worksheets */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="text-xs font-bold text-[#0284C7] dark:text-[#00F2FE] uppercase tracking-wider font-mono">
                Lecture Supplementary PDFs
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {course.videoArchives.filter((rec) => rec.supplementaryPdfUrl || rec.supplementaryPdfName).length} Files
              </span>
            </div>

            {course.videoArchives.some(
              (rec) => rec.supplementaryPdfUrl || rec.supplementaryPdfName
            ) ? (
              <div className="space-y-2.5">
                {course.videoArchives
                  .filter((rec) => rec.supplementaryPdfUrl || rec.supplementaryPdfName)
                  .map((rec) => {
                    const canDownload = Boolean(
                      (isEnrolled || isStaff || rec.isOrientation) && rec.supplementaryPdfUrl
                    );
                    return (
                      <div
                        key={`supp-${rec.id}`}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-[#00F2FE]/10 flex items-center justify-center text-[#0284C7] dark:text-[#00F2FE] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {rec.supplementaryPdfName || `${rec.title} — Supplementary PDF`}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              Attached to: {rec.title}
                            </div>
                          </div>
                        </div>

                        {canDownload ? (
                          <a
                            href={`${rec.supplementaryPdfUrl}${
                              rec.supplementaryPdfUrl!.includes('?') ? '&' : '?'
                            }download=1`}
                            download={rec.supplementaryPdfName || 'supplementary-materials.pdf'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Download PDF
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenEnrollmentForm}
                            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300 font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Enroll Free
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No lecture worksheets attached to recordings yet.
              </div>
            )}
          </div>

          {/* Column 2: Curriculum Study Packets */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                Curriculum Study Packets
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {course.materials.length} Files
              </span>
            </div>

            {course.materials.length > 0 ? (
              <div className="space-y-2.5">
                {course.materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#0284C7] dark:text-[#00F2FE] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {mat.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {mat.fileType.toUpperCase()} · {mat.size}
                        </div>
                      </div>
                    </div>
                    <a
                      href={
                        !mat.fileUrl || mat.fileUrl.startsWith('#')
                          ? `/api/courses/${encodeURIComponent(
                              course.id
                            )}/materials/${encodeURIComponent(mat.id)}/download`
                          : mat.fileUrl
                      }
                      download
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold whitespace-nowrap shrink-0"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No study packets uploaded yet for this course.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Assignments & Instructor Review Submissions */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Header Strip */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-bold">
                Instructor Review &amp; Feedback
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Course Assignments &amp; Homework Submissions
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Upload completed assignment files (PDF, Word, Slides, Images, ZIP) or share external links (Google Docs, Drive, GitHub) for review by {course.instructorName}.
              </p>
            </div>

            {isEnrolled || isStaff ? (
              <button
                type="button"
                onClick={() =>
                  setActiveAssignmentTarget({
                    id: 'general-coursework',
                    title: 'Coursework / Practice Submission',
                    type: 'homework',
                    points: 100,
                    allowFileUpload: true,
                  })
                }
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Submit Coursework File or Link</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenEnrollmentForm}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Enroll Free to Submit</span>
              </button>
            )}
          </div>

          {/* Non-Enrolled Lock Notice */}
          {!isEnrolled && !isStaff && (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Enrollment Required to Submit Assignments
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Free cohort registration unlocks file uploads, external link submissions, and direct instructor grading for {course.title}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenEnrollmentForm}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0"
              >
                Enroll Free to Submit Assignments
              </button>
            </div>
          )}

          {/* Active Inline Quiz Runner */}
          {(isEnrolled || isStaff) && activeModuleQuiz && currentUser && (
            <ModuleQuizRunner
              courseId={course.id}
              courseCode={course.code}
              courseTitle={course.title}
              assessment={activeModuleQuiz}
              studentId={currentUser.id}
              studentName={`${currentUser.firstName} ${currentUser.lastName}`.trim()}
              existingSubmission={courseSubmissions.find(
                (s) => s.assessmentId === activeModuleQuiz.id
              )}
              onSubmitted={(sub) => {
                setMySubmissions((prev) => [
                  sub,
                  ...prev.filter((existing) => existing.id !== sub.id),
                ]);
              }}
              onClose={() => setActiveModuleQuiz(null)}
              onViewTranscript={onNavigateToPortal}
              onRefreshData={onRefreshData}
            />
          )}

          {/* Active Inline Submission Form */}
          {(isEnrolled || isStaff) && activeAssignmentTarget && currentUser && (
            <AssignmentSubmissionBox
              courseId={course.id}
              assessment={activeAssignmentTarget}
              studentId={currentUser.id}
              studentName={`${currentUser.firstName} ${currentUser.lastName}`.trim()}
              onSubmitted={(sub) => {
                setMySubmissions((prev) => [
                  sub,
                  ...prev.filter((existing) => existing.id !== sub.id),
                ]);
              }}
              onCancel={() => setActiveAssignmentTarget(null)}
              onRefreshData={onRefreshData}
            />
          )}

          {/* Assigned Homework, Quizzes & Exams Bento Grid */}
          <div className={course.assignments.length > 0 ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : ''}>
            {course.assignments.length > 0 ? (
              course.assignments.map((ass) => {
                const due = formatToLocalTime(ass.dueDateUtc);
                const latestSub = courseSubmissions.find((s) => s.assessmentId === ass.id);
                const isExternalSubmissionUrl = Boolean(
                  latestSub?.fileUrl &&
                    /^https?:\/\//i.test(latestSub.fileUrl) &&
                    !latestSub.fileUrl.includes('/api/docs/')
                );

                return (
                  <div
                    key={ass.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="uppercase px-2 py-0.5 rounded bg-sky-500/15 text-[#0284C7] dark:text-[#00F2FE] font-bold">
                          {ass.type === 'pop_quiz'
                            ? 'Animated Quiz'
                            : ass.type === 'exam'
                            ? 'Timed Exam'
                            : ass.type.replace('_', ' ')}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {ass.points} Points
                        </span>
                        {ass.durationMinutes ? (
                          <span className="text-amber-600 dark:text-amber-300">
                            · {ass.durationMinutes} min timer
                          </span>
                        ) : null}
                        {latestSub && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            {latestSub.status === 'graded'
                              ? `Graded: ${latestSub.grade ?? latestSub.quizScore ?? 0}/${latestSub.maxPoints}`
                              : 'Submitted for Review'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {ass.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                        {ass.description}
                      </p>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Due: {due.localTimeStr} ({due.localDayStr}) · {due.timezoneLabel}
                      </div>

                      {ass.attachments && ass.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ass.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={`${att.url}${att.url.includes('?') ? '&' : '?'}download=1`}
                              download={att.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-[#0284C7] dark:text-[#00F2FE]"
                            >
                              <FileDown className="w-3 h-3" />
                              <span>Worksheet: {att.name}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {latestSub?.fileUrl && (
                        <div className="pt-1">
                          <a
                            href={
                              isExternalSubmissionUrl
                                ? latestSub.fileUrl
                                : `${latestSub.fileUrl}${
                                    latestSub.fileUrl.includes('?') ? '&' : '?'
                                  }download=1`
                            }
                            download={!isExternalSubmissionUrl ? latestSub.fileName || true : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                          >
                            {isExternalSubmissionUrl ? (
                              <ExternalLink className="w-3 h-3" />
                            ) : (
                              <FileDown className="w-3 h-3" />
                            )}
                            <span>
                              Your Submission: {latestSub.fileName || latestSub.fileUrl}
                            </span>
                          </a>
                        </div>
                      )}

                      {latestSub?.feedback && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                          <strong>Instructor Feedback:</strong> {latestSub.feedback}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-wrap items-center gap-2">
                      {isEnrolled || isStaff ? (
                        ass.type === 'pop_quiz' || ass.type === 'exam' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAssignmentTarget(null);
                              setActiveModuleQuiz(ass);
                            }}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>
                              {latestSub
                                ? 'View Result / Retake'
                                : ass.type === 'exam'
                                ? 'Start Timed Exam'
                                : 'Take Auto-Graded Quiz'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleQuiz(null);
                              setActiveAssignmentTarget(ass);
                            }}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Upload className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                            <span>{latestSub ? 'Resubmit File / Link' : 'Submit File / Link'}</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenEnrollmentForm}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Enroll Free to Submit</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  No formal deadlines posted yet for this course — enrolled students can still upload coursework files or share links anytime for instructor review.
                </p>
                {(isEnrolled || isStaff) && !activeAssignmentTarget && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveAssignmentTarget({
                        id: 'general-coursework',
                        title: 'Coursework / Practice Submission',
                        type: 'homework',
                        points: 100,
                        allowFileUpload: true,
                      })
                    }
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:brightness-110 inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Coursework or Link Now</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Student Submission History for This Course */}
          {(isEnrolled || isStaff) && (courseSubmissions.length > 0 || loadingSubmissions) && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-300">
                  <Award className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                  <span>Your Submitted Work for {course.code}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {courseSubmissions.length} Submission{courseSubmissions.length === 1 ? '' : 's'}
                </span>
              </div>

              {loadingSubmissions && courseSubmissions.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Loading your submissions...
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {courseSubmissions.map((sub) => {
                    const subTitle = resolveAssessmentTitle(course, sub.assessmentId);
                    const isExternalUrl = Boolean(
                      sub.fileUrl &&
                        /^https?:\/\//i.test(sub.fileUrl) &&
                        !sub.fileUrl.includes('/api/docs/')
                    );

                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {subTitle}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                sub.status === 'graded'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {sub.status === 'graded'
                                ? `Graded: ${sub.grade ?? sub.quizScore ?? 0}/${sub.maxPoints}`
                                : 'Pending Instructor Review'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            Submitted {new Date(sub.submittedAt).toLocaleString()}
                          </div>
                          {sub.content && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                              {sub.content}
                            </p>
                          )}
                          {sub.feedback && (
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                              <strong>Instructor Feedback:</strong> {sub.feedback}
                            </div>
                          )}
                        </div>

                        {sub.fileUrl && (
                          <a
                            href={
                              isExternalUrl
                                ? sub.fileUrl
                                : `${sub.fileUrl}${sub.fileUrl.includes('?') ? '&' : '?'}download=1`
                            }
                            download={!isExternalUrl ? sub.fileName || true : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                          >
                            {isExternalUrl ? (
                              <ExternalLink className="w-3.5 h-3.5" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span>{sub.fileName || (isExternalUrl ? 'Open Link' : 'Download File')}</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: Course AI Tutor (2-Column Study Deck + Live Chat) */}
      {activeTab === 'tutor' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          <div className="md:col-span-4 p-4 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
              <span>Quick Study Prompts</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Pick a starter question below or ask anything about {course.title}.
            </p>
            <div className="space-y-2">
              {[
                `Summarize the key goals of ${course.title}`,
                'Which classical texts or prerequisites should I review first?',
                'Explain how the syllabus modules build week by week',
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTutorQuery(prompt)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-8 flex flex-col h-[400px] bg-white dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200">
                <Bot className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                <span className="font-bold">Course AI Tutor</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                {course.title}
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  Assalamu Alaykum! Ask any question about &quot;{course.title}&quot;, its syllabus modules, or recommended classical sources.
                </div>
              </div>
              {tutorMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl ${
                      msg.sender === 'user'
                        ? 'bg-[#0284C7]/15 dark:bg-[#00F2FE]/20 text-slate-900 dark:text-slate-100 border border-[#0284C7]/30 dark:border-[#00F2FE]/40'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAskingTutor && (
                <div className="text-slate-500 text-xs italic flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE] animate-spin" />
                  Consulting course syllabus context...
                </div>
              )}
            </div>

            <form
              onSubmit={handleAskTutor}
              className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={tutorQuery}
                onChange={(e) => setTutorQuery(e.target.value)}
                placeholder="Ask a question about this course syllabus..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
              />
              <button
                type="submit"
                disabled={isAskingTutor || !tutorQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#00F2FE] hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* SeerahVerse-Inspired Structured Enrollment Application Modal */}
      {enrollDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-6">
            <div className="p-6 bg-gradient-to-r from-[#0F2942] to-[#0A192F] text-white border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#00F2FE]">
                  Cohort Admission &amp; Enrollment · {course.code}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold mt-1">
                  Enroll in {course.title}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Complete your student intake profile to unlock all locked class recordings, downloadable PDFs, and live cohort classrooms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close enrollment form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/75 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Students Enrolled
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {enrolledCount} of {maxSpots}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Spots Available
                </div>
                <div className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${seatTextTone}`}>
                  {spotsAvailable} Remaining ({seatStatusLabel})
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tuition &amp; Fee
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  Free ($0 — Waived)
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitEnrollment} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Zayd Farooq"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phoneWhatsApp}
                    onChange={(e) => setPhoneWhatsApp(e.target.value)}
                    placeholder="+1 555 234 5678 (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="24"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cohort Track <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={gender}
                      onChange={(e) =>
                        setGender(e.target.value === 'female' ? 'female' : 'male')
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    >
                      <option value="male">Brothers</option>
                      <option value="female">Sisters</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United Kingdom"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. London"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Educational Background
                  </label>
                  <input
                    type="text"
                    value={educationBackground}
                    onChange={(e) => setEducationBackground(e.target.value)}
                    placeholder="High School / University / Alimiyyah"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Instruction Language
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Learning Goals &amp; Prior Study (Optional)
                </label>
                <textarea
                  rows={2}
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="Share any relevant background or questions for Instructor Mustaqeem Shaikh..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                />
              </div>

              {enrollError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
                  {enrollError}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>No payment or transfer required · Free ($0) instant admission</span>
                </div>
                <button
                  type="submit"
                  disabled={isEnrolling || (isBatchFull && !isStaff)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <UserCheck className="w-4 h-4" />
                  {isEnrolling
                    ? 'Confirming Free Enrollment...'
                    : isBatchFull && !isStaff
                    ? 'Batch Full (0 Spots)'
                    : 'Complete Free Enrollment ($0)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
