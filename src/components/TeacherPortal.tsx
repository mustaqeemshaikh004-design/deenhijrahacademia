import React, { useEffect, useState } from 'react';
import {
  Video,
  Calendar,
  BookOpen,
  Award,
  User as UserIcon,
  Plus,
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  Radio,
  Copy,
  Check,
  Lock,
  Unlock,
  Play,
  Trash2,
  Sparkles,
  ExternalLink,
  Sun,
  Moon,
  SlidersHorizontal,
  Clock,
  Users,
  X,
  BarChart3,
} from 'lucide-react';
import type {
  CalendarEvent,
  CompletedVideoArchive,
  Course,
  StudentSubmission,
  User,
} from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { CircularProfileSeal } from './CircularProfileSeal';
import { AssessmentsStudio } from './AssessmentsStudio';
import { TeacherEngagementDashboard } from './TeacherEngagementDashboard';
import { LiveSessionContext } from './LiveClassroomModal';
import {
  getAuthHeaders,
  uploadAssetSmart,
  uploadMp4VideoSmart,
  uploadPdfDocumentSmart,
} from '../services/firebaseService';
import { resolveMediaSrc } from '../assets/fallbacks';
import { formatToLocalTime } from '../utils/timezone';

interface TeacherPortalProps {
  currentUser: User;
  courses: Course[];
  events: CalendarEvent[];
  customLogoUrl?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onCoursesUpdated: (courses: Course[]) => void;
  onCreateEvent: (eventData: Partial<CalendarEvent>) => Promise<CalendarEvent | void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onStartMeeting: (session: LiveSessionContext) => void;
  onAddRecording: (
    courseId: string,
    recData: {
      id?: string;
      title: string;
      videoUrl: string;
      storagePath?: string;
      teaserUrl?: string;
      teaserStoragePath?: string;
      thumbnailUrl: string;
      thumbnailStoragePath?: string;
      supplementaryPdfUrl?: string;
      supplementaryPdfName?: string;
      supplementaryPdfStoragePath?: string;
      duration: string;
      isOrientation: boolean;
      fileSize?: string;
    }
  ) => Promise<void>;
  onUpdateRecording?: (
    courseId: string,
    recId: string,
    patch: Partial<CompletedVideoArchive>
  ) => Promise<void>;
  onDeleteRecording?: (courseId: string, recId: string) => Promise<void>;
  onSelectCourse?: (course: Course) => void;
  onRefreshData?: () => Promise<void>;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  currentUser,
  courses,
  events,
  customLogoUrl,
  theme,
  onToggleTheme,
  onCoursesUpdated,
  onCreateEvent,
  onDeleteEvent,
  onStartMeeting,
  onAddRecording,
  onUpdateRecording,
  onDeleteRecording,
  onSelectCourse,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'live' | 'engagement' | 'recordings' | 'assessments' | 'courses' | 'profile'
  >('live');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [assessmentNavState, setAssessmentNavState] = useState<{
    subTab: 'homework' | 'quiz' | 'exam' | 'submissions';
    courseFilter: string;
    statusFilter: 'all' | 'submitted' | 'graded';
  }>({
    subTab: 'homework',
    courseFilter: 'all',
    statusFilter: 'all',
  });

  const [profileHydrating, setProfileHydrating] = useState(true);

  useEffect(() => {
    setProfileHydrating(true);
    const t = window.setTimeout(() => setProfileHydrating(false), 740);
    return () => window.clearTimeout(t);
  }, [currentUser.id]);

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

