import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Video,
  FileText,
  FileDown,
  Award,
  Upload,
  Play,
  ArrowLeft,
  Eye,
  Check,
  Loader2,
  GraduationCap,
  Radio,
  ExternalLink,
  MessageSquareText,
  SlidersHorizontal,
  X,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import type {
  Course,
  User,
  AcademicAssessment,
  StudentSubmission,
  AttendanceRecord,
  StudentSubjectProgress,
  CalendarEvent,
} from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { CircularProfileSeal } from './CircularProfileSeal';
import { CourseRecordingsWorkspace } from './CourseRecordingsWorkspace';
import { AssignmentSubmissionBox } from './AssignmentSubmissionBox';
import { AssignmentDeadlineCountdown } from './AssignmentDeadlineCountdown';
import { ModuleQuizRunner } from './ModuleQuizRunner';
import {
  findQuizForModule,
  loadCompletedModuleIds,
  saveCompletedModuleIds,
  resolveAssessmentTitle,
  MODULE_COMPLETION_EVENT,
} from '../utils/moduleQuizHelper';
import {
  formatToLocalTime,
  getUserTimezoneShort,
  TIMEZONE_CHANGED_EVENT,
  TIMEZONE_STORAGE_KEY,
} from '../utils/timezone';
import {
  generateStudentReportCardPdf,
  getLetterGrade,
} from '../utils/reportCardPdf';
import {
  uploadAssetSmart,
  getAuthHeaders,
} from '../services/firebaseService';

