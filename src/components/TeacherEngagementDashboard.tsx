import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import type {
  AcademicAssessment,
  AttendanceRecord,
  Course,
  StudentSubmission,
  User,
} from '../types';
import { getAuthHeaders } from '../services/firebaseService';
import { formatToLocalTime } from '../utils/timezone';
import { resolveAssessmentTitle } from '../utils/moduleQuizHelper';

interface TeacherEngagementDashboardProps {
  currentUser: User;
  courses: Course[];
  submissions: StudentSubmission[];
  loadingSubmissions: boolean;
  onRefreshSubmissions: () => Promise<void>;
  onReviewSubmissions: (courseId: string, status?: 'submitted' | 'all') => void;
  onSelectCourse?: (course: Course) => void;
  onOpenCreateCourse?: () => void;
  onOpenCreateAssessment?: (courseId: string) => void;
}

interface CourseEngagementMetrics {
  course: Course;
  enrolledCount: number;
  maxSpots: number;
  totalAssignments: number;
  activeAssignments: number;
  uniqueActiveSubmitters: number;
  expectedActiveSlots: number;
  activeSubmissionRatePct: number | null;
  totalSubmissionsCount: number;
  pendingReviewCount: number;
  gradedCount: number;
  avgScorePct: number | null;
  attendanceCount: number;
  lastSubmittedAt: string | null;
}

interface AssignmentEngagementRow {
  assessment: AcademicAssessment;
  course: Course;
  enrolledCount: number;
  uniqueSubmittedStudents: number;
  submissionRatePct: number | null;
  pendingCount: number;
  gradedCount: number;
  isPastDue: boolean;
}