  // Schedule Class / Event state (auto-generates Classroom Link)
  const [evTitle, setEvTitle] = useState('');
  const [evCourseId, setEvCourseId] = useState<string>(courses[0]?.id || '');
  const [evDateStr, setEvDateStr] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [evDayOfWeek, setEvDayOfWeek] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return DAYS_OF_WEEK[d.getDay()];
  });
  const [evTimeStr, setEvTimeStr] = useState('14:00');
  const [evLocation, setEvLocation] = useState('Live Online Sanctuary');
  const [evDescription, setEvDescription] = useState('');
  const [evAutoRecord, setEvAutoRecord] = useState(true);
  const [evSubmitting, setEvSubmitting] = useState(false);
  const [evSuccessMsg, setEvSuccessMsg] = useState<string | null>(null);
  const [evErrorMsg, setEvErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lecture Upload (Thumbnail + Teaser + Lecture + Step 4 Supplementary PDF)
  const [recCourseId, setRecCourseId] = useState(courses[0]?.id || '');
  const [pendingRecId, setPendingRecId] = useState(() => `rec-${Date.now()}`);
  const [recTitle, setRecTitle] = useState('');
  const [recDuration, setRecDuration] = useState('45 min');
  const [recIsOrientation, setRecIsOrientation] = useState(false);
  const [recThumbnailUrl, setRecThumbnailUrl] = useState('fallback://course');
  const [recThumbnailStoragePath, setRecThumbnailStoragePath] = useState('');
  const [recTeaserUrl, setRecTeaserUrl] = useState('');
  const [recTeaserStoragePath, setRecTeaserStoragePath] = useState('');
  const [recVideoUrl, setRecVideoUrl] = useState('');
  const [recStoragePath, setRecStoragePath] = useState('');
  const [recFileSize, setRecFileSize] = useState('');
  const [recPdfUrl, setRecPdfUrl] = useState('');
  const [recPdfName, setRecPdfName] = useState('');
  const [recPdfStoragePath, setRecPdfStoragePath] = useState('');
  const [thumbPct, setThumbPct] = useState<number | null>(null);
  const [teaserPct, setTeaserPct] = useState<number | null>(null);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recSuccess, setRecSuccess] = useState<string | null>(null);

  // Avatar upload
  const [avatarPct, setAvatarPct] = useState<number | null>(null);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);

  // Instructor Course Creation & Limit/Duration Editing
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cCode, setCCode] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cLevel, setCLevel] = useState<Course['level']>('Beginner');
  const [cLectures, setCLectures] = useState(12);
  const [cMaxSpots, setCMaxSpots] = useState(50);
  const [cDurationLabel, setCDurationLabel] = useState('12 Weeks');
  const [cDeadlineLocal, setCDeadlineLocal] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [cError, setCError] = useState<string | null>(null);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [eMaxSpots, setEMaxSpots] = useState(50);
  const [eDurationLabel, setEDurationLabel] = useState('12 Weeks');
  const [eDeadlineLocal, setEDeadlineLocal] = useState('');
  const [eLectures, setELectures] = useState(12);
  const [eStatus, setEStatus] = useState<Course['status']>('Open for Enrollment');
  const [eBusy, setEBusy] = useState(false);
  const [eError, setEError] = useState<string | null>(null);

  const fetchPortalSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/submissions', { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSubmissions(data);
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    void fetchPortalSubmissions();
  }, [currentUser.id]);

  useEffect(() => {
    if (!recCourseId && courses[0]?.id) setRecCourseId(courses[0].id);
    if (!evCourseId && courses[0]?.id) setEvCourseId(courses[0].id);
  }, [courses, recCourseId, evCourseId]);

  const handleOpenEditCourseLimits = (c: Course) => {
    setEditingCourse(c);
    setEMaxSpots(Math.max(1, Number(c.maxSpots) || 50));
    setEDurationLabel(c.durationLabel || '12 Weeks');
    setELectures(c.totalLectures || 12);
    setEStatus(c.status);
    setEError(null);
    if (c.enrollmentDeadlineUtc) {
      const parsed = new Date(c.enrollmentDeadlineUtc);
      if (!Number.isNaN(parsed.getTime())) {
        const localIso = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setEDeadlineLocal(localIso);
      } else {
        setEDeadlineLocal('');
      }
    } else {
      setEDeadlineLocal('');
    }
  };

  const handleSaveInstructorCourseLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setEBusy(true);
    setEError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/courses/${editingCourse.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          maxSpots: Math.max(1, Number(eMaxSpots) || 50),
          durationLabel: eDurationLabel.trim() || '12 Weeks',
          enrollmentDeadlineUtc: eDeadlineLocal
            ? new Date(eDeadlineLocal).toISOString()
            : '',
          totalLectures: Math.max(1, Number(eLectures) || 12),
          status: eStatus,
        }),
      });
      const updated = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(updated?.error || 'Could not update course limits.');
      }
      onCoursesUpdated(courses.map((item) => (item.id === editingCourse.id ? updated : item)));
      setEditingCourse(null);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: unknown) {
      setEError(err instanceof Error ? err.message : 'Unable to save limits.');
    } finally {
      setEBusy(false);
    }
  };

  const handleCreateInstructorCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim() || !cDesc.trim()) {
      setCError('Course title and explanation description are required.');
      return;
    }
    setCBusy(true);
    setCError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/courses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          title: cTitle.trim(),
          code: cCode.trim() || `DHA-${Math.floor(100 + Math.random() * 900)}`,
          description: cDesc.trim(),
          instructorId: currentUser.id,
          instructorName: `${currentUser.firstName} ${currentUser.lastName}`,
          level: cLevel,
          status: 'Open for Enrollment',
          totalLectures: Math.max(1, Number(cLectures) || 12),
          maxSpots: Math.max(1, Number(cMaxSpots) || 50),
          durationLabel: cDurationLabel.trim() || '12 Weeks',
          enrollmentDeadlineUtc: cDeadlineLocal
            ? new Date(cDeadlineLocal).toISOString()
            : '',
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(created?.error || 'Could not publish course.');
      }
      onCoursesUpdated([created, ...courses]);
      setShowCreateCourseModal(false);
      setCTitle('');
      setCCode('');
      setCDesc('');
      setCMaxSpots(50);
      setCDurationLabel('12 Weeks');
      setCDeadlineLocal('');
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: unknown) {
      setCError(err instanceof Error ? err.message : 'Failed to create course.');
    } finally {
      setCBusy(false);
    }
  };

  const handleDateChange = (nextDate: string) => {
    setEvDateStr(nextDate);
    const parsed = new Date(`${nextDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setEvDayOfWeek(DAYS_OF_WEEK[parsed.getDay()]);
    }
  };

  const handleScheduleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) return;
    setEvSubmitting(true);
    setEvErrorMsg(null);
    setEvSuccessMsg(null);
    try {
      const linkedCourse = courses.find((c) => c.id === evCourseId);
      const combined = new Date(`${evDateStr}T${evTimeStr}:00`);
      const isoStart = Number.isNaN(combined.getTime())
        ? new Date().toISOString()
        : combined.toISOString();

      await onCreateEvent({
        title: evTitle.trim(),
        description: evDescription.trim(),
        courseId: linkedCourse?.id || undefined,
        courseTitle: linkedCourse?.title || undefined,
        dateStr: evDateStr,
        dayOfWeek: evDayOfWeek,
        timeUtc: evTimeStr,
        startUtc: isoStart,
        endUtc: isoStart,
        instructorId: currentUser.id,
        instructorName: `${currentUser.firstName} ${currentUser.lastName}`,
        autoRecord: evAutoRecord,
        type: 'lecture',
        pinnedToBoard: true,
        pinColor: 'emerald',
        locationOrLabel: evLocation.trim() || 'Live Online Sanctuary',
      });

      setEvTitle('');
      setEvDescription('');
      setEvSuccessMsg(
        'Live Class scheduled and meeting room link automatically generated! Enrolled students now see "Join Meeting" in their Student Portal.'
      );
    } catch (err: unknown) {
      setEvErrorMsg(err instanceof Error ? err.message : 'Unable to create class event.');
    } finally {
      setEvSubmitting(false);
    }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recCourseId) return;
    setRecError(null);
    setThumbPct(1);
    try {
      const { url, storagePath } = await uploadAssetSmart(
        'recording_thumbnail',
        file,
        (p) => setThumbPct(p),
        { courseId: recCourseId, recordingId: pendingRecId }
      );
      setRecThumbnailUrl(url);
      setRecThumbnailStoragePath(storagePath);
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setThumbPct(null);
      e.target.value = '';
    }
  };

  const handleTeaserUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recCourseId) return;
    setRecError(null);
    setTeaserPct(1);
    try {
      const res = await uploadMp4VideoSmart(
        'course_teaser',
        file,
        { courseId: recCourseId, recordingId: pendingRecId, isOrientation: true },
        (p) => setTeaserPct(p)
      );
      setRecTeaserUrl(res.streamUrl);
      setRecTeaserStoragePath(res.storagePath);
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Teaser video upload failed.');
    } finally {
      setTeaserPct(null);
      e.target.value = '';
    }
  };

  const handleLectureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recCourseId) return;
    setRecError(null);
    setVideoPct(1);
    try {
      const res = await uploadMp4VideoSmart(
        'course_recording',
        file,
        {
          courseId: recCourseId,
          recordingId: pendingRecId,
          isOrientation: recIsOrientation,
        },
        (p) => setVideoPct(p)
      );
      setRecVideoUrl(res.streamUrl);
      setRecStoragePath(res.storagePath);
      setRecFileSize(res.fileSize);
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Lecture MP4 upload failed.');
    } finally {
      setVideoPct(null);
      e.target.value = '';
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecError(null);
    setPdfUploading(true);
    try {
      const res = await uploadPdfDocumentSmart('supplementary_pdf', file);
      setRecPdfUrl(res.url);
      setRecPdfName(res.fileName);
      setRecPdfStoragePath(res.storagePath);
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Supplementary PDF upload failed.');
    } finally {
      setPdfUploading(false);
      e.target.value = '';
    }
  };

  const handlePublishRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recCourseId || !recTitle.trim()) return;
    if (!recStoragePath && !recVideoUrl.trim() && !recTeaserUrl.trim()) {
      setRecError('Please upload your lecture video (.MP4) or teaser clip first.');
      return;
    }
    setRecSubmitting(true);
    setRecError(null);
    setRecSuccess(null);
    try {
      await onAddRecording(recCourseId, {
        id: pendingRecId,
        title: recTitle.trim(),
        videoUrl: recStoragePath ? '' : recVideoUrl.trim(),
        storagePath: recStoragePath || undefined,
        teaserUrl: recTeaserStoragePath ? '' : recTeaserUrl.trim() || undefined,
        teaserStoragePath: recTeaserStoragePath || undefined,
        thumbnailUrl: recThumbnailUrl,
        thumbnailStoragePath: recThumbnailStoragePath || undefined,
        supplementaryPdfUrl: recPdfUrl || undefined,
        supplementaryPdfName: recPdfName || undefined,
        supplementaryPdfStoragePath: recPdfStoragePath || undefined,
        duration: recDuration || '45 min',
        isOrientation: recIsOrientation,
        fileSize: recFileSize || undefined,
      });

      setRecTitle('');
      setRecThumbnailUrl('fallback://course');
      setRecThumbnailStoragePath('');
      setRecTeaserUrl('');
      setRecTeaserStoragePath('');
      setRecVideoUrl('');
      setRecStoragePath('');
      setRecFileSize('');
      setRecPdfUrl('');
      setRecPdfName('');
      setRecPdfStoragePath('');
      setPendingRecId(`rec-${Date.now()}`);
      setRecSuccess('Lecture recording, teaser, and Supplementary PDF permanently saved!');
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Unable to save lecture.');
    } finally {
      setRecSubmitting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarErr(null);
    setAvatarPct(10);
    try {
      const { url, storagePath } = await uploadAssetSmart('avatar', file, (p) => setAvatarPct(p));
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarUrl: url,
          avatarStoragePath: storagePath,
          email: currentUser.email,
        }),
      });
      if (!res.ok) throw new Error('Unable to update profile photo.');
      if (onRefreshData) await onRefreshData();
    } catch (err: unknown) {
      setAvatarErr(err instanceof Error ? err.message : 'Avatar upload failed.');
    } finally {
      setAvatarPct(null);
      e.target.value = '';
    }
  };

  const totalRecordings = courses.reduce((sum, c) => sum + (c.videoArchives?.length || 0), 0);
  const totalAssessments = courses.reduce((sum, c) => sum + (c.assignments?.length || 0), 0);
  const fullNameLower = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
  const teacherOwnCourseIds = new Set(
    courses
      .filter(
        (c) =>
          c.instructorId === currentUser.id ||
          (c.instructorName || '').trim().toLowerCase() === fullNameLower ||
          (c.schedules || []).some((s) => s.instructorId === currentUser.id)
      )
      .map((c) => c.id)
  );
  const relevantPendingReviewsCount = submissions.filter(
    (s) =>
      s.status === 'submitted' &&
      (teacherOwnCourseIds.size > 0 && currentUser.role !== 'admin'
        ? teacherOwnCourseIds.has(s.courseId)
        : true)
  ).length;
  const customLiveEvents = events.filter((ev) => !ev.isDerived);
  const activeRecCourse = courses.find((c) => c.id === recCourseId) || courses[0];

  const handleCopyInvite = (key: string, meetingId: string) => {
    const cleanId = meetingId.replace(/\s+/g, '');
    const shareUrl = `${window.location.origin}/?tab=classroom&room=${cleanId}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (profileHydrating) {
    return (
      <div
        data-portal-theme={portalTheme}
        aria-busy="true"
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0A1628] transition-colors duration-200 px-6"
      >
        <CircularProfileSeal
          name={`${currentUser.firstName} ${currentUser.lastName}`}
          avatarUrl={currentUser.avatarUrl}
          gender={currentUser.gender}
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
        {/* Teacher Hero Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-gradient-to-r dark:from-[#0F2942] dark:via-[#0A192F] dark:to-[#071120] border border-slate-200 dark:border-emerald-500/30 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
                  stroke="#10B981"
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
                  gender={currentUser.gender}
                  avatarUrl={currentUser.avatarUrl}
                  name={`${currentUser.firstName} ${currentUser.lastName}`}
                  size="2xl"
                />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Faculty Teacher Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {currentUser.firstName} {currentUser.lastName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-mono mt-0.5">
                {currentUser.email}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
              </div>
            </div>
          </div>

        {/* 4 Summary Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Courses</div>
            <div className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-[#00F2FE]">
              {courses.length}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Pending Reviews</div>
            <div
              className={`text-xl font-bold font-mono tabular-nums ${
                relevantPendingReviewsCount > 0
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {relevantPendingReviewsCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Lectures</div>
            <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
              {totalRecordings}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Assessments</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalAssessments}
            </div>
          </div>
        </div>
      </div>

      {/* Boxed 6-Card Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            key: 'live' as const,
            title: 'Live Classes',
            sub: 'Schedule & Host Meeting',
            count: customLiveEvents.length,
            icon: Video,
            color: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            key: 'engagement' as const,
            title: 'Engagement Stats',
            sub: 'Rates & Pending Reviews',
            count: relevantPendingReviewsCount,
            icon: BarChart3,
            color: 'text-cyan-600 dark:text-[#00F2FE]',
          },
          {
            key: 'recordings' as const,
            title: 'Lecture Upload',
            sub: 'Video + Teaser + PDF',
            count: totalRecordings,
            icon: Upload,
            color: 'text-sky-600 dark:text-[#00F2FE]',
          },
          {
            key: 'assessments' as const,
            title: 'Assessments',
            sub: 'Homework, Quiz & Exam',
            count: totalAssessments,
            icon: Award,
            color: 'text-amber-600 dark:text-amber-400',
          },
          {
            key: 'courses' as const,
            title: 'My Courses',
            sub: 'Curriculum & Syllabi',
            count: courses.length,
            icon: BookOpen,
            color: 'text-indigo-600 dark:text-indigo-400',
          },
          {
            key: 'profile' as const,
            title: 'Faculty Profile',
            sub: 'Photo & Credentials',
            count: undefined,
            icon: UserIcon,
            color: 'text-slate-600 dark:text-slate-300',
          },
        ].map((box) => {
          const Icon = box.icon;
          const active = activeTab === box.key;
          return (
            <button
              key={box.key}
              type="button"
              onClick={() => {
                if (box.key === 'assessments') {
                  setAssessmentNavState({
                    subTab: 'homework',
                    courseFilter: 'all',
                    statusFilter: 'all',
                  });
                } else if (box.key === 'engagement') {
                  void fetchPortalSubmissions();
                }
                setActiveTab(box.key);
              }}
              className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                active
                  ? 'bg-sky-50 dark:bg-[#0B192C] border-sky-500 dark:border-[#00F2FE] shadow-md'
                  : 'bg-white dark:bg-[#0B192C]/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-5 h-5 ${box.color}`} />
                {box.count !== undefined && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {box.count}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {box.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {box.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* DEDICATED ENGAGEMENT DASHBOARD SECTION */}
      {activeTab === 'engagement' && (
        <TeacherEngagementDashboard
          currentUser={currentUser}
          courses={courses}
          submissions={submissions}
          loadingSubmissions={loadingSubmissions}
          onRefreshSubmissions={fetchPortalSubmissions}
          onReviewSubmissions={(courseId, status = 'submitted') => {
            setAssessmentNavState({
              subTab: 'submissions',
              courseFilter: courseId,
              statusFilter: status,
            });
            setActiveTab('assessments');
          }}
          onSelectCourse={onSelectCourse}
          onOpenCreateCourse={() => {
            setCError(null);
            setActiveTab('courses');
            setShowCreateCourseModal(true);
          }}
          onOpenCreateAssessment={() => {
            setAssessmentNavState({
              subTab: 'homework',
              courseFilter: 'all',
              statusFilter: 'all',
            });
            setActiveTab('assessments');
          }}
        />
      )}

      {/* TAB 1: LIVE CLASSES & AUTO-GENERATED CLASSROOM LINKS */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scheduler Box */}
          <form
            onSubmit={handleScheduleClassSubmit}
            className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Create Live Class / Event (Auto-Link)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pick date, day, and time — a live sanctuary link &amp; passcode will be generated automatically and shown on students&apos; portals.
              </p>
            </div>

            {evSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300">
                {evSuccessMsg}
              </div>
            )}
            {evErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300">
                {evErrorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Class / Event Title *
              </label>
              <input
                type="text"
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="e.g. Live Nahw Syntax Workshop"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Course
              </label>
              <select
                value={evCourseId}
                onChange={(e) => setEvCourseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">General Academy Session</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={evDateStr}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Day *
                </label>
                <select
                  value={evDayOfWeek}
                  onChange={(e) => setEvDayOfWeek(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Time *
                </label>
                <input
                  type="time"
                  required
                  value={evTimeStr}
                  onChange={(e) => setEvTimeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Location / Format Label
              </label>
              <input
                type="text"
                value={evLocation}
                onChange={(e) => setEvLocation(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Session Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={evDescription}
                onChange={(e) => setEvDescription(e.target.value)}
                placeholder="Topics to prepare..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={evAutoRecord}
                onChange={(e) => setEvAutoRecord(e.target.checked)}
                className="rounded"
              />
              <span>Enable Auto-Recording to Course Recordings</span>
            </label>

            <button
              type="submit"
              disabled={evSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>
                {evSubmitting ? 'Generating Link...' : 'Create Class & Auto-Generate Meeting Link'}
              </span>
            </button>
          </form>

          {/* Scheduled Classes & Host Start Meeting Cards */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Live Classroom Sessions (Host Controls)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click &quot;Start Meeting (Host)&quot; to open your live instructor room and record directly into Course Recordings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
              {customLiveEvents.map((ev) => {
                const local = formatToLocalTime(ev.startUtc, ev.dayOfWeek);
                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                          {ev.courseTitle || 'Academy Event'}
                        </span>
                        {ev.isLiveNow && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                            <Radio className="w-3 h-3 animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ev.title}
                      </h4>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Instructor: {ev.instructorName || `${currentUser.firstName} ${currentUser.lastName}`}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        {ev.dateStr || local.localDayStr} · {local.localTimeStr}
                      </div>
                      {ev.meetingId && (
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
                          <span className="truncate text-slate-700 dark:text-slate-300">
                            ID: {ev.meetingId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyInvite(ev.id, ev.meetingId!)}
                            className="text-sky-600 dark:text-[#00F2FE] inline-flex items-center gap-1 ml-2 shrink-0"
                            title="Copy invite URL"
                          >
                            {copiedId === ev.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onStartMeeting({
                            mode: 'host',
                            title: ev.title,
                            courseId: ev.courseId,
                            courseTitle: ev.courseTitle,
                            eventId: ev.id,
                            instructorName:
                              ev.instructorName ||
                              `${currentUser.firstName} ${currentUser.lastName}`,
                            meetingId: ev.meetingId || `DHA-${Date.now().toString().slice(-6)}`,
                            meetingPasscode: ev.meetingPasscode || '78699',
                            joinUrl: ev.joinUrl,
                          })
                        }
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Start Meeting (Host)</span>
                      </button>

                      {onDeleteEvent && (
                        <button
                          type="button"
                          onClick={() => void onDeleteEvent(ev.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                          title="Delete scheduled event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Also show Course Schedules */}
              {courses.flatMap((c) =>
                (c.schedules || []).map((sch) => {
                  const local = formatToLocalTime(sch.timeUtc, sch.dayOfWeek);
                  return (
                    <div
                      key={`${c.id}-${sch.id}`}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-[#00F2FE] font-bold">
                          {c.code} Schedule
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {sch.title}
                        </h4>
                        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Instructor: {sch.instructorName || c.instructorName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                          {sch.dateStr ? `${sch.dateStr} · ` : ''}
                          {local.localDayStr} · {local.localTimeStr}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Meeting ID: {sch.zoomMeetingId}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onStartMeeting({
                            mode: 'host',
                            title: sch.title,
                            courseId: c.id,
                            courseTitle: c.title,
                            scheduleId: sch.id,
                            instructorName:
                              sch.instructorName ||
                              `${currentUser.firstName} ${currentUser.lastName}`,
                            meetingId: sch.zoomMeetingId,
                            meetingPasscode: sch.zoomPasscode,
                            joinUrl: sch.zoomJoinUrl,
                          })
                        }
                        className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Start Meeting (Host)</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 4-STEP LECTURE UPLOAD + SUPPLEMENTARY MATERIALS PDF */}
      {activeTab === 'recordings' && (
        <div className="space-y-6">
          <form
            onSubmit={handlePublishRecording}
            className="p-6 rounded-3xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Lecture Recording + Teaser + Supplementary Materials (PDF)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Teaser &amp; Lecture automatically join cleanly; optional PDF is downloadable by enrolled students.
                </p>
              </div>
              <select
                value={recCourseId}
                onChange={(e) => setRecCourseId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            {recSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{recSuccess}</span>
              </div>
            )}
            {recError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300">
                {recError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="e.g. Lesson 04: Al-Ajrumiyyah Nominal Sentences"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  value={recDuration}
                  onChange={(e) => setRecDuration(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 4-Card Grid for Thumbnail, Teaser, Full Lecture, Supplementary PDF */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1: Thumbnail */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Step 1: Lecture Thumbnail
                  </span>
                  <label className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    {thumbPct !== null ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{thumbPct !== null ? `${thumbPct}%` : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleThumbUpload}
                      disabled={thumbPct !== null}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={recThumbnailUrl}
                  onChange={(e) => setRecThumbnailUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Step 2: Teaser MP4 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Step 2: Video Teaser (.MP4)
                  </span>
                  <label className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    {teaserPct !== null ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{teaserPct !== null ? `${teaserPct}%` : 'Upload Teaser'}</span>
                    <input
                      type="file"
                      accept="video/mp4,.mp4"
                      onChange={handleTeaserUpload}
                      disabled={teaserPct !== null}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={recTeaserStoragePath || recTeaserUrl}
                  onChange={(e) => setRecTeaserUrl(e.target.value)}
                  placeholder="Optional teaser stream URL"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Step 3: Full Lecture MP4 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Step 3: Full Lecture (.MP4)
                  </span>
                  <label className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    {videoPct !== null ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{videoPct !== null ? `${videoPct}%` : 'Upload Lecture'}</span>
                    <input
                      type="file"
                      accept="video/mp4,.mp4"
                      onChange={handleLectureUpload}
                      disabled={videoPct !== null}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={recStoragePath || recVideoUrl}
                  onChange={(e) => setRecVideoUrl(e.target.value)}
                  placeholder="Upload MP4 above or paste URL"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Step 4: Optional Supplementary Materials PDF */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-dashed border-sky-300 dark:border-sky-500/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-[#00F2FE]" />
                    <span>Step 4: Supplementary Materials (PDF · Optional)</span>
                  </span>
                  <label className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    {pdfUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{pdfUploading ? 'Uploading...' : recPdfUrl ? 'Replace PDF' : 'Upload PDF'}</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfUpload}
                      disabled={pdfUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {recPdfName
                    ? `Attached PDF: ${recPdfName}`
                    : 'Optional study notes or slides (.pdf) downloadable by enrolled students.'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRecIsOrientation((v) => !v)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071120] text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2"
              >
                {recIsOrientation ? (
                  <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>
                  {recIsOrientation
                    ? 'Access: Public Orientation (Free Preview)'
                    : 'Access: Enrolled Cohort Only'}
                </span>
              </button>

              <button
                type="submit"
                disabled={
                  recSubmitting ||
                  pdfUploading ||
                  thumbPct !== null ||
                  teaserPct !== null ||
                  videoPct !== null
                }
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{recSubmitting ? 'Saving Permanently...' : 'Save Lecture Archive'}</span>
              </button>
            </div>
          </form>

          {/* Existing Recordings Grid */}
          {activeRecCourse && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Saved Lectures in {activeRecCourse.code} ({activeRecCourse.videoArchives.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeRecCourse.videoArchives.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveMediaSrc(rec.thumbnailUrl || activeRecCourse.thumbnail, 'course')}
                        alt={rec.title}
                        referrerPolicy="no-referrer"
                        className="w-20 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {rec.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {rec.duration} · {rec.isOrientation ? 'Orientation' : 'Private'}
                          {rec.supplementaryPdfUrl ? ' · PDF Attached' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onUpdateRecording && (
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateRecording(activeRecCourse.id, rec.id, {
                              isOrientation: !rec.isOrientation,
                            })
                          }
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          title="Toggle Orientation/Private"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteRecording && (
                        <button
                          type="button"
                          onClick={() => void onDeleteRecording(activeRecCourse.id, rec.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                          title="Delete recording"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSESSMENTS STUDIO */}
      {activeTab === 'assessments' && (
        <AssessmentsStudio
          courses={courses}
          onCoursesUpdated={onCoursesUpdated}
          defaultSubTab={assessmentNavState.subTab}
          defaultCourseFilter={assessmentNavState.courseFilter}
          defaultStatusFilter={assessmentNavState.statusFilter}
        />
      )}

      {/* TAB 4: COURSES OVERVIEW & INSTRUCTOR LIMIT CONTROLS */}
      {activeTab === 'courses' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Course Catalog &amp; Cohort Limits ($0 Free Tuition)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publish courses and adjust per-course Student Capacity &amp; Time Limit cutoffs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCError(null);
                setShowCreateCourseModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Create Course</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => {
              const cap = Math.max(1, c.maxSpots ?? 50);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="h-36 relative">
                      <img
                        src={resolveMediaSrc(c.thumbnail, 'course')}
                        alt={c.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-950/80 text-[#00F2FE] font-mono text-[10px] font-bold">
                        {c.code}
                      </span>
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-emerald-500/90 text-white font-mono text-[10px] font-bold">
                        Fee: $0
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {c.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono tabular-nums">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                            Student Limit
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                            {c.enrolledStudentIds.length} / {cap}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#10B981]" />
                            Duration
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                            {c.durationLabel || '12 Weeks'}
                          </div>
                        </div>
                      </div>
                      {c.enrollmentDeadlineUtc && (
                        <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] tabular-nums">
                          Deadline: {formatToLocalTime(c.enrollmentDeadlineUtc).localTimeStr}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRecCourseId(c.id);
                          setActiveTab('recordings');
                        }}
                        className="text-xs font-semibold text-sky-700 dark:text-[#00F2FE] hover:underline whitespace-nowrap"
                      >
                        Upload Lecture
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditCourseLimits(c)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-300 hover:underline whitespace-nowrap"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Set Limits</span>
                      </button>
                    </div>
                    {onSelectCourse && (
                      <button
                        type="button"
                        onClick={() => onSelectCourse(c)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        <span>Open Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: PROFILE */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-2xl space-y-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full p-1 bg-gradient-to-tr from-[#00F2FE]/70 to-[#10B981]/70 shadow-md shrink-0">
              <div className="rounded-full p-0.5 bg-white dark:bg-[#0B192C]">
                <SymbolicAvatar
                  gender={currentUser.gender}
                  avatarUrl={currentUser.avatarUrl}
                  name={`${currentUser.firstName} ${currentUser.lastName}`}
                  size="xl"
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentUser.firstName} {currentUser.lastName}
              </h3>
              <p className="text-xs font-mono text-slate-500">{currentUser.email}</p>
              <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{avatarPct !== null ? `Uploading ${avatarPct}%` : 'Update Faculty Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  disabled={avatarPct !== null}
                  className="hidden"
                />
              </label>
              {avatarErr && <p className="text-xs text-rose-500 mt-1">{avatarErr}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500">Institutional Role</div>
              <div className="font-bold text-slate-900 dark:text-white capitalize mt-0.5">
                {currentUser.role}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071120] border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500">Hosting Permissions</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Host Live Classrooms &amp; Assessments Enabled
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* INSTRUCTOR EDIT STUDENT & TIME LIMITS MODAL */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-700 p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase text-[#0284C7] dark:text-[#00F2FE]">
                  {editingCourse.code} · Instructor Course Limits
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {editingCourse.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingCourse(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInstructorCourseLimits} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Limit (Max Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    required
                    value={eMaxSpots}
                    onChange={(e) => setEMaxSpots(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Duration / Time Limit
                  </label>
                  <input
                    type="text"
                    required
                    value={eDurationLabel}
                    onChange={(e) => setEDurationLabel(e.target.value)}
                    placeholder="e.g. 12 Weeks · 90 min/wk"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enrollment Time Limit / Cutoff
                  </label>
                  <input
                    type="datetime-local"
                    value={eDeadlineLocal}
                    onChange={(e) => setEDeadlineLocal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enrollment Status
                  </label>
                  <select
                    value={eStatus}
                    onChange={(e) => setEStatus(e.target.value as Course['status'])}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Open for Enrollment">Open for Enrollment</option>
                    <option value="Active">Active</option>
                    <option value="Coming Soon">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Scheduled Lectures
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={eLectures}
                  onChange={(e) => setELectures(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              {eError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200">
                  {eError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eBusy}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 disabled:opacity-50"
                >
                  {eBusy ? 'Saving...' : 'Save Limits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSTRUCTOR CREATE COURSE MODAL */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-700 p-6 space-y-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase text-[#0284C7] dark:text-[#00F2FE]">
                  Faculty Course Publisher · Free ($0)
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Create New Course Cohort
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInstructorCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="e.g. Seerah: Deep Understanding"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={cCode}
                    onChange={(e) => setCCode(e.target.value)}
                    placeholder="DHA-SRH2"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Course Explanation &amp; Syllabus Overview <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder="Describe what students will learn, methodology, and key texts..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Level
                  </label>
                  <select
                    value={cLevel}
                    onChange={(e) => setCLevel(e.target.value as Course['level'])}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Lectures
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={cLectures}
                    onChange={(e) => setCLectures(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={cMaxSpots}
                    onChange={(e) => setCMaxSpots(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Time Span)
                  </label>
                  <input
                    type="text"
                    value={cDurationLabel}
                    onChange={(e) => setCDurationLabel(e.target.value)}
                    placeholder="e.g. 12 Weeks"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registration Cutoff (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={cDeadlineLocal}
                    onChange={(e) => setCDeadlineLocal(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {cError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200">
                  {cError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cBusy}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 disabled:opacity-50"
                >
                  {cBusy ? 'Publishing...' : 'Publish Free Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