interface StudentPortalProps {
  currentUser: User | null;
  courses: Course[];
  events?: CalendarEvent[];
  customLogoUrl?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onJoinClassWithAttendance: (courseId: string, scheduleId: string) => void;
  onJoinEventMeeting?: (ev: CalendarEvent) => void;
  onEnroll?: (courseId: string) => Promise<void>;
  onBrowseCourses?: () => void;
  onOpenCoursePage?: (course: Course) => void;
  onOpenAccountSettings?: (tab?: 'timezone' | 'password') => void;
  // If viewing a specific student as Admin/Teacher
  viewerStudentId?: string;
  viewerStudent?: User;
  viewerProgress?: StudentSubjectProgress;
  onExitViewerMode?: () => void;
  onRefreshData?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  currentUser,
  courses,
  events = [],
  customLogoUrl,
  theme,
  onToggleTheme,
  onJoinClassWithAttendance,
  onJoinEventMeeting,
  onEnroll,
  onBrowseCourses,
  onOpenCoursePage,
  onOpenAccountSettings,
  viewerStudentId,
  viewerStudent,
  viewerProgress,
  onExitViewerMode,
  onRefreshData,
}) => {
  const activeStudent = viewerStudent || currentUser;
  const isViewerMode = !!viewerStudentId;
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const enrolledCourses = courses.filter((c) =>
    activeStudent ? c.enrolledStudentIds.includes(activeStudent.id) : false
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    enrolledCourses[0]?.id || courses[0]?.id || ''
  );
  const [manualCoursePick, setManualCoursePick] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'lectures' | 'assessments' | 'grades' | 'attendance' | 'materials'
  >('overview');

  // Interactive Quiz & Module Assessment runner state
  const [activeQuiz, setActiveQuiz] = useState<AcademicAssessment | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);

  // Homework / assignment submission state (file upload + external link + notes)
  const [submittingAssessment, setSubmittingAssessment] = useState<
    (Pick<AcademicAssessment, 'id' | 'title' | 'type' | 'points' | 'allowFileUpload'> & {
      courseId?: string;
    }) | null
  >(null);

  // Student's own graded & pending submissions
  const [mySubmissions, setMySubmissions] = useState<StudentSubmission[]>(
    viewerProgress?.submissions || []
  );

  // Attendance state
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(
    viewerProgress?.attendanceHistory || []
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Profile Avatar Upload state
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  // Instructor Feedback Modal state
  const [feedbackModalEntry, setFeedbackModalEntry] = useState<{
    assessmentTitle: string;
    assessmentType: string;
    courseCode?: string;
    courseTitle?: string;
    dueDateUtc?: string;
    submission: StudentSubmission;
  } | null>(null);

  // Unified Firebase-synced theme (controlled via App.tsx with safe fallback)
  const [fallbackTheme, setFallbackTheme] = useState<'dark' | 'light'>(() => {
    try {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });
  const portalTheme: 'dark' | 'light' = theme ?? fallbackTheme;

  const togglePortalTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }
    setFallbackTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Report Card PDF export state
  const [reportCardScope, setReportCardScope] = useState<'current' | 'all'>('all');
  const [downloadingReportPdf, setDownloadingReportPdf] = useState(false);
  const [reportDownloadMessage, setReportDownloadMessage] = useState<string | null>(null);
  const [reportDownloadError, setReportDownloadError] = useState<string | null>(null);

  // Reactive Timezone label synced to saved timezone preference
  const [activeTimezoneLabel, setActiveTimezoneLabel] = useState<string>(() =>
    getUserTimezoneShort()
  );

  // SeerahVerse-style Circular Profile Load on mount / student switch
  const [profileHydrating, setProfileHydrating] = useState(true);

  useEffect(() => {
    setProfileHydrating(true);
    const timer = window.setTimeout(() => {
      setProfileHydrating(false);
    }, 740);
    return () => window.clearTimeout(timer);
  }, [activeStudent?.id]);

  // Synchronized 1-second clock for active assignment countdown timers
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncTz = () => setActiveTimezoneLabel(getUserTimezoneShort());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TIMEZONE_STORAGE_KEY) syncTz();
    };
    window.addEventListener(TIMEZONE_CHANGED_EVENT, syncTz);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(TIMEZONE_CHANGED_EVENT, syncTz);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!feedbackModalEntry) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFeedbackModalEntry(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [feedbackModalEntry]);

  const currentCourse =
    courses.find((c) => c.id === selectedCourseId) || enrolledCourses[0] || courses[0];

  useEffect(() => {
    if (courses.length > 0 && !courses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(enrolledCourses[0]?.id || courses[0]?.id || '');
      return;
    }
    if (
      !manualCoursePick &&
      enrolledCourses.length > 0 &&
      !enrolledCourses.some((c) => c.id === selectedCourseId)
    ) {
      setSelectedCourseId(enrolledCourses[0].id);
    }
  }, [courses, enrolledCourses, selectedCourseId, manualCoursePick]);

  useEffect(() => {
    if (viewerProgress?.submissions) {
      setMySubmissions(viewerProgress.submissions);
      return;
    }
    if (!activeStudent?.id) {
      setMySubmissions([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/submissions/me', {
          headers,
          credentials: 'include',
        });
        if (res.ok && active) {
          const data: StudentSubmission[] = await res.json();
          setMySubmissions(Array.isArray(data) ? data : []);
        }
      } catch {
        // Ignore transient network errors
      }
    })();
    return () => {
      active = false;
    };
  }, [activeStudent?.id, viewerProgress, courses]);

  useEffect(() => {
    if (viewerProgress?.attendanceHistory) {
      setAttendanceLogs(viewerProgress.attendanceHistory);
      return;
    }
    if (!activeStudent?.id) {
      setAttendanceLogs([]);
      return;
    }
    let active = true;
    setAttendanceLoading(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/attendance/me?studentId=${encodeURIComponent(activeStudent.id)}`,
          { headers }
        );
        if (res.ok && active) {
          const logs: AttendanceRecord[] = await res.json();
          setAttendanceLogs(Array.isArray(logs) ? logs : []);
        }
      } catch {
        // Ignore transient network errors fetching attendance
      } finally {
        if (active) setAttendanceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeStudent?.id, viewerProgress, courses]);

  // Sync completed modules for selected course
  useEffect(() => {
    if (!activeStudent?.id || !selectedCourseId) {
      setCompletedModuleIds([]);
      return;
    }
    setCompletedModuleIds(loadCompletedModuleIds(activeStudent.id, selectedCourseId));

    const handleSyncCompletion = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ studentId: string; courseId: string; moduleIds: string[] }>
      ).detail;
      if (detail?.studentId === activeStudent.id && detail?.courseId === selectedCourseId) {
        setCompletedModuleIds(detail.moduleIds);
      }
    };
    window.addEventListener(MODULE_COMPLETION_EVENT, handleSyncCompletion);
    return () => window.removeEventListener(MODULE_COMPLETION_EVENT, handleSyncCompletion);
  }, [activeStudent?.id, selectedCourseId]);

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeStudent) return;
    setAvatarUploadError(null);
    setAvatarUploadProgress(5);

    try {
      const { url: avatarUrl, storagePath: avatarStoragePath } = await uploadAssetSmart(
        'avatar',
        file,
        (pct) => setAvatarUploadProgress(pct)
      );

      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(`/api/users/${encodeURIComponent(activeStudent.id)}/avatar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          avatarUrl,
          avatarStoragePath,
          email: activeStudent.email,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save profile photo.');
      }

      if (onRefreshData) await onRefreshData();
      setAvatarUploadProgress(null);
    } catch (err: unknown) {
      setAvatarUploadProgress(null);
      const msg = err instanceof Error ? err.message : 'Unable to upload profile image.';
      setAvatarUploadError(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleStartQuiz = (assessment: AcademicAssessment) => {
    setSubmittingAssessment(null);
    setActiveQuiz(assessment);
  };

  if (!activeStudent) {
    return (
      <div
        data-portal-theme={portalTheme}
        className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-[#071120] text-slate-900 dark:text-slate-100 transition-colors duration-200"
      >
        <div className="py-16 text-center max-w-md mx-auto px-4">
          <div className="p-8 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <BookOpen className="w-10 h-10 text-[#0284C7] dark:text-[#00F2FE] mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Portal</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please sign in with your institutional credentials to access live classes, lecture recordings, Supplementary PDFs, quizzes, and exams.
            </p>
            <button
              type="button"
              onClick={togglePortalTheme}
              aria-pressed={portalTheme === 'dark'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap"
            >
              {portalTheme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gather Upcoming Live Classes from BOTH enrolled courses (or all courses) & calendar events with meeting IDs
  const liveClassFeed: Array<{
    key: string;
    title: string;
    courseId?: string;
    courseCode?: string;
    scheduleId?: string;
    eventObj?: CalendarEvent;
    instructorName: string;
    dateStr?: string;
    dayOfWeek?: string;
    timeUtc: string;
    isLiveNow?: boolean;
    meetingId: string;
  }> = [];

  const seenMeetingKeys = new Set<string>();
  const sourceCourses = enrolledCourses.length > 0 ? enrolledCourses : courses;

  sourceCourses.forEach((course) => {
    (course.schedules || []).forEach((sch) => {
      const dedupeKey = `${course.id}:${sch.id}`;
      if (seenMeetingKeys.has(dedupeKey)) return;
      seenMeetingKeys.add(dedupeKey);
      liveClassFeed.push({
        key: dedupeKey,
        title: sch.title,
        courseId: course.id,
        courseCode: course.code,
        scheduleId: sch.id,
        instructorName: sch.instructorName || course.instructorName,
        dateStr: sch.dateStr,
        dayOfWeek: sch.dayOfWeek,
        timeUtc: sch.timeUtc,
        isLiveNow: sch.isLiveNow,
        meetingId: sch.zoomMeetingId,
      });
    });
  });

  events
    .filter((ev) => !ev.isDerived && Boolean(ev.meetingId || ev.joinUrl))
    .forEach((ev) => {
      const linkedCourse = courses.find((c) => c.id === ev.courseId);
      const dedupeKey = `ev:${ev.id}`;
      if (seenMeetingKeys.has(dedupeKey)) return;
      seenMeetingKeys.add(dedupeKey);
      liveClassFeed.push({
        key: dedupeKey,
        title: ev.title,
        courseId: ev.courseId,
        courseCode: linkedCourse?.code,
        eventObj: ev,
        instructorName: ev.instructorName || linkedCourse?.instructorName || 'Mustaqeem Shaikh',
        dateStr: ev.dateStr,
        dayOfWeek: ev.dayOfWeek,
        timeUtc: ev.timeUtc || ev.startUtc,
        isLiveNow: ev.isLiveNow,
        meetingId: ev.meetingId || 'SANCTUARY',
      });
    });

  // Gather Active Unsubmitted Assignments across enrolled (or catalog) courses, soonest deadline first
  const activeAssignmentFeed = sourceCourses
    .flatMap((course) =>
      (course.assignments || [])
        .filter(
          (ass) =>
            !mySubmissions.some(
              (s) => s.courseId === course.id && s.assessmentId === ass.id
            )
        )
        .map((ass) => ({
          course,
          assignment: ass,
          dueMs: new Date(ass.dueDateUtc).getTime() || Number.MAX_SAFE_INTEGER,
        }))
    )
    .sort((a, b) => a.dueMs - b.dueMs);

  // Dynamic student metrics
  const completedLecturesCount = currentCourse?.videoArchives?.length || 0;
  const totalLecturesCount = Math.max(1, currentCourse?.totalLectures || 12);
  const courseAttendanceLogs = currentCourse
    ? attendanceLogs.filter((a) => a.courseId === currentCourse.id)
    : attendanceLogs;
  const expectedSessions = Math.max(1, currentCourse?.schedules?.length || 1);
  const attendancePercent = viewerProgress
    ? viewerProgress.attendancePercentage
    : courseAttendanceLogs.length > 0
    ? Math.min(
        100,
        Math.round(
          (courseAttendanceLogs.length /
            Math.max(expectedSessions, courseAttendanceLogs.length)) *
            100
        )
      )
    : 0;
  const isEnrolledInCurrent = currentCourse
    ? currentCourse.enrolledStudentIds.includes(activeStudent.id)
    : false;
  const currentCourseGradedSubs = currentCourse
    ? mySubmissions.filter(
        (s) =>
          s.courseId === currentCourse.id &&
          s.status === 'graded' &&
          typeof (s.grade ?? s.quizScore) === 'number'
      )
    : [];
  const currentCourseEarned = currentCourseGradedSubs.reduce(
    (sum, s) => sum + (s.grade ?? s.quizScore ?? 0),
    0
  );
  const currentCoursePossible = currentCourseGradedSubs.reduce(
    (sum, s) => sum + Math.max(1, s.maxPoints || 100),
    0
  );
  const computedCoursePercent =
    currentCoursePossible > 0
      ? Math.round((currentCourseEarned / currentCoursePossible) * 100)
      : undefined;

  const standingPercent = viewerProgress?.overallGradePercent ?? computedCoursePercent;
  const standingLabel =
    standingPercent !== undefined
      ? `Grade ${getLetterGrade(standingPercent)} (${standingPercent}%)`
      : isEnrolledInCurrent
      ? `${courseAttendanceLogs.length} Logged`
      : 'Open Access';
  const standingSublabel =
    standingPercent !== undefined
      ? standingPercent >= 90
        ? "Dean's Honor Roll"
        : 'Active Cohort Standing'
      : isEnrolledInCurrent
      ? `${currentCourse?.assignments?.length || 0} Course Assessments`
      : 'Enroll to Track Grades';

  const handleDownloadReportCardPdf = (overrideScope?: 'current' | 'all') => {
    if (!activeStudent || downloadingReportPdf) return;
    setDownloadingReportPdf(true);
    setReportDownloadError(null);
    setReportDownloadMessage(null);
    try {
      const effectiveScope = overrideScope ?? reportCardScope;
      const result = generateStudentReportCardPdf({
        student: activeStudent,
        courses,
        submissions: mySubmissions,
        attendanceLogs,
        scopeCourseId: effectiveScope === 'current' ? currentCourse?.id : 'all',
      });
      setReportDownloadMessage(`Report card saved: ${result.fileName}`);
      window.setTimeout(() => {
        setReportDownloadMessage((prev) =>
          prev === `Report card saved: ${result.fileName}` ? null : prev
        );
      }, 5500);
    } catch (err: unknown) {
      setReportDownloadError(
        err instanceof Error ? err.message : 'Unable to generate PDF report card.'
      );
    } finally {
      setDownloadingReportPdf(false);
    }
  };

  if (profileHydrating) {
    return (
      <div
        data-portal-theme={portalTheme}
        aria-busy="true"
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0A1628] transition-colors duration-200 px-6"
      >
        <CircularProfileSeal
          name={`${activeStudent.firstName} ${activeStudent.lastName}`}
          avatarUrl={activeStudent.avatarUrl}
          gender={activeStudent.gender}
          theme={portalTheme}
        />
      </div>
    );
  }

  return (
    <div
      data-portal-theme={portalTheme}
      className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-[#071120] text-slate-900 dark:text-slate-100 transition-colors duration-200"
    >
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Real-time Student Viewer Banner */}
      {isViewerMode && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold">
                Student Portal Viewer Mode (Real-Time Inspection)
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Viewing Portal for:{' '}
                <strong className="text-amber-700 dark:text-amber-200">
                  {activeStudent.firstName} {activeStudent.lastName}
                </strong>{' '}
                ({activeStudent.email})
              </div>
            </div>
          </div>
          {onExitViewerMode && (
            <button
              type="button"
              onClick={onExitViewerMode}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit Viewer
            </button>
          )}
        </div>
      )}

      {/* Student Profile & Metrics Header */}
      <div className="rounded-3xl bg-white dark:bg-gradient-to-r dark:from-[#0F2942]/85 dark:via-[#0A192F]/90 dark:to-[#071120] border border-slate-200 dark:border-slate-800/90 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="relative rounded-full p-1.5 shadow-md shrink-0 hover:scale-105 transition-transform duration-300">
            <svg
              aria-hidden="true"
              viewBox="0 0 112 112"
              className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-slow"
            >
              <circle
                cx="56"
                cy="56"
                r="53"
                fill="none"
                stroke="#00F2FE"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              <circle
                cx="56"
                cy="56"
                r="53"
                fill="none"
                stroke="#00F2FE"
                strokeWidth="2.8"
                strokeDasharray="80 86"
                strokeLinecap="round"
              />
              <circle
                cx="56"
                cy="56"
                r="53"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.8"
                strokeDasharray="55 111"
                strokeDashoffset="110"
                strokeLinecap="round"
              />
            </svg>
            <div className="relative z-10 rounded-full p-0.5 bg-white dark:bg-[#0A192F]">
              <SymbolicAvatar
                gender={activeStudent.gender}
                avatarUrl={activeStudent.avatarUrl}
                name={`${activeStudent.firstName} ${activeStudent.lastName}`}
                size="2xl"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#0284C7] dark:text-[#00F2FE]">
              <span>ID: {activeStudent.id.substring(0, 12)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 capitalize">
                {activeStudent.gender} Account
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {activeStudent.firstName} {activeStudent.lastName}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {activeStudent.email}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {!isViewerMode && (
                <>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-200 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>
                      {avatarUploadProgress !== null
                        ? `Uploading ${avatarUploadProgress}%`
                        : activeStudent.avatarUrl
                        ? 'Update Profile Photo'
                        : 'Upload Profile Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfilePhotoUpload}
                      disabled={avatarUploadProgress !== null}
                      className="hidden"
                    />
                  </label>

                  {onOpenAccountSettings && (
                    <button
                      type="button"
                      onClick={() => onOpenAccountSettings('timezone')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Timezone &amp; Password</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={togglePortalTheme}
                aria-pressed={portalTheme === 'dark'}
                aria-label={`Switch to ${portalTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
                title={`Switch to ${portalTheme === 'dark' ? 'Light' : 'Dark'} Mode (synced across your devices)`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                {portalTheme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>

              {!isViewerMode && avatarUploadError && (
                <span className="text-[11px] text-rose-500 dark:text-rose-400">
                  {avatarUploadError}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 shrink-0">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Completed Lectures
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-[#0284C7] dark:text-[#00F2FE] mt-1 tabular-nums">
              {completedLecturesCount} / {totalLecturesCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {Math.round((completedLecturesCount / totalLecturesCount) * 100)}% Curriculum
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Attendance Rate
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-[#10B981] mt-1 tabular-nums">
              {attendancePercent}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Automated Join Logs</div>
          </div>

          <button
            type="button"
            onClick={() => setActiveSubTab('grades')}
            className="text-left p-3 sm:p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-[#00F2FE]/40 transition-colors col-span-2 sm:col-span-1"
          >
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Academic Standing
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-1 tabular-nums">
              {standingLabel}
            </div>
            <div className="text-[10px] text-sky-700 dark:text-[#00F2FE] mt-0.5 font-medium">
              {standingSublabel} · View Report Card →
            </div>
          </button>
        </div>
      </div>

      {/* Dedicated Student Dashboard: My Enrolled Courses Showcase */}
      <section
        aria-labelledby="my-enrolled-courses-heading"
        className="rounded-3xl bg-white dark:bg-[#0A192F]/90 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              id="my-enrolled-courses-heading"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <GraduationCap className="w-5 h-5 text-[#0284C7] dark:text-[#00F2FE]" />
              <span>My Enrolled Courses</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {enrolledCourses.length} Enrolled {enrolledCourses.length === 1 ? 'Course' : 'Courses'} · Tuition Fee $0.00 (Free Scholarship)
            </p>
          </div>

          {onBrowseCourses && !isViewerMode && (
            <button
              type="button"
              onClick={onBrowseCourses}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0284C7] dark:text-[#00F2FE] bg-sky-50 hover:bg-sky-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-sky-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Browse Course Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {enrolledCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledCourses.map((c) => {
              const isSelected = c.id === currentCourse?.id;
              const courseSubmittedCount = mySubmissions.filter(
                (s) => s.courseId === c.id
              ).length;
              const totalTasks = c.assignments.length;
              return (
                <div
                  key={`enrolled-card-${c.id}`}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                    isSelected
                      ? 'bg-sky-50/70 dark:bg-[#0F2942]/80 border-[#0284C7] dark:border-[#00F2FE]/60 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#071120] border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="font-bold text-[#0284C7] dark:text-[#00F2FE] truncate">
                        {c.code} · {c.level}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        Enrolled · $0
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {c.title}
                    </h4>

                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Instructor: {c.instructorName}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{c.durationLabel || '12 Weeks'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.videoArchives.length} Recordings</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {totalTasks > 0
                          ? `${courseSubmittedCount}/${totalTasks} Tasks`
                          : `${c.modules.length} Modules`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setManualCoursePick(true);
                        setSelectedCourseId(c.id);
                        setActiveSubTab('overview');
                        const el = document.getElementById('student-course-workspace');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#0284C7] dark:bg-[#00F2FE] text-white dark:text-slate-950'
                          : 'bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 hover:brightness-110'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'Workspace Active' : 'Open Course'}</span>
                    </button>

                    {onOpenCoursePage && (
                      <button
                        type="button"
                        onClick={() => onOpenCoursePage(c)}
                        className="py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              You have not enrolled in any cohort yet
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Every course at Deen Hijrah Academia carries $0.00 tuition. Complete a quick free enrollment to see your active courses, live sessions, and recordings right here.
            </p>
            {onBrowseCourses && !isViewerMode && (
              <button
                type="button"
                onClick={onBrowseCourses}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md whitespace-nowrap"
              >
                <span>Explore Free Courses &amp; Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Upcoming Live Classes & Scheduled Events Directory (Class Name + Instructor Name + Join Meeting) */}
      {liveClassFeed.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-[#0A192F]/90 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Upcoming Live Classes &amp; Classroom Links</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All class timings convert to your active timezone ({activeTimezoneLabel}). Clicking Join Meeting logs attendance &amp; opens the sanctuary.
              </p>
            </div>
            {onOpenAccountSettings && !isViewerMode && (
              <button
                type="button"
                onClick={() => onOpenAccountSettings('timezone')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Save Timezone</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveClassFeed.map((item) => {
              const localInfo = formatToLocalTime(item.timeUtc, item.dayOfWeek);
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-[#00F2FE] font-bold">
                        {item.courseCode || 'LIVE CLASS'}
                      </span>
                      {item.isLiveNow && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                          <Radio className="w-3 h-3 animate-pulse" />
                          LIVE NOW
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Instructor: {item.instructorName}
                    </p>

                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                      {item.dateStr ? `${item.dateStr} · ` : ''}
                      {localInfo.localDayStr} · {localInfo.localTimeStr}
                    </div>

                    <div className="text-[10px] font-mono text-slate-400">
                      Room ID: {item.meetingId}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.eventObj && onJoinEventMeeting) {
                        onJoinEventMeeting(item.eventObj);
                      } else if (item.courseId && item.scheduleId) {
                        onJoinClassWithAttendance(item.courseId, item.scheduleId);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Meeting</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Assignments · Time Remaining Countdown Dashboard Panel */}
      {activeAssignmentFeed.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-[#0A192F]/90 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Active Assignments · Time Remaining</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live countdowns in your active timezone ({activeTimezoneLabel}). Progress bars shift from emerald to amber and rose as deadlines approach.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {activeAssignmentFeed.length} Active {activeAssignmentFeed.length === 1 ? 'Deadline' : 'Deadlines'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAssignmentFeed.slice(0, 6).map(({ course, assignment }) => {
              const due = formatToLocalTime(assignment.dueDateUtc);
              const isQuizOrExam =
                assignment.type === 'pop_quiz' || assignment.type === 'exam';
              const typeText =
                assignment.type === 'pop_quiz'
                  ? 'Animated Quiz'
                  : assignment.type === 'exam'
                  ? 'Timed Exam'
                  : assignment.type.replace('_', ' ');

              return (
                <div
                  key={`dash-ass-${course.id}-${assignment.id}`}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="text-sky-700 dark:text-[#00F2FE] font-bold truncate">
                        {course.code} · <span className="capitalize">{typeText}</span>
                      </span>
                      <span className="tabular-nums shrink-0">{assignment.points} pts</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {assignment.title}
                    </h4>

                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Due: {due.localTimeStr} ({due.localDayStr})
                    </div>

                    <AssignmentDeadlineCountdown
                      assignedDateUtc={assignment.assignedDateUtc}
                      dueDateUtc={assignment.dueDateUtc}
                      nowMs={nowMs}
                      compact
                    />
                  </div>

                  {!isViewerMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setActiveSubTab('assessments');
                        if (isQuizOrExam) {
                          handleStartQuiz(assignment);
                        } else {
                          setSubmittingAssessment(assignment);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      {isQuizOrExam ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                          <span>{assignment.type === 'exam' ? 'Start Exam' : 'Take Quiz'}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                          <span>Submit Work</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course Selector Boxes */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {courses.map((c) => {
            const isEnrolled = c.enrolledStudentIds.includes(activeStudent.id);
            const isSelected = c.id === currentCourse?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setManualCoursePick(true);
                  setSelectedCourseId(c.id);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-[#00F2FE]/20 text-sky-700 dark:text-[#00F2FE] border-sky-500 dark:border-[#00F2FE]/60 shadow-sm'
                    : 'bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>
                  {c.code} · {c.title}
                </span>
                {isEnrolled && (
                  <span className="ml-1.5 text-[10px] text-emerald-600 dark:text-[#10B981]">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {currentCourse ? (
        <div
          id="student-course-workspace"
          className="rounded-3xl bg-white dark:bg-[#0A192F]/90 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
        >
          {/* Sub Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-6 overflow-x-auto">
            {[
              { key: 'overview', label: 'Subject Overview', icon: BookOpen },
              {
                key: 'lectures',
                label: `Video Archive (${currentCourse.videoArchives.length})`,
                icon: Video,
              },
              {
                key: 'assessments',
                label: `Assessments (${currentCourse.assignments.length})`,
                icon: Award,
              },
              {
                key: 'grades',
                label: 'Grades & Report Card',
                icon: GraduationCap,
              },
              { key: 'attendance', label: 'Attendance Tracker', icon: Clock },
              {
                key: 'materials',
                label: `Readings & PDFs (${
                  currentCourse.materials.length +
                  currentCourse.videoArchives.filter((v) => v.supplementaryPdfUrl).length
                })`,
                icon: FileText,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSubTab(tab.key as any)}
                  className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#0284C7] dark:border-[#00F2FE] text-[#0284C7] dark:text-[#00F2FE]'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sub Tab Content */}
          <div className="p-6">
            {/* 1. OVERVIEW & LIVE CLASS JOIN */}
            {activeSubTab === 'overview' && (
              <div className="space-y-6">
                {currentCourse.schedules.length > 0 && (
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-gradient-to-r dark:from-[#0F2942] dark:to-[#0A192F] border border-sky-200 dark:border-[#00F2FE]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        Live Course Session
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {currentCourse.schedules[0].title}
                      </h4>
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Instructor:{' '}
                        {currentCourse.schedules[0].instructorName || currentCourse.instructorName}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                        {
                          formatToLocalTime(
                            currentCourse.schedules[0].timeUtc,
                            currentCourse.schedules[0].dayOfWeek
                          ).localTimeStr
                        }{' '}
                        (
                        {
                          formatToLocalTime(
                            currentCourse.schedules[0].timeUtc,
                            currentCourse.schedules[0].dayOfWeek
                          ).localDayStr
                        }
                        ) · {currentCourse.schedules[0].durationMinutes} mins
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onJoinClassWithAttendance(currentCourse.id, currentCourse.schedules[0].id)
                      }
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
                    >
                      <Video className="w-4 h-4" />
                      Join Meeting
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Course Modules &amp; Post-Module Assessments
                    </h4>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {completedModuleIds.length} / {currentCourse.modules.length} Modules Completed
                    </span>
                  </div>

                  {activeQuiz && !isViewerMode && (
                    <div className="mb-4">
                      <ModuleQuizRunner
                        courseId={currentCourse.id}
                        courseCode={currentCourse.code}
                        courseTitle={currentCourse.title}
                        assessment={activeQuiz}
                        studentId={activeStudent.id}
                        studentName={`${activeStudent.firstName} ${activeStudent.lastName}`.trim()}
                        existingSubmission={mySubmissions.find(
                          (s) => s.assessmentId === activeQuiz.id && s.courseId === currentCourse.id
                        )}
                        onSubmitted={(sub) => {
                          setMySubmissions((prev) => [
                            sub,
                            ...prev.filter((existing) => existing.id !== sub.id),
                          ]);
                        }}
                        onClose={() => setActiveQuiz(null)}
                        onViewTranscript={() => {
                          setActiveQuiz(null);
                          setActiveSubTab('grades');
                        }}
                        onRefreshData={onRefreshData}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {currentCourse.modules.map((m, idx) => {
                      const moduleQuiz = findQuizForModule(currentCourse, m, idx);
                      const moduleSub = mySubmissions.find(
                        (s) => s.courseId === currentCourse.id && s.assessmentId === moduleQuiz.id
                      );
                      const isCompleted =
                        completedModuleIds.includes(m.id) || Boolean(moduleSub);

                      const toggleComplete = () => {
                        if (isViewerMode) return;
                        const next = isCompleted
                          ? completedModuleIds.filter((id) => id !== m.id)
                          : [...completedModuleIds, m.id];
                        setCompletedModuleIds(
                          saveCompletedModuleIds(activeStudent.id, currentCourse.id, next)
                        );
                      };

                      const launchQuiz = () => {
                        if (!isCompleted && !isViewerMode) {
                          const next = [...completedModuleIds, m.id];
                          setCompletedModuleIds(
                            saveCompletedModuleIds(activeStudent.id, currentCourse.id, next)
                          );
                        }
                        handleStartQuiz(moduleQuiz);
                      };

                      return (
                        <div
                          key={m.id}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE]">
                                <span>
                                  Module {idx + 1} · {m.lecturesCount} Lectures
                                </span>
                                {isCompleted && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    · Completed
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                {m.title}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                {m.description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                              <span>{moduleQuiz.title}</span>
                              {moduleSub && (
                                <span className="ml-2 font-bold text-emerald-700 dark:text-emerald-400">
                                  · Recorded: {moduleSub.grade ?? moduleSub.quizScore ?? 0}/
                                  {moduleSub.maxPoints}
                                </span>
                              )}
                            </div>

                            {!isViewerMode && (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={toggleComplete}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                                    isCompleted
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={launchQuiz}
                                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>
                                    {moduleSub
                                      ? 'View Result / Retake'
                                      : isCompleted
                                      ? 'Take Module Quiz'
                                      : 'Complete & Take Quiz'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. VIDEO ARCHIVE (SourceCode Academy 2-Zone Workspace + Strict Lock) */}
            {activeSubTab === 'lectures' && (
              <CourseRecordingsWorkspace
                course={currentCourse}
                isEnrolled={isEnrolledInCurrent}
                isAdmin={currentUser?.role === 'admin'}
                isStaff={isStaff}
                viewerEmail={activeStudent.email}
                customLogoUrl={customLogoUrl}
                onEnroll={() => {
                  if (onEnroll) void onEnroll(currentCourse.id);
                }}
              />
            )}

            {/* 3. ASSESSMENTS ENGINE (File/Link Upload, Animated Quiz, Timed Exam & Grades) */}
            {activeSubTab === 'assessments' && (
              <div className="space-y-6">
                {/* Quick Coursework Upload & Report Card Header */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Assignments &amp; Instructor Review Submissions
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Upload assignment files (PDF, Word, Slides, Images, ZIP) or download your PDF Report Card with grades and instructor comments.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={downloadingReportPdf}
                      onClick={() => handleDownloadReportCardPdf('all')}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      {downloadingReportPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0284C7] dark:text-[#00F2FE]" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                      )}
                      <span>Download Report Card PDF</span>
                    </button>

                    {(isEnrolledInCurrent || isStaff) && !isViewerMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSubmittingAssessment({
                            id: 'general-coursework',
                            courseId: currentCourse.id,
                            title: 'Coursework / Practice Submission',
                            type: 'homework',
                            points: 100,
                            allowFileUpload: true,
                          })
                        }
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Submit Coursework File or Link</span>
                      </button>
                    ) : !isViewerMode ? (
                      <button
                        type="button"
                        onClick={() => onEnroll && void onEnroll(currentCourse.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 whitespace-nowrap shrink-0"
                      >
                        Enroll Free to Submit
                      </button>
                    ) : null}
                  </div>
                </div>

                {(reportDownloadMessage || reportDownloadError) && (
                  <div
                    className={`px-4 py-2.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                      reportDownloadError
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <span>{reportDownloadError || reportDownloadMessage}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReportDownloadError(null);
                        setReportDownloadMessage(null);
                      }}
                      className="text-[11px] font-semibold underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Unified Auto-Graded Quiz / Timed Exam Runner */}
                {activeQuiz && !isViewerMode && (
                  <ModuleQuizRunner
                    courseId={currentCourse.id}
                    courseCode={currentCourse.code}
                    courseTitle={currentCourse.title}
                    assessment={activeQuiz}
                    studentId={activeStudent.id}
                    studentName={`${activeStudent.firstName} ${activeStudent.lastName}`.trim()}
                    existingSubmission={mySubmissions.find(
                      (s) => s.assessmentId === activeQuiz.id && s.courseId === currentCourse.id
                    )}
                    onSubmitted={(sub) => {
                      setMySubmissions((prev) => [
                        sub,
                        ...prev.filter((existing) => existing.id !== sub.id),
                      ]);
                    }}
                    onClose={() => setActiveQuiz(null)}
                    onViewTranscript={() => {
                      setActiveQuiz(null);
                      setActiveSubTab('grades');
                    }}
                    onRefreshData={onRefreshData}
                  />
                )}

                {/* Homework / Assignment Submitter with File Upload + External Link */}
                {submittingAssessment && !isViewerMode && (
                  <AssignmentSubmissionBox
                    courseId={submittingAssessment.courseId || currentCourse.id}
                    assessment={submittingAssessment}
                    studentId={activeStudent.id}
                    studentName={`${activeStudent.firstName} ${activeStudent.lastName}`.trim()}
                    onSubmitted={(sub) => {
                      setMySubmissions((prev) => [
                        sub,
                        ...prev.filter((existing) => existing.id !== sub.id),
                      ]);
                    }}
                    onCancel={() => setSubmittingAssessment(null)}
                    onRefreshData={onRefreshData}
                  />
                )}

                {/* Assessments List */}
                <div className="space-y-3">
                  {currentCourse.assignments.map((ass) => {
                    const isQuizOrExamWithMcq =
                      ass.type === 'pop_quiz' || ass.type === 'exam';
                    const dueDate = formatToLocalTime(ass.dueDateUtc);
                    const latestSub = mySubmissions.find((s) => s.assessmentId === ass.id);
                    const isExternalSubmissionUrl = Boolean(
                      latestSub?.fileUrl &&
                        /^https?:\/\//i.test(latestSub.fileUrl) &&
                        !latestSub.fileUrl.includes('/api/docs/')
                    );

                    return (
                      <div
                        key={ass.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-[#00F2FE] font-bold">
                              {ass.type === 'pop_quiz'
                                ? 'Animated Quiz'
                                : ass.type === 'exam'
                                ? 'Timed Exam'
                                : ass.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              {ass.points} Points
                            </span>
                            {ass.durationMinutes && (
                              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-300">
                                · {ass.durationMinutes} min timer
                              </span>
                            )}
                            {latestSub && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                {latestSub.status === 'graded'
                                  ? `Graded: ${latestSub.grade ?? latestSub.quizScore ?? 0}/${latestSub.maxPoints}`
                                  : 'Submitted'}
                              </span>
                            )}
                          </div>

                          <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                            {ass.title}
                          </h5>
                          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                            {ass.description}
                          </p>

                          <div className="text-[11px] text-slate-500 font-mono">
                            Due: {dueDate.localTimeStr} ({dueDate.localDayStr}) ·{' '}
                            {dueDate.timezoneLabel}
                          </div>

                          <div className="pt-1 max-w-md">
                            <AssignmentDeadlineCountdown
                              assignedDateUtc={ass.assignedDateUtc}
                              dueDateUtc={ass.dueDateUtc}
                              nowMs={nowMs}
                              submittedStatus={latestSub?.status}
                              compact
                            />
                          </div>

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
                                download={
                                  !isExternalSubmissionUrl ? latestSub.fileName || true : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                              >
                                {isExternalSubmissionUrl ? (
                                  <ExternalLink className="w-3 h-3" />
                                ) : (
                                  <FileDown className="w-3 h-3" />
                                )}
                                <span>
                                  Submitted: {latestSub.fileName || latestSub.fileUrl}
                                </span>
                              </a>
                            </div>
                          )}

                          {latestSub?.feedback && (
                            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 mt-1 line-clamp-2">
                              <strong>Instructor Feedback:</strong> {latestSub.feedback}
                            </div>
                          )}

                          {ass.attachments && ass.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {ass.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={`${att.url}${
                                    att.url.includes('?') ? '&' : '?'
                                  }download=1`}
                                  download={att.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-sky-700 dark:text-[#00F2FE]"
                                >
                                  <FileDown className="w-3 h-3" />
                                  <span>{att.name}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          {ass.projectMilestones && ass.projectMilestones.length > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Milestones:{' '}
                              </span>
                              {ass.projectMilestones.join(' → ')}
                            </div>
                          )}
                        </div>

                        {/* Submission & Feedback Actions */}
                        <div className="shrink-0 flex flex-wrap items-center gap-2">
                          {latestSub && (
                            <button
                              type="button"
                              onClick={() =>
                                setFeedbackModalEntry({
                                  assessmentTitle: ass.title,
                                  assessmentType:
                                    ass.type === 'pop_quiz'
                                      ? 'Animated Quiz'
                                      : ass.type === 'exam'
                                      ? 'Timed Exam'
                                      : ass.type.replace('_', ' '),
                                  courseCode: currentCourse.code,
                                  courseTitle: currentCourse.title,
                                  dueDateUtc: ass.dueDateUtc,
                                  submission: latestSub,
                                })
                              }
                              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <MessageSquareText className="w-3.5 h-3.5" />
                              <span>Instructor Feedback</span>
                            </button>
                          )}

                          {!isViewerMode && (
                            <>
                              {isQuizOrExamWithMcq && (
                                <button
                                  type="button"
                                  onClick={() => handleStartQuiz(ass)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-sm whitespace-nowrap inline-flex items-center gap-1.5"
                                >
                                  {ass.type === 'exam' ? (
                                    <GraduationCap className="w-3.5 h-3.5" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {ass.type === 'exam' ? 'Start Timed Exam' : 'Launch Animated Quiz'}
                                  </span>
                                </button>
                              )}
                              {(!isQuizOrExamWithMcq ||
                                (ass.type === 'exam' && ass.allowFileUpload !== false)) && (
                                <button
                                  type="button"
                                  onClick={() => setSubmittingAssessment(ass)}
                                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>
                                    {latestSub ? 'Resubmit File / Link' : 'Submit File / Link'}
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {currentCourse.assignments.length === 0 && (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-3">
                      <p>
                        No formal homework, quizzes, or exams scheduled yet — use &quot;Submit Coursework File or Link&quot; above anytime to send work for instructor review.
                      </p>
                    </div>
                  )}
                </div>

                {/* General Coursework Submissions History */}
                {mySubmissions.some(
                  (s) => s.courseId === currentCourse.id && s.assessmentId === 'general-coursework'
                ) && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Coursework File &amp; Link Submissions</span>
                    </div>
                    {mySubmissions
                      .filter(
                        (s) =>
                          s.courseId === currentCourse.id && s.assessmentId === 'general-coursework'
                      )
                      .map((sub) => {
                        const isExternalUrl = Boolean(
                          sub.fileUrl &&
                            /^https?:\/\//i.test(sub.fileUrl) &&
                            !sub.fileUrl.includes('/api/docs/')
                        );
                        return (
                          <div
                            key={sub.id}
                            className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  Coursework / Practice Submission
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
                                    : 'Pending Review'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Submitted {new Date(sub.submittedAt).toLocaleString()}
                              </div>
                              {sub.content && (
                                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                  {sub.content}
                                </p>
                              )}
                              {sub.feedback && (
                                <div className="text-emerald-700 dark:text-emerald-300">
                                  <strong>Instructor Feedback:</strong> {sub.feedback}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setFeedbackModalEntry({
                                    assessmentTitle: 'Coursework / Practice Submission',
                                    assessmentType: 'Coursework Submission',
                                    courseCode: currentCourse.code,
                                    courseTitle: currentCourse.title,
                                    submission: sub,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap transition-colors"
                              >
                                <MessageSquareText className="w-3.5 h-3.5" />
                                <span>Instructor Feedback</span>
                              </button>

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
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-700 text-sky-700 dark:text-[#00F2FE] font-semibold whitespace-nowrap shrink-0"
                                >
                                  {isExternalUrl ? (
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  ) : (
                                    <FileDown className="w-3.5 h-3.5" />
                                  )}
                                  <span>{sub.fileName || 'Open Submission'}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* 3B. GRADES & REPORT CARD VIEW */}
            {activeSubTab === 'grades' &&
              (() => {
                const scopedCourses =
                  reportCardScope === 'current'
                    ? [currentCourse]
                    : (() => {
                        const enrolled = courses.filter((c) =>
                          c.enrolledStudentIds.includes(activeStudent.id)
                        );
                        const withSubs = courses.filter((c) =>
                          mySubmissions.some((s) => s.courseId === c.id)
                        );
                        const merged = [...enrolled];
                        withSubs.forEach((c) => {
                          if (!merged.some((m) => m.id === c.id)) merged.push(c);
                        });
                        return merged.length > 0 ? merged : [currentCourse];
                      })();

                const gradeEntries = scopedCourses.flatMap((course) => {
                  const courseSubs = mySubmissions.filter((s) => s.courseId === course.id);
                  const formalRows = (course.assignments || []).map((ass) => {
                    const latestSub = courseSubs
                      .filter((s) => s.assessmentId === ass.id)
                      .sort(
                        (a, b) =>
                          new Date(b.submittedAt).getTime() -
                          new Date(a.submittedAt).getTime()
                      )[0];
                    return {
                      key: `${course.id}:${ass.id}`,
                      course,
                      assessmentId: ass.id,
                      title: ass.title,
                      typeLabel:
                        ass.type === 'pop_quiz'
                          ? 'Animated Quiz'
                          : ass.type === 'exam'
                          ? 'Timed Exam'
                          : ass.type.replace(/_/g, ' '),
                      maxPoints: latestSub?.maxPoints || ass.points || 100,
                      dueDateUtc: ass.dueDateUtc,
                      submission: latestSub,
                    };
                  });

                  const formalIds = new Set((course.assignments || []).map((a) => a.id));
                  const courseworkRows = courseSubs
                    .filter(
                      (s) =>
                        s.assessmentId === 'general-coursework' ||
                        !formalIds.has(s.assessmentId)
                    )
                    .sort(
                      (a, b) =>
                        new Date(b.submittedAt).getTime() -
                        new Date(a.submittedAt).getTime()
                    )
                    .map((sub, idx) => ({
                      key: `${course.id}:sub:${sub.id}`,
                      course,
                      assessmentId: sub.assessmentId,
                      title:
                        sub.assessmentId === 'general-coursework'
                          ? `Coursework Submission${idx > 0 ? ` #${idx + 1}` : ''}`
                          : resolveAssessmentTitle(course, sub.assessmentId),
                      typeLabel: (sub.type || 'homework').replace(/_/g, ' '),
                      maxPoints: sub.maxPoints || 100,
                      dueDateUtc: undefined,
                      submission: sub,
                    }));

                  return [...formalRows, ...courseworkRows];
                });

                const gradedEntries = gradeEntries.filter(
                  (e) =>
                    e.submission?.status === 'graded' &&
                    typeof (e.submission.grade ?? e.submission.quizScore) === 'number'
                );
                const submittedCount = gradeEntries.filter((e) => Boolean(e.submission)).length;
                const totalEarnedPts = gradedEntries.reduce(
                  (sum, e) => sum + (e.submission?.grade ?? e.submission?.quizScore ?? 0),
                  0
                );
                const totalMaxPts = gradedEntries.reduce(
                  (sum, e) => sum + Math.max(1, e.maxPoints),
                  0
                );
                const avgPercent =
                  totalMaxPts > 0 ? Math.round((totalEarnedPts / totalMaxPts) * 100) : null;

                return (
                  <div className="space-y-6">
                    {/* Grading Overview & Report Card Export Bar */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          Academic Report Card &amp; Grading Summary
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          <span>
                            Average:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {avgPercent !== null
                                ? `${getLetterGrade(avgPercent)} (${avgPercent}%)`
                                : 'Pending'}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Graded: <strong className="text-slate-800 dark:text-slate-200">{gradedEntries.length}</strong> / {submittedCount} submitted
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Timezone: {activeTimezoneLabel}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div
                          className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                          role="group"
                          aria-label="Report card course scope"
                        >
                          <button
                            type="button"
                            onClick={() => setReportCardScope('current')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              reportCardScope === 'current'
                                ? 'bg-slate-900 text-white dark:bg-[#00F2FE]/20 dark:text-[#00F2FE]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Current Course
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportCardScope('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              reportCardScope === 'all'
                                ? 'bg-slate-900 text-white dark:bg-[#00F2FE]/20 dark:text-[#00F2FE]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            All Enrolled Courses
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={downloadingReportPdf}
                          onClick={() => handleDownloadReportCardPdf()}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          {downloadingReportPdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5" />
                          )}
                          <span>Download Report Card PDF</span>
                        </button>
                      </div>
                    </div>

                    {(reportDownloadMessage || reportDownloadError) && (
                      <div
                        className={`px-4 py-2.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                          reportDownloadError
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{reportDownloadError || reportDownloadMessage}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReportDownloadError(null);
                            setReportDownloadMessage(null);
                          }}
                          className="text-[11px] font-semibold underline shrink-0"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* Gradebook Rows */}
                    {gradeEntries.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
                        <GraduationCap className="w-8 h-8 text-slate-400 mx-auto" />
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          No Assignments or Submissions Yet
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          Once coursework, quizzes, or exams are submitted or assigned, your scores and instructor remarks will appear here and in your downloadable PDF report card.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950/60">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                <th className="py-3 px-4">Course &amp; Assessment</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Score</th>
                                <th className="py-3 px-4">Instructor Feedback</th>
                                <th className="py-3 px-4 text-right">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
                              {gradeEntries.map((entry) => {
                                const sub = entry.submission;
                                const rawScore = sub ? sub.grade ?? sub.quizScore : undefined;
                                const hasScore = typeof rawScore === 'number';
                                const pct =
                                  hasScore && entry.maxPoints > 0
                                    ? Math.round((rawScore / entry.maxPoints) * 100)
                                    : null;
                                const dateLabel = sub
                                  ? (() => {
                                      const t = formatToLocalTime(sub.submittedAt);
                                      return `Submitted ${t.localDayStr} · ${t.localTimeStr}`;
                                    })()
                                  : entry.dueDateUtc
                                  ? (() => {
                                      const t = formatToLocalTime(entry.dueDateUtc);
                                      return `Due ${t.localDayStr} · ${t.localTimeStr}`;
                                    })()
                                  : 'Coursework';

                                return (
                                  <tr
                                    key={entry.key}
                                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors align-top"
                                  >
                                    <td className="py-3.5 px-4 min-w-[210px]">
                                      <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE]">
                                        {entry.course.code} ·{' '}
                                        <span className="capitalize">{entry.typeLabel}</span>
                                      </div>
                                      <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                                        {entry.title}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                        {dateLabel}
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      {sub?.status === 'graded' ? (
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                          <span>Graded</span>
                                        </span>
                                      ) : sub ? (
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                                          <Clock className="w-3.5 h-3.5 shrink-0" />
                                          <span>Awaiting Review</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 dark:text-slate-400">
                                          Not Submitted
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                                      {hasScore ? (
                                        <div>
                                          <div className="font-bold text-slate-900 dark:text-white">
                                            {rawScore} / {entry.maxPoints}
                                          </div>
                                          {pct !== null && (
                                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                              {pct}%
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500">
                                          — / {entry.maxPoints}
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 max-w-xs">
                                      {sub?.feedback && sub.feedback.trim() ? (
                                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                          {sub.feedback}
                                        </p>
                                      ) : sub ? (
                                        <span className="text-slate-400 dark:text-slate-500">
                                          No comments added yet
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500">
                                          —
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                      {sub ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setFeedbackModalEntry({
                                              assessmentTitle: entry.title,
                                              assessmentType: entry.typeLabel,
                                              courseCode: entry.course.code,
                                              courseTitle: entry.course.title,
                                              dueDateUtc: entry.dueDateUtc,
                                              submission: sub,
                                            })
                                          }
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                                        >
                                          <MessageSquareText className="w-3.5 h-3.5" />
                                          <span>Feedback</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setActiveSubTab('assessments')}
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 whitespace-nowrap transition-colors"
                                        >
                                          Go to Submit
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* 4. ATTENDANCE TRACKER */}
            {activeSubTab === 'attendance' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Automated Classroom Attendance
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      System records your User ID, Timestamp, and local timezone when you click &quot;Join Meeting&quot;.
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-emerald-600 dark:text-[#10B981] tabular-nums">
                      {attendancePercent}%
                    </div>
                    <div className="text-[10px] text-slate-500">Verified Presence</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-900 dark:text-white mb-2">
                    Recent Attendance Logs
                  </h5>
                  {attendanceLoading ? (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-slate-500 font-mono">
                      Loading verified attendance logs...
                    </div>
                  ) : courseAttendanceLogs.length > 0 ? (
                    courseAttendanceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-slate-800 dark:text-slate-200">
                            {log.timezoneDetected || 'Global Session'}
                          </span>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {log.status} (Automated)
                        </span>
                        <span className="text-slate-500">
                          {new Date(log.timestamp).toLocaleDateString()} ·{' '}
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-slate-500">
                      No attendance logs recorded for this course yet. Click &quot;Join Meeting&quot; on any class to log your attendance automatically.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. MATERIALS & LECTURE SUPPLEMENTARY PDFs */}
            {activeSubTab === 'materials' && (
              <div className="space-y-4">
                {currentCourse.videoArchives.some((rec) => rec.supplementaryPdfUrl) && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider font-mono text-[#0284C7] dark:text-[#00F2FE]">
                      Lecture Supplementary Materials (PDF)
                    </div>
                    {currentCourse.videoArchives
                      .filter((rec) => rec.supplementaryPdfUrl)
                      .map((rec) => (
                        <div
                          key={`spdf-${rec.id}`}
                          className="p-3.5 rounded-2xl bg-sky-50 dark:bg-slate-900/90 border border-sky-200 dark:border-[#00F2FE]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {rec.supplementaryPdfName ||
                                  `${rec.title} — Supplementary PDF`}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Attached to Lecture: {rec.title}
                              </div>
                            </div>
                          </div>

                          {isEnrolledInCurrent || isStaff ? (
                            <a
                              href={`${rec.supplementaryPdfUrl}${
                                rec.supplementaryPdfUrl!.includes('?') ? '&' : '?'
                              }download=1`}
                              download={
                                rec.supplementaryPdfName || 'supplementary-materials.pdf'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              Download Supplementary PDF
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEnroll && void onEnroll(currentCourse.id)}
                              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-300 font-semibold text-xs whitespace-nowrap"
                            >
                              Enroll Free to Download
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {currentCourse.materials.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                      Curriculum Reading Files
                    </div>
                    {currentCourse.materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {mat.title}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {mat.fileType.toUpperCase()} · {mat.size}
                            </div>
                          </div>
                        </div>
                        <a
                          href={
                            !mat.fileUrl || mat.fileUrl.startsWith('#')
                              ? `/api/courses/${encodeURIComponent(
                                  currentCourse.id
                                )}/materials/${encodeURIComponent(mat.id)}/download`
                              : mat.fileUrl
                          }
                          download
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Instructor Feedback Modal */}
      {feedbackModalEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="instructor-feedback-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFeedbackModalEntry(null);
          }}
        >
          {(() => {
            const { submission } = feedbackModalEntry;
            const numericScore = submission.grade ?? submission.quizScore;
            const hasScore = typeof numericScore === 'number';
            const percent =
              hasScore && submission.maxPoints > 0
                ? Math.round((numericScore / submission.maxPoints) * 100)
                : null;
            const submittedLocal = formatToLocalTime(submission.submittedAt);
            const isExternalSubUrl = Boolean(
              submission.fileUrl &&
                /^https?:\/\//i.test(submission.fileUrl) &&
                !submission.fileUrl.includes('/api/docs/')
            );

            return (
              <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0B1C34] border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden my-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-[#0284C7] dark:text-[#00F2FE] flex flex-wrap items-center gap-2">
                      {feedbackModalEntry.courseCode && <span>{feedbackModalEntry.courseCode}</span>}
                      {feedbackModalEntry.courseCode && <span aria-hidden="true">·</span>}
                      <span className="capitalize">{feedbackModalEntry.assessmentType}</span>
                    </div>
                    <h3
                      id="instructor-feedback-modal-title"
                      className="text-lg font-bold text-slate-900 dark:text-white mt-1 leading-snug"
                    >
                      {feedbackModalEntry.assessmentTitle}
                    </h3>
                    {feedbackModalEntry.courseTitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {feedbackModalEntry.courseTitle}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackModalEntry(null)}
                    aria-label="Close instructor feedback"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Score & Status Bento Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Grade &amp; Score
                      </div>
                      <div className="text-xl font-bold font-mono text-[#0284C7] dark:text-[#00F2FE] mt-1 tabular-nums">
                        {hasScore ? `${numericScore} / ${submission.maxPoints}` : 'Pending'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {percent !== null
                          ? `${percent}% Achieved`
                          : `Out of ${submission.maxPoints} pts`}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Evaluation Status
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        {submission.status === 'graded' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Graded</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Awaiting Review</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {submission.status === 'graded'
                          ? 'Reviewed by Instructor'
                          : 'Queued for instructor grading'}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Submitted On
                      </div>
                      <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                        {submittedLocal.localTimeStr}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {submittedLocal.localDayStr} · {submittedLocal.timezoneLabel}
                      </div>
                    </div>
                  </div>

                  {/* Instructor Written Comments */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquareText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Instructor Comments</span>
                    </div>
                    {submission.feedback && submission.feedback.trim() ? (
                      <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {submission.feedback}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        Your submission has been recorded. Your instructor has not added written feedback comments yet.
                      </div>
                    )}
                  </div>

                  {/* Student Submission Snapshot */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Your Submitted Work
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                      {submission.content && (
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {submission.content}
                        </p>
                      )}

                      {submission.quizAnswers && submission.quizAnswers.length > 0 && (
                        <div className="text-slate-600 dark:text-slate-300 font-mono">
                          Responses recorded for {submission.quizAnswers.length} question
                          {submission.quizAnswers.length === 1 ? '' : 's'}.
                        </div>
                      )}

                      {submission.fileUrl && (
                        <div>
                          <a
                            href={
                              isExternalSubUrl
                                ? submission.fileUrl
                                : `${submission.fileUrl}${
                                    submission.fileUrl.includes('?') ? '&' : '?'
                                  }download=1`
                            }
                            download={!isExternalSubUrl ? submission.fileName || true : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-[#00F2FE] font-semibold hover:border-sky-400 transition-colors"
                          >
                            {isExternalSubUrl ? (
                              <ExternalLink className="w-3.5 h-3.5" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span>{submission.fileName || submission.fileUrl}</span>
                          </a>
                        </div>
                      )}

                      {!submission.content &&
                        !submission.fileUrl &&
                        (!submission.quizAnswers || submission.quizAnswers.length === 0) && (
                          <span className="text-slate-500 dark:text-slate-400">
                            Submitted for assessment #{submission.assessmentId}.
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                  <button
                    type="button"
                    disabled={downloadingReportPdf}
                    onClick={() => handleDownloadReportCardPdf('all')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    <FileDown className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Download Report Card PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackModalEntry(null)}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all whitespace-nowrap"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      </div>
    </div>
  );
};