export const TeacherEngagementDashboard: React.FC<TeacherEngagementDashboardProps> = ({
  currentUser,
  courses,
  submissions,
  loadingSubmissions,
  onRefreshSubmissions,
  onReviewSubmissions,
  onSelectCourse,
  onOpenCreateCourse,
  onOpenCreateAssessment,
}) => {
  const fullNameNormalized = `${currentUser.firstName} ${currentUser.lastName}`
    .trim()
    .toLowerCase();

  const assignedCourses = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.instructorId === currentUser.id ||
          (c.instructorName || '').trim().toLowerCase() === fullNameNormalized ||
          (c.schedules || []).some((s) => s.instructorId === currentUser.id)
      ),
    [courses, currentUser.id, fullNameNormalized]
  );

  const [courseScope, setCourseScope] = useState<'mine' | 'all'>(() =>
    assignedCourses.length > 0 ? 'mine' : currentUser.role === 'admin' ? 'all' : 'mine'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'pending' | 'low-rate'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceByCourse, setAttendanceByCourse] = useState<Record<string, AttendanceRecord[]>>(
    {}
  );
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Sync default scope when courses finish hydrating on first mount
  useEffect(() => {
    if (assignedCourses.length > 0 && courseScope === 'all' && currentUser.role !== 'admin') {
      setCourseScope('mine');
    }
  }, [assignedCourses.length, currentUser.role]);

  const scopedCourses = useMemo(
    () => (courseScope === 'mine' ? assignedCourses : courses),
    [courseScope, assignedCourses, courses]
  );

  const loadCourseAttendance = async (targetCourses: Course[]) => {
    if (targetCourses.length === 0) {
      setAttendanceByCourse({});
      return;
    }
    setLoadingAttendance(true);
    try {
      const headers = await getAuthHeaders();
      const entries = await Promise.all(
        targetCourses.map(async (c) => {
          try {
            const res = await fetch(`/api/attendance/course/${encodeURIComponent(c.id)}`, {
              headers,
              credentials: 'include',
            });
            if (!res.ok) return [c.id, [] as AttendanceRecord[]] as const;
            const rows = await res.json();
            return [c.id, Array.isArray(rows) ? (rows as AttendanceRecord[]) : []] as const;
          } catch {
            return [c.id, [] as AttendanceRecord[]] as const;
          }
        })
      );
      setAttendanceByCourse(Object.fromEntries(entries));
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    void loadCourseAttendance(scopedCourses);
  }, [scopedCourses.map((c) => c.id).join(',')]);

  const handleRefreshAll = async () => {
    await Promise.all([onRefreshSubmissions(), loadCourseAttendance(scopedCourses)]);
  };

  const courseMetrics = useMemo<CourseEngagementMetrics[]>(() => {
    const nowMs = Date.now();
    return scopedCourses.map((course) => {
      const enrolledCount = course.enrolledStudentIds.length;
      const maxSpots = Math.max(1, course.maxSpots ?? 50);
      const assignments = course.assignments || [];
      const activeAssignmentsList = assignments.filter((a) => {
        const dueMs = Date.parse(a.dueDateUtc);
        return Number.isNaN(dueMs) || dueMs >= nowMs;
      });
      const rateTargets =
        activeAssignmentsList.length > 0 ? activeAssignmentsList : assignments;
      const targetIds = new Set(rateTargets.map((a) => a.id));

      const courseSubs = submissions.filter((s) => s.courseId === course.id);
      const uniquePairs = new Set<string>();
      for (const s of courseSubs) {
        if (targetIds.has(s.assessmentId)) {
          uniquePairs.add(`${s.studentId}::${s.assessmentId}`);
        }
      }

      const expectedActiveSlots = enrolledCount * rateTargets.length;
      const activeSubmissionRatePct =
        expectedActiveSlots > 0
          ? Math.min(100, Math.round((uniquePairs.size / expectedActiveSlots) * 100))
          : null;

      const pendingReviewCount = courseSubs.filter((s) => s.status === 'submitted').length;
      const gradedSubs = courseSubs.filter(
        (s) => s.status === 'graded' && typeof s.grade === 'number'
      );
      const avgScorePct =
        gradedSubs.length > 0
          ? Math.round(
              gradedSubs.reduce(
                (acc, s) => acc + (Number(s.grade || 0) / Math.max(1, s.maxPoints)) * 100,
                0
              ) / gradedSubs.length
            )
          : null;

      const attendanceRecords = attendanceByCourse[course.id] || [];
      const lastSubmittedAt =
        courseSubs.length > 0
          ? [...courseSubs].sort(
              (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            )[0].submittedAt
          : null;

      return {
        course,
        enrolledCount,
        maxSpots,
        totalAssignments: assignments.length,
        activeAssignments: activeAssignmentsList.length,
        uniqueActiveSubmitters: uniquePairs.size,
        expectedActiveSlots,
        activeSubmissionRatePct,
        totalSubmissionsCount: courseSubs.length,
        pendingReviewCount,
        gradedCount: gradedSubs.length,
        avgScorePct,
        attendanceCount: attendanceRecords.length,
        lastSubmittedAt,
      };
    });
  }, [scopedCourses, submissions, attendanceByCourse]);

  const filteredCourseMetrics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courseMetrics.filter((m) => {
      if (selectedCourseId !== 'all' && m.course.id !== selectedCourseId) return false;
      if (healthFilter === 'pending' && m.pendingReviewCount === 0) return false;
      if (
        healthFilter === 'low-rate' &&
        (m.activeSubmissionRatePct === null || m.activeSubmissionRatePct >= 60)
      ) {
        return false;
      }
      if (
        q &&
        !m.course.title.toLowerCase().includes(q) &&
        !m.course.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [courseMetrics, selectedCourseId, healthFilter, searchQuery]);

  // Portfolio-level aggregates over the currently selected course filter
  const portfolioSummary = useMemo(() => {
    const rows =
      selectedCourseId === 'all'
        ? courseMetrics
        : courseMetrics.filter((m) => m.course.id === selectedCourseId);

    const totalEnrolled = rows.reduce((s, r) => s + r.enrolledCount, 0);
    const totalCapacity = rows.reduce((s, r) => s + r.maxSpots, 0);
    const totalActiveAssignments = rows.reduce((s, r) => s + r.activeAssignments, 0);
    const totalPublishedAssignments = rows.reduce((s, r) => s + r.totalAssignments, 0);
    const totalPendingReviews = rows.reduce((s, r) => s + r.pendingReviewCount, 0);
    const totalGraded = rows.reduce((s, r) => s + r.gradedCount, 0);
    const totalSubmissions = rows.reduce((s, r) => s + r.totalSubmissionsCount, 0);
    const totalAttendance = rows.reduce((s, r) => s + r.attendanceCount, 0);

    const sumUnique = rows.reduce((s, r) => s + r.uniqueActiveSubmitters, 0);
    const sumExpected = rows.reduce((s, r) => s + r.expectedActiveSlots, 0);
    const overallSubmissionRatePct =
      sumExpected > 0 ? Math.min(100, Math.round((sumUnique / sumExpected) * 100)) : null;

    const scoredCourses = rows.filter((r) => r.avgScorePct !== null);
    const overallAvgScorePct =
      scoredCourses.length > 0
        ? Math.round(
            scoredCourses.reduce((s, r) => s + (r.avgScorePct || 0), 0) / scoredCourses.length
          )
        : null;

    return {
      courseCount: rows.length,
      totalEnrolled,
      totalCapacity,
      totalActiveAssignments,
      totalPublishedAssignments,
      sumUnique,
      sumExpected,
      overallSubmissionRatePct,
      totalPendingReviews,
      totalGraded,
      totalSubmissions,
      totalAttendance,
      overallAvgScorePct,
    };
  }, [courseMetrics, selectedCourseId]);

  const assignmentRows = useMemo<AssignmentEngagementRow[]>(() => {
    const nowMs = Date.now();
    const targetCourses =
      selectedCourseId === 'all'
        ? scopedCourses
        : scopedCourses.filter((c) => c.id === selectedCourseId);

    const q = searchQuery.trim().toLowerCase();
    const rows: AssignmentEngagementRow[] = [];

    for (const course of targetCourses) {
      const enrolledCount = course.enrolledStudentIds.length;
      const courseSubs = submissions.filter((s) => s.courseId === course.id);
      for (const ass of course.assignments || []) {
        if (
          q &&
          !ass.title.toLowerCase().includes(q) &&
          !course.title.toLowerCase().includes(q) &&
          !course.code.toLowerCase().includes(q)
        ) {
          continue;
        }
        const assSubs = courseSubs.filter((s) => s.assessmentId === ass.id);
        const uniqueStudents = new Set(assSubs.map((s) => s.studentId)).size;
        const submissionRatePct =
          enrolledCount > 0
            ? Math.min(100, Math.round((uniqueStudents / enrolledCount) * 100))
            : null;
        const pendingCount = assSubs.filter((s) => s.status === 'submitted').length;
        const gradedCount = assSubs.filter((s) => s.status === 'graded').length;
        const dueMs = Date.parse(ass.dueDateUtc);
        const isPastDue = !Number.isNaN(dueMs) && dueMs < nowMs;

        if (healthFilter === 'pending' && pendingCount === 0) continue;
        if (
          healthFilter === 'low-rate' &&
          (submissionRatePct === null || submissionRatePct >= 60)
        ) {
          continue;
        }

        rows.push({
          assessment: ass,
          course,
          enrolledCount,
          uniqueSubmittedStudents: uniqueStudents,
          submissionRatePct,
          pendingCount,
          gradedCount,
          isPastDue,
        });
      }
    }

    return rows.sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return new Date(a.assessment.dueDateUtc).getTime() - new Date(b.assessment.dueDateUtc).getTime();
    });
  }, [scopedCourses, selectedCourseId, submissions, searchQuery, healthFilter]);

  const pendingQueue = useMemo(() => {
    const scopedCourseIds = new Set(scopedCourses.map((c) => c.id));
    return submissions
      .filter((s) => {
        if (!scopedCourseIds.has(s.courseId)) return false;
        if (selectedCourseId !== 'all' && s.courseId !== selectedCourseId) return false;
        return s.status === 'submitted';
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [scopedCourses, selectedCourseId, submissions]);

  const getRateVisual = (rate: number | null) => {
    if (rate === null) {
      return {
        barClass: 'bg-slate-300 dark:bg-slate-700',
        textClass: 'text-slate-500 dark:text-slate-400',
        label: 'No active tasks',
      };
    }
    if (rate >= 75) {
      return {
        barClass: 'bg-emerald-500',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        label: 'Strong',
      };
    }
    if (rate >= 45) {
      return {
        barClass: 'bg-amber-500',
        textClass: 'text-amber-700 dark:text-amber-400',
        label: 'Moderate',
      };
    }
    return {
      barClass: 'bg-rose-500',
      textClass: 'text-rose-700 dark:text-rose-400',
      label: 'Needs Follow-Up',
    };
  };

  const isLoading = loadingSubmissions || loadingAttendance;

  return (
    <section
      aria-label="Course Student Engagement Dashboard"
      className="space-y-6"
    >
      {/* Top Toolbar & Scope Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
              <span>Course Engagement &amp; Review Telemetry</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {scopedCourses.length} {courseScope === 'mine' ? 'assigned' : 'academy'} courses
              <span aria-hidden="true"> · </span>
              Submission rates computed from enrolled learners and active assessments
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Segmented Control */}
            <div
              role="group"
              aria-label="Course Ownership Scope"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#071120] border border-slate-200 dark:border-slate-800"
            >
              <button
                type="button"
                onClick={() => {
                  setCourseScope('mine');
                  setSelectedCourseId('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  courseScope === 'mine'
                    ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                My Courses ({assignedCourses.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCourseScope('all');
                  setSelectedCourseId('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  courseScope === 'all'
                    ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Courses ({courses.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleRefreshAll()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Syncing...' : 'Refresh Stats'}</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by course code or assessment title..."
              aria-label="Filter engagement table by keyword"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] dark:focus:border-[#00F2FE]"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              aria-label="Select specific course"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">
                All {courseScope === 'mine' ? 'Assigned' : 'Academy'} Courses ({scopedCourses.length})
              </option>
              {scopedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center justify-start md:justify-end gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'All Status' },
                { key: 'pending', label: 'Has Pending Reviews' },
                { key: 'low-rate', label: 'Submission < 60%' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setHealthFilter(opt.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  healthFilter === opt.key
                    ? 'bg-sky-50 dark:bg-[#00F2FE]/15 border-[#0284C7] dark:border-[#00F2FE] text-[#0284C7] dark:text-[#00F2FE]'
                    : 'bg-slate-50 dark:bg-[#071120] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State when Instructor has 0 Courses in "My Courses" scope */}
      {scopedCourses.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <BookOpen className="w-8 h-8 text-[#0284C7] dark:text-[#00F2FE] mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Courses Assigned to {currentUser.firstName} {currentUser.lastName} Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Publish a new course cohort as instructor or switch to All Courses to inspect Academy-wide assignment submission rates and pending reviews.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onOpenCreateCourse && (
              <button
                type="button"
                onClick={onOpenCreateCourse}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Course Cohort</span>
              </button>
            )}
            {courses.length > 0 && (
              <button
                type="button"
                onClick={() => setCourseScope('all')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                View All Academy Courses ({courses.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column Portfolio KPI Strip (Flat single-elevation strip with vertical dividers) */}
          <div className="rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-5 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                <span>Active Submission Rate</span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {portfolioSummary.overallSubmissionRatePct !== null
                  ? `${portfolioSummary.overallSubmissionRatePct}%`
                  : 'N/A'}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {portfolioSummary.sumExpected > 0
                  ? `${portfolioSummary.sumUnique} / ${portfolioSummary.sumExpected} expected submissions`
                  : `${portfolioSummary.totalActiveAssignments} active tasks · ${portfolioSummary.totalEnrolled} enrolled`}
              </div>
            </div>

            <div className="p-5 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pending Reviews</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-2xl font-extrabold font-mono tabular-nums ${
                    portfolioSummary.totalPendingReviews > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {portfolioSummary.totalPendingReviews}
                </span>
                {portfolioSummary.totalPendingReviews > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onReviewSubmissions(
                        selectedCourseId === 'all' ? 'all' : selectedCourseId,
                        'submitted'
                      )
                    }
                    className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline whitespace-nowrap"
                  >
                    Review Queue →
                  </button>
                )}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {portfolioSummary.totalPendingReviews > 0
                  ? `${portfolioSummary.totalPendingReviews} awaiting instructor feedback`
                  : 'All submitted assignments reviewed'}
              </div>
            </div>

            <div className="p-5 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Enrolled Learners</span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {portfolioSummary.totalEnrolled}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {portfolioSummary.totalEnrolled} / {portfolioSummary.totalCapacity} cohort seats across{' '}
                {portfolioSummary.courseCount} courses
              </div>
            </div>

            <div className="p-5 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Graded &amp; Live Attendance</span>
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {portfolioSummary.totalGraded}
                {portfolioSummary.overallAvgScorePct !== null && (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 ml-2">
                    ({portfolioSummary.overallAvgScorePct}% avg)
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {portfolioSummary.totalSubmissions} total submissions · {portfolioSummary.totalAttendance}{' '}
                live check-ins
              </div>
            </div>
          </div>

          {/* Per-Course Engagement Statistics Table */}
          <div className="rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Per-Course Engagement &amp; Review Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submission completion rate, pending grading queue, and attendance for each course
                </p>
              </div>
              {isLoading && (
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </div>
              )}
            </div>

            {filteredCourseMetrics.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No courses match your active filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseId('all');
                    setHealthFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071120] text-slate-500 dark:text-slate-400 font-medium">
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4 text-right">Enrolled</th>
                      <th className="py-3 px-4 text-right">Active Tasks</th>
                      <th className="py-3 px-4 min-w-[200px]">Active Submission Rate</th>
                      <th className="py-3 px-4 text-right">Pending Reviews</th>
                      <th className="py-3 px-4 text-right">Avg Grade · Check-ins</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredCourseMetrics.map((row) => {
                      const rateVis = getRateVisual(row.activeSubmissionRatePct);
                      return (
                        <tr
                          key={row.course.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-[#071120]/60 transition-colors"
                        >
                          <td className="py-3.5 px-4 max-w-[260px]">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {row.course.title}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {row.course.code} · {row.course.level} · {row.course.status}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {row.enrolledCount} / {row.maxSpots}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {row.activeAssignments}
                            </span>
                            <span className="text-slate-400 ml-1">
                              / {row.totalAssignments} total
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                                <span className={`font-bold ${rateVis.textClass}`}>
                                  {row.activeSubmissionRatePct !== null
                                    ? `${row.activeSubmissionRatePct}% · ${rateVis.label}`
                                    : rateVis.label}
                                </span>
                                {row.expectedActiveSlots > 0 && (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {row.uniqueActiveSubmitters}/{row.expectedActiveSlots}
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${rateVis.barClass}`}
                                  style={{
                                    width: `${row.activeSubmissionRatePct ?? 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            {row.pendingReviewCount > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {row.pendingReviewCount} pending
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                0 pending
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row.avgScorePct !== null ? `${row.avgScorePct}%` : '—'}
                            <span className="text-slate-400 mx-1">·</span>
                            <span>{row.attendanceCount} live</span>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-3">
                              {row.pendingReviewCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onReviewSubmissions(row.course.id, 'submitted')}
                                  className="font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline"
                                >
                                  Review ({row.pendingReviewCount})
                                </button>
                              ) : row.totalAssignments === 0 && onOpenCreateAssessment ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenCreateAssessment(row.course.id)}
                                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  Assign Task
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onReviewSubmissions(row.course.id, 'all')}
                                  className="font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:underline"
                                >
                                  Submissions
                                </button>
                              )}

                              {onSelectCourse && (
                                <button
                                  type="button"
                                  onClick={() => onSelectCourse(row.course)}
                                  title="Open Course Page"
                                  className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2-Column Split: Assignment Submission Matrix + Priority Pending Review Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left (7 cols): Assignment-Level Submission Breakdown */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Assignment Submission Rates ({assignmentRows.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Individual homework, quizzes, and exams sorted by pending review count
                  </p>
                </div>
                {onOpenCreateAssessment && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCreateAssessment(
                        selectedCourseId !== 'all'
                          ? selectedCourseId
                          : scopedCourses[0]?.id || ''
                      )
                    }
                    className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline whitespace-nowrap shrink-0"
                  >
                    + New Assignment
                  </button>
                )}
              </div>

              {assignmentRows.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No published assignments match the current filter.
                  </p>
                  {onOpenCreateAssessment && scopedCourses[0] && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCreateAssessment(
                          selectedCourseId !== 'all'
                            ? selectedCourseId
                            : scopedCourses[0].id
                        )
                      }
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981]"
                    >
                      Publish First Assignment
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
                  {assignmentRows.map((item) => {
                    const vis = getRateVisual(item.submissionRatePct);
                    const dueLocal = formatToLocalTime(item.assessment.dueDateUtc);
                    return (
                      <div
                        key={`${item.course.id}-${item.assessment.id}`}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-[#071120]/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.assessment.title}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>{item.course.code}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {item.assessment.type.replace('_', ' ')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{item.assessment.points} pts</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                item.isPastDue
                                  ? 'text-slate-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {item.isPastDue ? 'Closed' : 'Active'} ({dueLocal.localDayStr})
                            </span>
                          </div>
                        </div>

                        <div className="sm:w-56 shrink-0 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                            <span className={`font-bold ${vis.textClass}`}>
                              {item.submissionRatePct !== null
                                ? `${item.submissionRatePct}%`
                                : '0 enrolled'}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.uniqueSubmittedStudents}/{item.enrolledCount} submitted
                              {item.pendingCount > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold ml-1.5">
                                  ({item.pendingCount} pending)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${vis.barClass}`}
                              style={{ width: `${item.submissionRatePct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right (5 cols): Pending Review Priority Queue */}
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-amber-500" />
                    <span>Pending Review Queue ({pendingQueue.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ungraded student submissions waiting for feedback
                  </p>
                </div>
                {pendingQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onReviewSubmissions(
                        selectedCourseId !== 'all' ? selectedCourseId : 'all',
                        'submitted'
                      )
                    }
                    className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline whitespace-nowrap shrink-0"
                  >
                    Grade All →
                  </button>
                )}
              </div>

              {pendingQueue.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Pending Queue Clear
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    All submitted coursework for the selected courses has been graded.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
                  {pendingQueue.map((sub) => {
                    const c = courses.find((item) => item.id === sub.courseId);
                    const assName = resolveAssessmentTitle(c, sub.assessmentId);
                    const submittedLocal = formatToLocalTime(sub.submittedAt);
                    const formatTag = sub.linkUrl
                      ? 'External Link'
                      : sub.fileUrl
                      ? sub.fileName || 'Uploaded File'
                      : 'Written Response';

                    return (
                      <div
                        key={sub.id}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-[#071120]/60 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {sub.studentName}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                            {c?.code || sub.courseId} · {assName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate tabular-nums">
                            {formatTag} · {submittedLocal.localDayStr} {submittedLocal.localTimeStr}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onReviewSubmissions(sub.courseId, 'submitted')}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
