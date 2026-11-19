import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  BookOpen,
  Users,
  Video,
  FileText,
  AlertTriangle,
  Settings,
  Trash2,
  Edit3,
  CheckCircle2,
  Calendar,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Upload,
  ArrowRight,
  Menu,
  Lock,
  Unlock,
  Play,
  Loader2,
  Pin,
  MapPin,
  Image as ImageIcon,
  Award,
  UserPlus,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import type {
  Course,
  User,
  ModerationLog,
  PlatformSettings,
  AcademicAssessment,
  AssessmentType,
  CustomNavItem,
  CompletedVideoArchive,
  CalendarEvent,
  UserGender,
} from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { AssessmentsStudio } from './AssessmentsStudio';
import { LiveSessionContext } from './LiveClassroomModal';
import { auth, googleProvider, signInWithPopup, getFirebaseIdToken } from '../firebase';
import {
  CHANCELLOR_EMAIL,
  formatFirebaseAuthError,
  getAuthHeaders,
  isFirebaseChancellorSignedIn,
  syncUserProfileToFirestore,
  uploadAssetSmart,
  uploadMp4VideoSmart,
  uploadPdfDocumentSmart,
} from '../services/firebaseService';
import { resolveMediaSrc } from '../assets/fallbacks';
import { formatToLocalTime } from '../utils/timezone';

interface AdminPortalProps {
  currentUser: User | null;
  courses: Course[];
  users: User[];
  events: CalendarEvent[];
  moderationLogs: ModerationLog[];
  settings: PlatformSettings;
  onUpdateSettings: (newSettings: Partial<PlatformSettings>) => Promise<void>;
  onCreateCourse: (courseData: Partial<Course>) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
  onCoursesUpdated: (courses: Course[]) => void;
  onOpenStudentViewer: (courseId: string, studentId: string) => void;
  onTriggerZoomWebhook: (courseId: string) => Promise<void>;
  onReviewModerationLog: (logId: string) => Promise<void>;
  onSeedSample: () => Promise<void>;
  onToggleStudentTester?: () => void;
  onDeleteUser?: (userId: string) => Promise<void>;
  onAddRecording?: (courseId: string, recData: {
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
  }) => Promise<void>;
  onUpdateRecording?: (
    courseId: string,
    recId: string,
    patch: Partial<CompletedVideoArchive>
  ) => Promise<void>;
  onDeleteRecording?: (courseId: string, recId: string) => Promise<void>;
  onUpdateNavItems?: (items: CustomNavItem[]) => Promise<void>;
  onCreateEvent?: (eventData: Partial<CalendarEvent>) => Promise<CalendarEvent | void>;
  onTogglePinEvent?: (id: string, pinned: boolean) => Promise<void>;
  onDeleteEvent?: (id: string) => Promise<void>;
  onPreviewPinBoard?: () => void;
  onStartMeeting?: (session: LiveSessionContext) => void;
  onRefreshData?: () => Promise<void>;
  adminSessionToken?: string | null;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  courses,
  users,
  events,
  moderationLogs,
  settings,
  onUpdateSettings,
  onCreateCourse,
  onDeleteCourse,
  onCoursesUpdated,
  onOpenStudentViewer,
  onTriggerZoomWebhook,
  onReviewModerationLog,
  onSeedSample,
  onToggleStudentTester,
  onDeleteUser,
  onAddRecording,
  onUpdateRecording,
  onDeleteRecording,
  onUpdateNavItems,
  onCreateEvent,
  onTogglePinEvent,
  onDeleteEvent,
  onPreviewPinBoard,
  onStartMeeting,
  onRefreshData,
  adminSessionToken,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'courses'
    | 'recordings'
    | 'assessments'
    | 'events'
    | 'roster'
    | 'nav'
    | 'moderation'
    | 'zoom'
    | 'settings'
  >('courses');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || '');
  const [adminSecretKey, setAdminSecretKey] = useState('');

  const handleCopyAdmin = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Course Form State
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState('Mustaqeem Shaikh');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [status, setStatus] = useState<'Open for Enrollment' | 'Active' | 'Coming Soon'>('Open for Enrollment');
  const [thumbnail, setThumbnail] = useState('fallback://course');
  const [totalLectures, setTotalLectures] = useState(12);
  const [maxSpots, setMaxSpots] = useState(50);
  const [durationLabel, setDurationLabel] = useState('12 Weeks');
  const [enrollmentDeadlineLocal, setEnrollmentDeadlineLocal] = useState('');
  const [courseThumbUploadPct, setCourseThumbUploadPct] = useState<number | null>(null);
  const [courseCreateError, setCourseCreateError] = useState<string | null>(null);

  // Per-course Limit & Duration Editor Modal
  const [editingCourseLimits, setEditingCourseLimits] = useState<Course | null>(null);
  const [editMaxSpots, setEditMaxSpots] = useState(50);
  const [editDurationLabel, setEditDurationLabel] = useState('12 Weeks');
  const [editDeadlineLocal, setEditDeadlineLocal] = useState('');
  const [editTotalLectures, setEditTotalLectures] = useState(12);
  const [editStatus, setEditStatus] = useState<Course['status']>('Open for Enrollment');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Assessment creation state inside course
  const [newAssessmentType, setNewAssessmentType] = useState<AssessmentType>('homework');
  const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
  const [newAssessmentPoints, setNewAssessmentPoints] = useState(50);

  // Hero settings state
  const [heroMode, setHeroMode] = useState(settings.heroMode);
  const [heroVideoUrl, setHeroVideoUrl] = useState(settings.heroVideoUrl);
  const [heroPosterUrl, setHeroPosterUrl] = useState(settings.heroPosterUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl);
  const [heroHeadline, setHeroHeadline] = useState(settings.heroHeadline);
  const [heroSubheadline, setHeroSubheadline] = useState(settings.heroSubheadline);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [heroUploadState, setHeroUploadState] = useState<{ kind: string; pct: number } | null>(null);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);

  // Recording Management State (4 steps including optional Supplementary PDF)
  const [recCourseId, setRecCourseId] = useState(courses[0]?.id || '');
  const [pendingRecId, setPendingRecId] = useState(() => `rec-${Date.now()}`);
  const [recTitle, setRecTitle] = useState('');
  const [recVideoUrl, setRecVideoUrl] = useState('');
  const [recStoragePath, setRecStoragePath] = useState('');
  const [recFileSize, setRecFileSize] = useState('');
  const [recTeaserUrl, setRecTeaserUrl] = useState('');
  const [recTeaserStoragePath, setRecTeaserStoragePath] = useState('');
  const [recTeaserFileSize, setRecTeaserFileSize] = useState('');
  const [recThumbnailUrl, setRecThumbnailUrl] = useState('fallback://course');
  const [recThumbnailStoragePath, setRecThumbnailStoragePath] = useState('');
  const [recSuppPdfUrl, setRecSuppPdfUrl] = useState('');
  const [recSuppPdfName, setRecSuppPdfName] = useState('');
  const [recSuppPdfStoragePath, setRecSuppPdfStoragePath] = useState('');
  const [recDuration, setRecDuration] = useState('45 min');
  const [recIsOrientation, setRecIsOrientation] = useState(false);
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [videoUploadPct, setVideoUploadPct] = useState<number | null>(null);
  const [teaserUploadPct, setTeaserUploadPct] = useState<number | null>(null);
  const [thumbUploadPct, setThumbUploadPct] = useState<number | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [recUploadError, setRecUploadError] = useState<string | null>(null);
  const [updatingRecId, setUpdatingRecId] = useState<string | null>(null);
  const [fbChancellorReady, setFbChancellorReady] = useState<boolean>(() => isFirebaseChancellorSignedIn());
  const [fbAuthBusy, setFbAuthBusy] = useState(false);

  // Events & Live Classroom Scheduler state (Date, Day, Time + Instructor)
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [evTitle, setEvTitle] = useState('');
  const [evDateStr, setEvDateStr] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [evDayOfWeek, setEvDayOfWeek] = useState(() => DAYS_OF_WEEK[new Date(Date.now() + 86400000).getDay()]);
  const [evTimeStr, setEvTimeStr] = useState('14:00');
  const [evLocation, setEvLocation] = useState('Live Online Sanctuary');
  const [evDescription, setEvDescription] = useState('');
  const [evPinColor, setEvPinColor] = useState<'aqua' | 'emerald' | 'crimson' | 'amber'>('aqua');
  const [evCourseId, setEvCourseId] = useState('');
  const [evInstructorId, setEvInstructorId] = useState('admin-mustaqeem');
  const [evPosterUrl, setEvPosterUrl] = useState('');
  const [evPinned, setEvPinned] = useState(true);
  const [evAutoRecord, setEvAutoRecord] = useState(true);
  const [evThumbPct, setEvThumbPct] = useState<number | null>(null);
  const [evSubmitting, setEvSubmitting] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [evSavedNotice, setEvSavedNotice] = useState(false);

  // Teacher Account Creation State
  const [teachersList, setTeachersList] = useState<User[]>([]);
  const [tFirstName, setTFirstName] = useState('');
  const [tLastName, setTLastName] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tPassword, setTPassword] = useState('');
  const [tGender, setTGender] = useState<UserGender>('male');
  const [tSubmitting, setTSubmitting] = useState(false);
  const [tError, setTError] = useState<string | null>(null);
  const [tSuccess, setTSuccess] = useState<string | null>(null);

  // Nav items management state
  const [navItems, setNavItems] = useState<CustomNavItem[]>(settings.customNavItems || []);
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavKey, setNewNavKey] = useState('');

  // Delete user confirmation state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const effectiveRecCourseId = recCourseId || courses[0]?.id || '';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setFbChancellorReady(isFirebaseChancellorSignedIn());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let active = true;
    (async () => {
      try {
        const idToken = await getFirebaseIdToken();
        const headers: Record<string, string> = {};
        if (idToken) headers.Authorization = `Bearer ${idToken}`;
        if (adminSessionToken) headers['x-admin-session'] = adminSessionToken;
        if (!headers.Authorization && !headers['x-admin-session']) return;

        const res = await fetch('/api/admin/credentials', { headers });
        if (res.ok && active) {
          const data = await res.json();
          if (data.email) setAdminEmail(data.email);
          if (data.secretKey) setAdminSecretKey(data.secretKey);
        }
      } catch {
        // Ignore if credential inspector session not present
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.role, adminSessionToken, fbChancellorReady]);

  useEffect(() => {
    if (settings.customNavItems) {
      setNavItems(settings.customNavItems);
    }
  }, [settings.customNavItems]);

  useEffect(() => {
    setHeroMode(settings.heroMode);
    setHeroVideoUrl(settings.heroVideoUrl || '');
    setHeroPosterUrl(settings.heroPosterUrl || '');
    setHeroImageUrl(settings.heroImageUrl || '');
    setHeroHeadline(settings.heroHeadline || '');
    setHeroSubheadline(settings.heroSubheadline || '');
  }, [
    settings.heroMode,
    settings.heroVideoUrl,
    settings.heroPosterUrl,
    settings.heroImageUrl,
    settings.heroHeadline,
    settings.heroSubheadline,
  ]);

  useEffect(() => {
    let active = true;
    fetch('/api/teachers')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (active && Array.isArray(list)) setTeachersList(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [users]);

  useEffect(() => {
    if (!recCourseId && courses[0]?.id) {
      setRecCourseId(courses[0].id);
    }
  }, [courses, recCourseId]);

  const handleCourseThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCourseCreateError(null);
    setCourseThumbUploadPct(10);
    try {
      const { url } = await uploadAssetSmart('course_thumbnail', file, (pct) =>
        setCourseThumbUploadPct(pct)
      );
      setThumbnail(url);
      setCourseThumbUploadPct(null);
    } catch (err: unknown) {
      setCourseThumbUploadPct(null);
      setCourseCreateError(
        err instanceof Error ? err.message : 'Unable to upload course cover thumbnail.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCourseCreateError(null);
    setIsSubmitting(true);
    try {
      await onCreateCourse({
        title,
        code: code || `DHA-${Math.floor(100 + Math.random() * 900)}`,
        description,
        instructorName,
        level,
        status,
        thumbnail,
        totalLectures: Number(totalLectures) || 12,
        maxSpots: Math.max(1, Number(maxSpots) || 50),
        durationLabel: durationLabel.trim() || '12 Weeks',
        enrollmentDeadlineUtc: enrollmentDeadlineLocal
          ? new Date(enrollmentDeadlineLocal).toISOString()
          : '',
        modules: [
          {
            id: `mod-${Date.now()}-1`,
            title: 'Module 1: Foundations & Scholastic Orientation',
            description: 'Core methodological principles and historical lineage.',
            learningObjectives: ['Introduction to canonical terminology', 'Primary text overview'],
            instructorNotes: 'Prepare notes before weekly live session.',
            lecturesCount: 3,
          },
        ],
        schedules: [
          {
            id: `sch-${Date.now()}`,
            title: 'Weekly Live Cohort Lecture',
            dayOfWeek: 'Saturday',
            timeUtc: '14:00',
            durationMinutes: 90,
            zoomMeetingId: `${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
            zoomPasscode: '78699',
            zoomJoinUrl: 'https://zoom.us/j/sample786',
            zoomStartUrl: 'https://zoom.us/s/sample786',
            isLiveNow: true,
            recordingStatus: 'synced',
          },
        ],
        assignments: [
          {
            id: `ass-${Date.now()}`,
            courseId: '',
            title: newAssessmentTitle || 'Initial Cohort Homework Assignment',
            description: 'Submit preliminary scholarly reflections and reading notes.',
            type: newAssessmentType,
            dueDateUtc: new Date(Date.now() + 86400000 * 5).toISOString(),
            points: Number(newAssessmentPoints) || 50,
          },
        ],
      });

      setShowCreateModal(false);
      setTitle('');
      setCode('');
      setDescription('');
      setMaxSpots(50);
      setDurationLabel('12 Weeks');
      setEnrollmentDeadlineLocal('');
      setThumbnail('fallback://course');
    } catch (err: unknown) {
      setCourseCreateError(err instanceof Error ? err.message : 'Failed to publish course.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditCourseLimits = (c: Course) => {
    setEditingCourseLimits(c);
    setEditMaxSpots(Math.max(1, Number(c.maxSpots) || 50));
    setEditDurationLabel(c.durationLabel || '12 Weeks');
    setEditTotalLectures(c.totalLectures || 12);
    setEditStatus(c.status);
    setEditError(null);
    if (c.enrollmentDeadlineUtc) {
      const parsed = new Date(c.enrollmentDeadlineUtc);
      if (!Number.isNaN(parsed.getTime())) {
        const localIso = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setEditDeadlineLocal(localIso);
      } else {
        setEditDeadlineLocal('');
      }
    } else {
      setEditDeadlineLocal('');
    }
  };

  const handleSaveCourseLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseLimits) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/courses/${editingCourseLimits.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          maxSpots: Math.max(1, Number(editMaxSpots) || 50),
          durationLabel: editDurationLabel.trim() || '12 Weeks',
          enrollmentDeadlineUtc: editDeadlineLocal
            ? new Date(editDeadlineLocal).toISOString()
            : '',
          totalLectures: Math.max(1, Number(editTotalLectures) || 12),
          status: editStatus,
        }),
      });
      const updated = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(updated?.error || 'Unable to update course limits.');
      }
      onCoursesUpdated(
        courses.map((item) => (item.id === editingCourseLimits.id ? updated : item))
      );
      setEditingCourseLimits(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Unable to save course limits.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleConnectChancellorGoogle = async (): Promise<boolean> => {
    setFbAuthBusy(true);
    setRecUploadError(null);
    setHeroUploadError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const parts = (fbUser.displayName || 'Mustaqeem Chancellor').split(' ');
      const isChancellor = fbUser.email?.toLowerCase() === CHANCELLOR_EMAIL;
      await syncUserProfileToFirestore({
        id: fbUser.uid,
        firstName: parts[0] || 'Mustaqeem',
        lastName: parts.slice(1).join(' ') || 'Admin',
        email: fbUser.email || '',
        role: isChancellor ? 'admin' : 'student',
        gender: 'male',
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
      });
      const ready = isFirebaseChancellorSignedIn();
      setFbChancellorReady(ready);
      if (!ready) {
        const msg = `Signed in as ${fbUser.email || 'unknown account'}. Mustaqeem's verified Google account (${CHANCELLOR_EMAIL}) is required for Firebase Storage uploads.`;
        setRecUploadError(msg);
        setHeroUploadError(msg);
      }
      return ready;
    } catch (err: unknown) {
      const msg = formatFirebaseAuthError(err, 'Google authentication canceled or failed.');
      setRecUploadError(msg);
      setHeroUploadError(msg);
      return false;
    } finally {
      setFbAuthBusy(false);
    }
  };

  const handleMp4FileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveRecCourseId) return;
    setRecUploadError(null);
    setVideoUploadPct(1);
    try {
      const { streamUrl, storagePath, fileSize } = await uploadMp4VideoSmart(
        'course_recording',
        file,
        {
          courseId: effectiveRecCourseId,
          recordingId: pendingRecId,
          isOrientation: recIsOrientation,
        },
        (pct) => setVideoUploadPct(pct)
      );
      setRecStoragePath(storagePath || '');
      setRecVideoUrl(streamUrl || '');
      setRecFileSize(fileSize);
      setVideoUploadPct(null);
    } catch (err: unknown) {
      setVideoUploadPct(null);
      setRecUploadError(err instanceof Error ? err.message : 'Unable to upload .mp4 recording.');
    } finally {
      e.target.value = '';
    }
  };

  const handleThumbnailFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveRecCourseId) return;
    setRecUploadError(null);
    setThumbUploadPct(1);
    try {
      const { url, storagePath } = await uploadAssetSmart(
        'recording_thumbnail',
        file,
        (pct) => setThumbUploadPct(pct),
        { courseId: effectiveRecCourseId, recordingId: pendingRecId }
      );
      setRecThumbnailUrl(url);
      setRecThumbnailStoragePath(storagePath);
      setThumbUploadPct(null);
    } catch (err: unknown) {
      setThumbUploadPct(null);
      setRecUploadError(err instanceof Error ? err.message : 'Unable to upload thumbnail.');
    } finally {
      e.target.value = '';
    }
  };

  const handleTeaserMp4FileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveRecCourseId) return;
    setRecUploadError(null);
    setTeaserUploadPct(1);
    try {
      const { streamUrl, storagePath, fileSize } = await uploadMp4VideoSmart(
        'course_teaser',
        file,
        {
          courseId: effectiveRecCourseId,
          recordingId: pendingRecId,
          isOrientation: true,
        },
        (pct) => setTeaserUploadPct(pct)
      );
      setRecTeaserStoragePath(storagePath || '');
      setRecTeaserUrl(streamUrl || '');
      setRecTeaserFileSize(fileSize);
      setTeaserUploadPct(null);
    } catch (err: unknown) {
      setTeaserUploadPct(null);
      setRecUploadError(err instanceof Error ? err.message : 'Unable to upload video teaser.');
    } finally {
      e.target.value = '';
    }
  };

  const handleExistingRecordingThumbUpload = async (
    courseId: string,
    recId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateRecording) return;
    setRecUploadError(null);
    setUpdatingRecId(recId);
    try {
      const { url, storagePath } = await uploadAssetSmart(
        'recording_thumbnail',
        file,
        undefined,
        { courseId, recordingId: recId }
      );
      await onUpdateRecording(courseId, recId, {
        thumbnailUrl: url,
        thumbnailStoragePath: storagePath,
      });
    } catch (err: unknown) {
      setRecUploadError(
        err instanceof Error ? err.message : 'Unable to update recording thumbnail.'
      );
    } finally {
      setUpdatingRecId(null);
      e.target.value = '';
    }
  };

  const handleToggleRecordingOrientation = async (
    courseId: string,
    rec: CompletedVideoArchive
  ) => {
    if (!onUpdateRecording) return;
    setRecUploadError(null);
    setUpdatingRecId(rec.id);
    try {
      await onUpdateRecording(courseId, rec.id, {
        isOrientation: !rec.isOrientation,
      });
    } catch (err: unknown) {
      setRecUploadError(
        err instanceof Error ? err.message : 'Unable to update recording access.'
      );
    } finally {
      setUpdatingRecId(null);
    }
  };

  const handleBrandingFileUpload = async (
    kind: 'hero_video' | 'hero_poster' | 'hero_image' | 'custom_logo',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploadError(null);
    setHeroUploadState({ kind, pct: 1 });
    try {
      let downloadUrl = '';
      if (kind === 'hero_video') {
        const res = await uploadMp4VideoSmart('hero_video', file, {}, (pct) =>
          setHeroUploadState({ kind, pct })
        );
        downloadUrl = res.streamUrl;
      } else {
        const res = await uploadAssetSmart(kind, file, (pct) =>
          setHeroUploadState({ kind, pct })
        );
        downloadUrl = res.url;
      }

      if (kind === 'hero_video') {
        setHeroVideoUrl(downloadUrl);
        setHeroMode('video');
        await onUpdateSettings({ heroVideoUrl: downloadUrl, heroMode: 'video' });
      } else if (kind === 'hero_poster') {
        setHeroPosterUrl(downloadUrl);
        await onUpdateSettings({ heroPosterUrl: downloadUrl });
      } else if (kind === 'hero_image') {
        setHeroImageUrl(downloadUrl);
        await onUpdateSettings({ heroImageUrl: downloadUrl });
      } else if (kind === 'custom_logo') {
        await onUpdateSettings({ customLogoUrl: downloadUrl });
      }
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      setHeroUploadState(null);
    } catch (err: unknown) {
      setHeroUploadState(null);
      setHeroUploadError(err instanceof Error ? err.message : 'Branding asset upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroUploadError(null);
    try {
      await onUpdateSettings({
        heroMode,
        heroVideoUrl,
        heroPosterUrl,
        heroImageUrl,
        heroHeadline,
        heroSubheadline,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: unknown) {
      setHeroUploadError(err instanceof Error ? err.message : 'Failed to save platform settings.');
    }
  };

  const handleEventPosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvError(null);
    setEvThumbPct(10);
    try {
      const { url } = await uploadAssetSmart('event_poster', file, (pct) => setEvThumbPct(pct));
      setEvPosterUrl(url);
      setEvThumbPct(null);
    } catch (err: unknown) {
      setEvThumbPct(null);
      setEvError(err instanceof Error ? err.message : 'Failed to upload event poster.');
    } finally {
      e.target.value = '';
    }
  };

  const handleEvDateChange = (val: string) => {
    setEvDateStr(val);
    if (val) {
      const parsed = new Date(`${val}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setEvDayOfWeek(DAYS_OF_WEEK[parsed.getDay()]);
      }
    }
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !onCreateEvent) return;
    setEvError(null);
    setEvSubmitting(true);
    try {
      const linkedCourse = courses.find((c) => c.id === evCourseId);
      const selectedTeacher =
        evInstructorId === 'admin-mustaqeem'
          ? { id: 'admin-mustaqeem', name: 'Mustaqeem Shaikh' }
          : (() => {
              const found = teachersList.find((t) => t.id === evInstructorId);
              return found
                ? { id: found.id, name: `${found.firstName} ${found.lastName}`.trim() }
                : { id: 'admin-mustaqeem', name: 'Mustaqeem Shaikh' };
            })();
      const isoStart =
        evDateStr && evTimeStr
          ? new Date(`${evDateStr}T${evTimeStr}:00`).toISOString()
          : new Date().toISOString();

      await onCreateEvent({
        title: evTitle.trim(),
        description: evDescription.trim(),
        posterUrl: evPosterUrl.trim() || undefined,
        courseId: linkedCourse?.id || undefined,
        courseTitle: linkedCourse?.title || undefined,
        dateStr: evDateStr,
        dayOfWeek: evDayOfWeek,
        timeUtc: evTimeStr,
        startUtc: isoStart,
        endUtc: isoStart,
        instructorId: selectedTeacher.id,
        instructorName: selectedTeacher.name,
        autoRecord: evAutoRecord,
        type: 'event',
        pinnedToBoard: evPinned,
        pinColor: evPinColor,
        locationOrLabel: evLocation.trim() || 'Live Online Sanctuary',
      });
      setEvTitle('');
      setEvDescription('');
      setEvPosterUrl('');
      setEvCourseId('');
      setEvSavedNotice(true);
      setTimeout(() => setEvSavedNotice(false), 3500);
    } catch (err: unknown) {
      setEvError(err instanceof Error ? err.message : 'Failed to create event.');
    } finally {
      setEvSubmitting(false);
    }
  };

  const handleSuppPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveRecCourseId) return;
    setRecUploadError(null);
    setPdfUploading(true);
    try {
      const { url, storagePath, fileName } = await uploadPdfDocumentSmart(
        'supplementary_pdf',
        file
      );
      setRecSuppPdfUrl(url);
      setRecSuppPdfName(fileName || file.name);
      setRecSuppPdfStoragePath(storagePath);
    } catch (err: unknown) {
      setRecUploadError(
        err instanceof Error ? err.message : 'Unable to upload Supplementary Materials PDF.'
      );
    } finally {
      setPdfUploading(false);
      e.target.value = '';
    }
  };

  const handleExistingRecordingPdfUpload = async (
    courseId: string,
    recId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateRecording) return;
    setRecUploadError(null);
    setUpdatingRecId(recId);
    try {
      const { url, storagePath, fileName } = await uploadPdfDocumentSmart(
        'supplementary_pdf',
        file
      );
      await onUpdateRecording(courseId, recId, {
        supplementaryPdfUrl: url,
        supplementaryPdfName: fileName || file.name,
        supplementaryPdfStoragePath: storagePath,
      });
    } catch (err: unknown) {
      setRecUploadError(
        err instanceof Error ? err.message : 'Unable to attach Supplementary PDF.'
      );
    } finally {
      setUpdatingRecId(null);
      e.target.value = '';
    }
  };

  const handleAddRecordingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRecCourseId || !recTitle.trim()) return;
    if (!recStoragePath && !recVideoUrl.trim() && !recTeaserUrl.trim()) {
      setRecUploadError('Please complete the lecture upload pipeline: upload thumbnail, teaser, and lecture video.');
      return;
    }
    if (!onAddRecording) return;
    setRecUploadError(null);
    setRecSubmitting(true);
    try {
      await onAddRecording(effectiveRecCourseId, {
        id: pendingRecId,
        title: recTitle,
        videoUrl: recStoragePath ? '' : recVideoUrl.trim(),
        storagePath: recStoragePath || undefined,
        teaserUrl: recTeaserStoragePath ? '' : recTeaserUrl.trim() || undefined,
        teaserStoragePath: recTeaserStoragePath || undefined,
        thumbnailUrl: recThumbnailUrl,
        thumbnailStoragePath: recThumbnailStoragePath || undefined,
        supplementaryPdfUrl: recSuppPdfUrl || undefined,
        supplementaryPdfName: recSuppPdfName || undefined,
        supplementaryPdfStoragePath: recSuppPdfStoragePath || undefined,
        duration: recDuration || '45 min',
        isOrientation: recIsOrientation,
        fileSize: recFileSize || undefined,
      });
      setRecTitle('');
      setRecStoragePath('');
      setRecFileSize('');
      setRecTeaserUrl('');
      setRecTeaserStoragePath('');
      setRecTeaserFileSize('');
      setRecThumbnailStoragePath('');
      setRecThumbnailUrl('fallback://course');
      setRecSuppPdfUrl('');
      setRecSuppPdfName('');
      setRecSuppPdfStoragePath('');
      setPendingRecId(`rec-${Date.now()}`);
      setRecVideoUrl('');
    } catch (err: unknown) {
      setRecUploadError(err instanceof Error ? err.message : 'Failed to save recording.');
    } finally {
      setRecSubmitting(false);
    }
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tFirstName.trim() || !tEmail.trim() || !tPassword.trim()) return;
    setTError(null);
    setTSuccess(null);
    setTSubmitting(true);
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          firstName: tFirstName.trim(),
          lastName: tLastName.trim() || 'Scholar',
          email: tEmail.trim(),
          password: tPassword,
          gender: tGender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create teacher account.');
      }
      const createdTeacher = data?.user || data;
      if (createdTeacher?.id) {
        setTeachersList((prev) => [
          createdTeacher,
          ...prev.filter((u) => u.id !== createdTeacher.id),
        ]);
      }
      setTSuccess(
        `Teacher account created for ${createdTeacher?.email || tEmail.trim()}. They can sign in via Faculty Login.`
      );
      setTFirstName('');
      setTLastName('');
      setTEmail('');
      setTPassword('');
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: unknown) {
      setTError(err instanceof Error ? err.message : 'Unable to create teacher account.');
    } finally {
      setTSubmitting(false);
    }
  };

  const handleAddNavItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNavLabel.trim() || !newNavKey.trim()) return;
    const cleanKey = newNavKey.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const updated = [
      ...navItems,
      {
        id: `nav-${Date.now()}`,
        label: newNavLabel.trim(),
        key: cleanKey,
        isSystem: false,
      },
    ];
    setNavItems(updated);
    if (onUpdateNavItems) {
      await onUpdateNavItems(updated);
    }
    setNewNavLabel('');
    setNewNavKey('');
  };

  const handleDeleteNavItem = async (id: string) => {
    const updated = navItems.filter((i) => i.id !== id);
    setNavItems(updated);
    if (onUpdateNavItems) {
      await onUpdateNavItems(updated);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || !onDeleteUser) return;
    try {
      const targetId = userToDelete.id;
      await onDeleteUser(targetId);
      setTeachersList((prev) => prev.filter((t) => t.id !== targetId));
      setUserToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  const studentsList = users.filter((u) => u.role === 'student');
  const activeRecordingCourse = courses.find((c) => c.id === recCourseId) || courses[0];
  const customEventsList = events.filter((ev) => !ev.isDerived);
  const totalRecordingsCount = courses.reduce(
    (sum, c) => sum + (c.videoArchives?.length || 0),
    0
  );
  const totalLiveSchedulesCount =
    customEventsList.length +
    courses.reduce((sum, c) => sum + (c.schedules?.length || 0), 0);

  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      key:
        | 'courses'
        | 'recordings'
        | 'assessments'
        | 'events'
        | 'roster'
        | 'nav'
        | 'moderation'
        | 'zoom'
        | 'settings';
      label: string;
      sub: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  }> = [
    {
      groupLabel: 'Curriculum & Studio',
      items: [
        { key: 'courses', label: 'Courses', sub: `${courses.length} cohorts`, icon: BookOpen },
        { key: 'recordings', label: 'Recordings & PDF', sub: `${totalRecordingsCount} archives`, icon: Play },
        { key: 'assessments', label: 'Assessments', sub: 'Homework · Quiz · Exam', icon: Award },
      ],
    },
    {
      groupLabel: 'Live & Safety',
      items: [
        { key: 'events', label: 'Events & Live', sub: `${customEventsList.length} sessions`, icon: Pin },
        { key: 'zoom', label: 'Live Sync & Zoom', sub: 'Auto Cloud Recording', icon: Video },
        { key: 'moderation', label: 'Safety Logs', sub: `${moderationLogs.length} events`, icon: AlertTriangle },
      ],
    },
    {
      groupLabel: 'People & Site',
      items: [
        {
          key: 'roster',
          label: 'Teachers & Students',
          sub: `${teachersList.length} faculty · ${studentsList.length} students`,
          icon: Users,
        },
        { key: 'nav', label: 'Navbar Links', sub: `${navItems.length} public tabs`, icon: Menu },
        { key: 'settings', label: 'Hero & Branding', sub: 'Logo · Video · Poster', icon: Settings },
      ],
    },
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Compact Command Header */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-gradient-to-r dark:from-[#0F2942] dark:via-[#0A192F] dark:to-[#071120] border border-slate-200 dark:border-amber-500/30 shadow-sm dark:shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase text-amber-700 dark:text-amber-300">
            <Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>Master Administrative Control Suite</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400">Mustaqeem (Chancellor)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Deen Hijrah Administrative Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Modular command deck for curriculum cohorts, 4-step protected MP4 archives, faculty accounts, live sessions, and site branding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCredentials((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              showCredentials
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-200'
                : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>{showCredentials ? 'Hide Credentials' : 'Credentials'}</span>
          </button>

          {onToggleStudentTester && (
            <button
              type="button"
              onClick={onToggleStudentTester}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-500/40 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Student View</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSeedSample}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
            <span>Quick Seed Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </button>
        </div>
      </div>

      {/* Collapsible Chancellor Credentials Drawer */}
      {showCredentials && (
        <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-gradient-to-r dark:from-slate-950 dark:via-[#1E1B4B]/40 dark:to-slate-950 border border-amber-300 dark:border-amber-500/40 text-xs grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Administrator Mustaqeem Credentials</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40">
                  Private Session
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Official Master Account Email and Secret Access Token
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 font-mono min-w-0">
              <div className="min-w-0 truncate">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] mr-1.5">Email:</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {adminEmail || CHANCELLOR_EMAIL}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyAdmin(adminEmail || CHANCELLOR_EMAIL, 'email')}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0"
                title="Copy Email"
              >
                {copiedKey === 'email' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 font-mono min-w-0">
              <div className="min-w-0 truncate">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] mr-1.5">Key:</span>
                <span className="text-amber-700 dark:text-amber-300 font-bold">
                  {showAdminKey
                    ? adminSecretKey || 'Verify via email/Google sign-in'
                    : '••••••••••••••••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdminKey(!showAdminKey)}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  title={showAdminKey ? 'Hide Password' : 'Show Password'}
                >
                  {showAdminKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyAdmin(adminSecretKey, 'key')}
                  disabled={!adminSecretKey}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-40"
                  title="Copy Password / Key"
                >
                  {copiedKey === 'key' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4-Card KPI Bento Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Courses
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              {courses.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {courses.filter((c) => c.status === 'Open for Enrollment').length} open cohorts
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-[#00F2FE]/10 text-[#0284C7] dark:text-[#00F2FE] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Lecture Archives
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              {totalRecordingsCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              DRM MP4 + Teaser PDF
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Scheduled Live
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              {totalLiveSchedulesCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {customEventsList.length} events · {totalLiveSchedulesCount - customEventsList.length} cohort
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Academic Roster
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              {teachersList.length + studentsList.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {teachersList.length} faculty · {studentsList.length} students
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Asymmetric Console Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sticky Categorized Navigation Sidebar */}
        <aside className="lg:col-span-3 lg:sticky lg:top-20 space-y-3 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          {navGroups.map((group) => (
            <div key={group.groupLabel} className="space-y-1.5">
              <div className="px-2 pt-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {group.groupLabel}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-[#00F2FE]/15 border-[#00F2FE]/60 text-slate-900 dark:text-white'
                          : 'bg-slate-50/70 dark:bg-slate-950/60 border-transparent hover:border-slate-200 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#00F2FE] text-slate-950'
                            : 'bg-white dark:bg-slate-900 text-[#0284C7] dark:text-[#00F2FE] border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{tab.label}</div>
                        <div className="text-[10px] opacity-75 truncate font-mono tabular-nums">
                          {tab.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Right Active Console Stage */}
        <main className="lg:col-span-9 min-w-0 space-y-6">
          {/* TAB 1: COURSES CRUD (2-Column Bento Cards) */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {courses.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm"
                    >
                      <div className="relative h-44 bg-slate-950">
                        <img
                          src={resolveMediaSrc(c.thumbnail, 'course')}
                          alt={c.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />
                        <div className="absolute top-3 right-3">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono bg-slate-950/85 text-emerald-400 border border-slate-700">
                            {c.status}
                          </span>
                        </div>
                        <div className="absolute bottom-2.5 left-3.5 text-xs font-mono text-[#00F2FE] font-semibold">
                          {c.code}
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {c.level} · {c.instructorName}
                          </div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                            {c.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {c.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center tabular-nums">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] font-mono text-slate-500">Duration</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {c.durationLabel || '12 Weeks'}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] font-mono text-slate-500">Recordings</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                              {c.videoArchives?.length || 0}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] font-mono text-slate-500">Student Cap</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                              {c.enrolledStudentIds.length} / {Math.max(1, c.maxSpots ?? 50)}
                            </div>
                          </div>
                        </div>
                        {c.enrollmentDeadlineUtc && (
                          <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] tabular-nums">
                            Cutoff: {formatToLocalTime(c.enrollmentDeadlineUtc).localTimeStr}
                          </div>
                        )}
                      </div>

                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRecCourseId(c.id);
                              setActiveTab('recordings');
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:bg-[#00F2FE]/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Recordings</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditCourseLimits(c)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Set Limits</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteCourse(c.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Course"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 max-w-lg mx-auto">
                  <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Clean Administrative Slate
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    No courses are registered yet. Click &quot;Create Course&quot; above to create the first curriculum module, or use &quot;Quick Seed Sample&quot;.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECORDINGS & MEDIA MANAGER (2x2 BENTO PIPELINE + 2-COL ARCHIVES) */}
          {activeTab === 'recordings' && (
            <div className="space-y-6">
              {/* Target Course Selector & Cloud Status Deck */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-7 space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>4-Step Structured Recording &amp; DRM Studio</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Orientation videos stay public; private lectures stay locked behind free enrollment with automatic teaser-to-class stitching.
                  </p>
                </div>

                <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2">
                  <select
                    value={effectiveRecCourseId}
                    onChange={(e) => setRecCourseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.title}
                      </option>
                    ))}
                  </select>

                  {fbChancellorReady ? (
                    <span className="px-3 py-1 rounded-lg text-[11px] font-mono bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 inline-flex items-center gap-1.5 self-start lg:self-end">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Firebase + Cloud SQL Ready</span>
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-sky-50 dark:bg-[#00F2FE]/10 text-[#0284C7] dark:text-[#00F2FE] border border-sky-200 dark:border-[#00F2FE]/30 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Cloud SQL Ready</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleConnectChancellorGoogle}
                        disabled={fbAuthBusy}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        {fbAuthBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        <span>Google Bucket Link</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Step Pipeline Form (2x2 Bento Matrix) */}
              <form
                onSubmit={handleAddRecordingSubmit}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
                  <div>
                    <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Publish New Lecture &amp; Supplementary Materials</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Complete the 2x2 upload grid below: Thumbnail · Video Teaser · Full Lecture · Optional PDF
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        recThumbnailUrl && recThumbnailUrl !== 'fallback://course'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {recThumbnailUrl && recThumbnailUrl !== 'fallback://course' ? '✓ 1. Thumb' : '1. Thumb'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        recTeaserStoragePath || recTeaserUrl
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {recTeaserStoragePath || recTeaserUrl ? '✓ 2. Teaser' : '2. Teaser'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        recStoragePath || recVideoUrl
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {recStoragePath || recVideoUrl ? '✓ 3. Lecture' : '3. Lecture'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        recSuppPdfUrl
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {recSuppPdfUrl ? '✓ 4. PDF' : '4. PDF (Opt.)'}
                    </span>
                  </div>
                </div>

                {/* Seamless Auto-Join Banner */}
                {((recThumbnailUrl && recThumbnailUrl !== 'fallback://course') || recThumbnailStoragePath) &&
                  (recTeaserStoragePath || recTeaserUrl) &&
                  (recStoragePath || recVideoUrl) && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-950/80 dark:via-slate-900 dark:to-[#00F2FE]/10 border border-emerald-300 dark:border-emerald-500/50 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-emerald-600 dark:text-[#00F2FE] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>All 3 Core Components Ready — Auto-Join Active</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                            Auto-Linked
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          Teaser and full lecture will seamlessly chain during playback and save permanently to course recordings.
                        </p>
                      </div>
                    </div>
                  )}

                {recUploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-200">
                    {recUploadError}
                  </div>
                )}

                {/* Title & Duration Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Lecture Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      placeholder="e.g. Masterclass 01: Quranic Philology & Epistemological Traditions"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Lecture Duration
                    </label>
                    <input
                      type="text"
                      value={recDuration}
                      onChange={(e) => setRecDuration(e.target.value)}
                      placeholder="e.g. 52 min"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* 2x2 Bento Grid for Steps 1, 2, 3, and 4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Thumbnail */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] flex items-center justify-center text-xs font-bold font-mono shrink-0">
                            1
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Thumbnail Poster
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Auto-watermarked with DHA logo.
                            </p>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap">
                          {thumbUploadPct !== null ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                          )}
                          <span>
                            {thumbUploadPct !== null ? `${thumbUploadPct}%` : 'Upload Image'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            onChange={handleThumbnailFileUpload}
                            disabled={thumbUploadPct !== null || !effectiveRecCourseId}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <input
                        type="text"
                        value={recThumbnailUrl}
                        onChange={(e) => setRecThumbnailUrl(e.target.value)}
                        placeholder="Upload image or enter custom URL"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    {recThumbnailUrl && recThumbnailUrl !== 'fallback://course' && (
                      <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={resolveMediaSrc(recThumbnailUrl, 'course')}
                          alt="Thumbnail preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md border border-[#00F2FE]/40 text-[9px] font-bold text-[#00F2FE]">
                          {settings.customLogoUrl ? (
                            <img
                              src={settings.customLogoUrl}
                              alt="DHA"
                              referrerPolicy="no-referrer"
                              className="w-3 h-3 object-contain"
                            />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                          <span>DHA Official</span>
                        </div>
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                          {recDuration}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Video Teaser */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                            2
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Video Teaser (.MP4)
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Free preview clip before full lecture.
                            </p>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap">
                          {teaserUploadPct !== null ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {teaserUploadPct !== null ? `${teaserUploadPct}%` : 'Upload Teaser'}
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,.mp4"
                            onChange={handleTeaserMp4FileUpload}
                            disabled={teaserUploadPct !== null || !effectiveRecCourseId}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {recTeaserStoragePath || recTeaserUrl ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-between gap-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-200">
                          <span className="truncate">
                            Teaser Ready ({recTeaserFileSize || 'MP4'})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRecTeaserStoragePath('');
                              setRecTeaserUrl('');
                              setRecTeaserFileSize('');
                            }}
                            className="text-rose-600 dark:text-rose-300 hover:underline shrink-0 text-[10px]"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={recTeaserUrl}
                          onChange={(e) => setRecTeaserUrl(e.target.value)}
                          placeholder="Upload teaser .mp4 or paste teaser URL"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                        />
                      )}
                    </div>
                  </div>

                  {/* Step 3: Full Lecture Video */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] flex items-center justify-center text-xs font-bold font-mono shrink-0">
                            3
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Full Lecture (.MP4)
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              DRM archive; auto-plays after teaser.
                            </p>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#00F2FE]/15 hover:bg-[#00F2FE]/25 text-[#0284C7] dark:text-[#00F2FE] border border-[#00F2FE]/40 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap">
                          {videoUploadPct !== null ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {videoUploadPct !== null ? `${videoUploadPct}%` : 'Upload Lecture'}
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,.mp4"
                            onChange={handleMp4FileUpload}
                            disabled={videoUploadPct !== null || !effectiveRecCourseId}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {recStoragePath || recVideoUrl.startsWith('/api/courses/') ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-between gap-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-200">
                          <span className="truncate">
                            Lecture Ready ({recFileSize || 'MP4'})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRecStoragePath('');
                              setRecVideoUrl('');
                              setRecFileSize('');
                            }}
                            className="text-rose-600 dark:text-rose-300 hover:underline shrink-0 text-[10px]"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          required={!recStoragePath && !recTeaserUrl}
                          value={recVideoUrl}
                          onChange={(e) => setRecVideoUrl(e.target.value)}
                          placeholder="Upload lecture .mp4 or enter stream URL"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                        />
                      )}
                    </div>
                  </div>

                  {/* Step 4: Optional Supplementary Materials (PDF) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                            4
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Supplementary PDF (Opt.)
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Downloadable notes for enrolled students.
                            </p>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap">
                          {pdfUploading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>{pdfUploading ? 'Uploading...' : 'Upload PDF'}</span>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleSuppPdfUpload}
                            disabled={pdfUploading || !effectiveRecCourseId}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {recSuppPdfUrl ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-between gap-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-200">
                          <span className="truncate">
                            {recSuppPdfName || 'Supplementary Materials.pdf'}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={recSuppPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0284C7] dark:text-[#00F2FE] underline"
                            >
                              Preview
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setRecSuppPdfUrl('');
                                setRecSuppPdfName('');
                                setRecSuppPdfStoragePath('');
                              }}
                              className="text-rose-600 dark:text-rose-300 hover:underline text-[10px]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-400">
                          No supplementary PDF attached yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Access Toggle & Submit Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
                  <div className="md:col-span-7 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {recIsOrientation ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>
                          {recIsOrientation
                            ? 'Public Orientation Lecture'
                            : 'Private Enrolled Cohort Lecture'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {recIsOrientation
                          ? 'Anyone can watch without enrolling.'
                          : 'Requires free enrollment; teaser remains public.'}
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={recIsOrientation}
                        onChange={(e) => setRecIsOrientation(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00F2FE]"></div>
                    </label>
                  </div>

                  <div className="md:col-span-5">
                    <button
                      type="submit"
                      disabled={
                        recSubmitting ||
                        !effectiveRecCourseId ||
                        videoUploadPct !== null ||
                        teaserUploadPct !== null ||
                        thumbUploadPct !== null ||
                        pdfUploading
                      }
                      className="w-full px-5 py-3.5 rounded-2xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {recSubmitting
                          ? 'Saving Lecture, Teaser & PDF...'
                          : 'Permanently Save Lecture Archive'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Existing Recordings 2-Column Bento Archive */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Existing Recordings for {activeRecordingCourse?.title || 'Selected Course'}
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeRecordingCourse?.videoArchives?.length || 0} Total
                  </span>
                </div>

                {activeRecordingCourse && activeRecordingCourse.videoArchives?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeRecordingCourse.videoArchives.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="relative w-28 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-950">
                            <img
                              src={resolveMediaSrc(
                                rec.thumbnailUrl || activeRecordingCourse.thumbnail,
                                'course'
                              )}
                              alt={rec.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white" />
                            </div>
                            <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-950/90 text-[7px] font-mono text-[#00F2FE]">
                              DHA
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug line-clamp-2">
                              {rec.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {rec.duration} · {new Date(rec.recordedAt).toLocaleDateString()}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] font-mono">
                              <span
                                className={`font-semibold ${
                                  rec.isOrientation
                                    ? 'text-emerald-600 dark:text-emerald-300'
                                    : 'text-amber-600 dark:text-amber-300'
                                }`}
                              >
                                {rec.isOrientation ? 'Public Orientation' : 'Private Cohort'}
                              </span>
                              {(rec.teaserStoragePath || rec.teaserUrl) && (
                                <span className="text-purple-600 dark:text-purple-300">
                                  · Teaser Joined
                                </span>
                              )}
                              {rec.supplementaryPdfUrl && (
                                <a
                                  href={rec.supplementaryPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-600 dark:text-amber-300 inline-flex items-center gap-0.5 hover:underline"
                                >
                                  · <FileText className="w-2.5 h-2.5" /> PDF
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {onUpdateRecording && (
                              <>
                                <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap">
                                  {updatingRecId === rec.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-[#00F2FE]" />
                                  ) : (
                                    <ImageIcon className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                                  )}
                                  <span>Thumb</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    disabled={updatingRecId === rec.id}
                                    onChange={(e) =>
                                      handleExistingRecordingThumbUpload(
                                        activeRecordingCourse.id,
                                        rec.id,
                                        e
                                      )
                                    }
                                    className="hidden"
                                  />
                                </label>

                                <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap">
                                  <FileText className="w-3 h-3" />
                                  <span>{rec.supplementaryPdfUrl ? 'Replace PDF' : 'Attach PDF'}</span>
                                  <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    disabled={updatingRecId === rec.id}
                                    onChange={(e) =>
                                      handleExistingRecordingPdfUpload(
                                        activeRecordingCourse.id,
                                        rec.id,
                                        e
                                      )
                                    }
                                    className="hidden"
                                  />
                                </label>

                                <button
                                  type="button"
                                  disabled={updatingRecId === rec.id}
                                  onClick={() =>
                                    handleToggleRecordingOrientation(activeRecordingCourse.id, rec)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                                >
                                  {rec.isOrientation ? 'Make Private' : 'Make Public'}
                                </button>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onDeleteRecording && onDeleteRecording(activeRecordingCourse.id, rec.id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                            title="Delete Recording"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    No video recordings uploaded for this course yet. Add one using the 2x2 studio above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ASSESSMENTS STUDIO */}
          {activeTab === 'assessments' && (
            <AssessmentsStudio courses={courses} onCoursesUpdated={onCoursesUpdated} />
          )}

          {/* TAB 4: EVENTS, LIVE CLASS SCHEDULER & PIN BOARD (SIDE-BY-SIDE 12-COL SPLIT) */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Pin className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Live Class Scheduler &amp; Poster Pin Board Manager</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
                    Pick a Date, Day, Time, Course &amp; Instructor to automatically generate a live classroom meeting link and pin the session.
                  </p>
                </div>
                {onPreviewPinBoard && (
                  <button
                    type="button"
                    onClick={onPreviewPinBoard}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>Preview Poster Pin Board</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left 5-col: Scheduler Form */}
                <form
                  onSubmit={handleCreateEventSubmit}
                  className="xl:col-span-5 p-5 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Schedule Live Class</span>
                    </div>
                    {evSavedNotice && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Linked &amp; Pinned
                      </span>
                    )}
                  </div>

                  {evError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-200">
                      {evError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Class / Event Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                      placeholder="e.g. Seerah Open House & Live Cohort Seminar"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Instructor (Meeting Host)
                    </label>
                    <select
                      value={evInstructorId}
                      onChange={(e) => setEvInstructorId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="admin-mustaqeem">Mustaqeem Shaikh (Chancellor / Admin)</option>
                      {teachersList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName} (Faculty Teacher)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={evDateStr}
                        onChange={(e) => handleEvDateChange(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Day *
                      </label>
                      <select
                        value={evDayOfWeek}
                        onChange={(e) => setEvDayOfWeek(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={evTimeStr}
                        onChange={(e) => setEvTimeStr(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Location / Label
                      </label>
                      <input
                        type="text"
                        value={evLocation}
                        onChange={(e) => setEvLocation(e.target.value)}
                        placeholder="Live Online Sanctuary"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Link to Course
                      </label>
                      <select
                        value={evCourseId}
                        onChange={(e) => setEvCourseId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">General Academy Session</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Poster + Pin Options */}
                  <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Event Poster Image
                      </label>
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00F2FE]/15 hover:bg-[#00F2FE]/25 text-[#0284C7] dark:text-[#00F2FE] border border-[#00F2FE]/40 text-[11px] font-semibold cursor-pointer whitespace-nowrap">
                        {evThumbPct !== null ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        <span>{evThumbPct !== null ? `${evThumbPct}%` : 'Upload Poster'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleEventPosterUpload}
                          disabled={evThumbPct !== null}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={evPosterUrl}
                      onChange={(e) => setEvPosterUrl(e.target.value)}
                      placeholder="Upload poster or paste image URL"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                    />
                    {evPosterUrl && (
                      <div className="relative w-36 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={evPosterUrl}
                          alt="Event poster preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="pt-1">
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Pushpin Color
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                        {(
                          [
                            { key: 'aqua', label: 'Aqua', swatch: 'bg-[#00F2FE]' },
                            { key: 'emerald', label: 'Emerald', swatch: 'bg-[#10B981]' },
                            { key: 'crimson', label: 'Crimson', swatch: 'bg-[#EF4444]' },
                            { key: 'amber', label: 'Amber', swatch: 'bg-[#F59E0B]' },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setEvPinColor(p.key)}
                            className={`py-1.5 px-1.5 rounded-lg border flex items-center justify-center gap-1 font-medium transition-colors ${
                              evPinColor === p.key
                                ? 'bg-slate-900 text-white dark:bg-slate-800 border-[#00F2FE]'
                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${p.swatch}`} />
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={evPinned}
                          onChange={(e) => setEvPinned(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-[#00F2FE] focus:ring-0"
                        />
                        <span>Pin immediately to Startup Notice Board</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={evAutoRecord}
                          onChange={(e) => setEvAutoRecord(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-0"
                        />
                        <span>Enable Automatic Class Recording &amp; Archive</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Event Description / Notes
                    </label>
                    <textarea
                      rows={2}
                      value={evDescription}
                      onChange={(e) => setEvDescription(e.target.value)}
                      placeholder="Key speakers, prerequisites, or agenda highlights..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={evSubmitting || evThumbPct !== null}
                    className="w-full px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg whitespace-nowrap"
                  >
                    <Pin className="w-4 h-4" />
                    <span>
                      {evSubmitting
                        ? 'Generating Meeting Link...'
                        : 'Schedule Event & Generate Class Link'}
                    </span>
                  </button>
                </form>

                {/* Right 7-col: Published Events + Cohort Weekly Schedules */}
                <div className="xl:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white px-1">
                      <span>
                        Published Events &amp; Auto-Generated Classroom Links ({customEventsList.length})
                      </span>
                    </div>

                    {customEventsList.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customEventsList.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 hover:border-[#00F2FE]/50 transition-colors text-xs shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              {ev.posterUrl ? (
                                <img
                                  src={ev.posterUrl}
                                  alt={ev.title}
                                  referrerPolicy="no-referrer"
                                  className="w-16 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                                  <Video className="w-5 h-5 text-[#0284C7] dark:text-[#00F2FE]" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                                  {ev.title}
                                </div>
                                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                                  Instructor: {ev.instructorName || 'Mustaqeem Shaikh'}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  {ev.dayOfWeek ? `${ev.dayOfWeek} · ` : ''}
                                  {ev.dateStr || new Date(ev.startUtc).toLocaleDateString()} ·{' '}
                                  {formatToLocalTime(ev.startUtc).localTimeStr}
                                </div>
                                {ev.meetingId && (
                                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[#0284C7] dark:text-[#00F2FE]">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                      Room: {ev.meetingId}
                                    </span>
                                    {ev.meetingPasscode && (
                                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                        PIN: {ev.meetingPasscode}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {onStartMeeting && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onStartMeeting({
                                        mode: 'host',
                                        title: ev.title,
                                        courseId: ev.courseId,
                                        courseTitle: ev.courseTitle,
                                        eventId: ev.id,
                                        instructorName: ev.instructorName || 'Mustaqeem Shaikh',
                                        meetingId: ev.meetingId || ev.id,
                                        meetingPasscode: ev.meetingPasscode,
                                        joinUrl: ev.joinUrl,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 hover:brightness-110 transition-all shadow-sm whitespace-nowrap"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Start Host</span>
                                  </button>
                                )}
                                {onTogglePinEvent && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void onTogglePinEvent(ev.id, ev.pinnedToBoard === false)
                                    }
                                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-colors whitespace-nowrap ${
                                      ev.pinnedToBoard !== false
                                        ? 'bg-[#00F2FE]/15 border-[#00F2FE]/40 text-[#0284C7] dark:text-[#00F2FE]'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {ev.pinnedToBoard !== false ? 'Pinned' : 'Pin'}
                                  </button>
                                )}
                              </div>

                              {onDeleteEvent && (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteEvent(ev.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                  title="Delete Event"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        No custom events created yet. Use the scheduler on the left to generate a live session link.
                      </div>
                    )}
                  </div>

                  {onStartMeeting && courses.some((c) => c.schedules.length > 0) && (
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>Course Cohort Weekly Schedules (Host Directly)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {courses.flatMap((c) =>
                          c.schedules.map((sch) => (
                            <div
                              key={`${c.id}-${sch.id}`}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate">
                                  {sch.title}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {c.title} · {c.instructorName}
                                </div>
                                <div className="text-[10px] font-mono text-[#0284C7] dark:text-[#00F2FE] mt-0.5 tabular-nums">
                                  {sch.dayOfWeek} · {sch.timeUtc} UTC · Room {sch.zoomMeetingId}
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
                                    instructorName: c.instructorName || 'Mustaqeem Shaikh',
                                    meetingId: sch.zoomMeetingId,
                                    meetingPasscode: sch.zoomPasscode,
                                    joinUrl: sch.zoomJoinUrl,
                                  })
                                }
                                className="px-3 py-2 rounded-xl bg-[#00F2FE] hover:bg-[#00F2FE]/90 text-slate-950 font-bold text-[11px] shrink-0 whitespace-nowrap"
                              >
                                Start Host
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TEACHERS FACULTY & STUDENT ROSTER (SIDE-BY-SIDE FACULTY SPLIT + ROSTER TABLE) */}
          {activeTab === 'roster' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left 5-col: Provision New Teacher */}
                <form
                  onSubmit={handleCreateTeacherSubmit}
                  className="xl:col-span-5 p-5 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
                >
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Provision New Teacher Account</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Grant Teacher Portal access to host live classes and manage cohorts.
                    </p>
                  </div>

                  {tError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-200">
                      {tError}
                    </div>
                  )}
                  {tSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/40 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{tSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={tFirstName}
                        onChange={(e) => setTFirstName(e.target.value)}
                        placeholder="Ustadha Amina"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={tLastName}
                        onChange={(e) => setTLastName(e.target.value)}
                        placeholder="Farooq"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Faculty Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={tEmail}
                      onChange={(e) => setTEmail(e.target.value)}
                      placeholder="teacher@deenhijrah.edu"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Login Password *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={tPassword}
                        onChange={(e) => setTPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Gender Track
                      </label>
                      <select
                        value={tGender}
                        onChange={(e) => setTGender(e.target.value as UserGender)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="male">Male (Brothers)</option>
                        <option value="female">Female (Sisters)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={tSubmitting}
                    className="w-full px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                  >
                    {tSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>{tSubmitting ? 'Provisioning Account...' : 'Create Teacher Account'}</span>
                  </button>
                </form>

                {/* Right 7-col: Faculty Directory */}
                <div className="xl:col-span-7 p-5 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Faculty Directory
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Active instructors with Teacher Portal hosting permissions
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#0284C7] dark:text-[#00F2FE] font-bold tabular-nums">
                      {teachersList.length} Registered
                    </span>
                  </div>

                  {teachersList.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {teachersList.map((t) => (
                        <div
                          key={t.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SymbolicAvatar
                              gender={t.gender}
                              avatarUrl={t.avatarUrl}
                              name={`${t.firstName} ${t.lastName}`}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {t.firstName} {t.lastName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {t.email}
                              </div>
                              <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-300 mt-0.5">
                                Faculty Teacher
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(t)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                            title="Delete Teacher Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      No additional teachers provisioned yet. Use the form on the left to add faculty.
                    </div>
                  )}
                </div>
              </div>

              {/* Enrolled Student Roster Table */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      <span>Enrolled Student Roster ({studentsList.length})</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Inspect live Student Portal progress or manage student accounts.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono">
                        <tr>
                          <th className="py-3 px-4">Student Profile</th>
                          <th className="py-3 px-4">Institutional Email</th>
                          <th className="py-3 px-4">Gender Account</th>
                          <th className="py-3 px-4">Enrolled Subjects</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                        {studentsList.map((st) => {
                          const studentEnrolledCourses = courses.filter((c) =>
                            c.enrolledStudentIds.includes(st.id)
                          );
                          const defaultCourseId =
                            studentEnrolledCourses[0]?.id || courses[0]?.id || '';

                          return (
                            <tr
                              key={st.id}
                              className="hover:bg-slate-100/70 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="py-3 px-4 flex items-center gap-3">
                                <SymbolicAvatar
                                  gender={st.gender}
                                  avatarUrl={st.avatarUrl}
                                  name={`${st.firstName} ${st.lastName}`}
                                  size="sm"
                                />
                                <div>
                                  <div
                                    className="font-bold text-slate-900 dark:text-white hover:text-[#0284C7] dark:hover:text-[#00F2FE] cursor-pointer"
                                    onClick={() =>
                                      defaultCourseId && onOpenStudentViewer(defaultCourseId, st.id)
                                    }
                                  >
                                    {st.firstName} {st.lastName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">{st.id}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                                {st.email}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                                  {st.gender}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                                {studentEnrolledCourses.length > 0
                                  ? studentEnrolledCourses.map((c) => c.code).join(', ')
                                  : 'Not yet enrolled'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={!defaultCourseId}
                                    onClick={() => onOpenStudentViewer(defaultCourseId, st.id)}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#00F2FE]/15 hover:bg-[#00F2FE]/25 text-[#0284C7] dark:text-[#00F2FE] border border-[#00F2FE]/40 transition-colors inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap"
                                    title="Launch Student View"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setUserToDelete(st)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    title="Delete Student from Platform"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {studentsList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                              No students registered yet. New signups will appear here with instant deletion control.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: NAVBAR MANAGER (SIDE-BY-SIDE 12-COL SPLIT) */}
          {activeTab === 'nav' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleAddNavItem}
                className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Menu className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Add New Navbar Item</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Add public tabs (e.g. Library, Podcasts, Admissions) to the site navigation bar.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Display Label
                  </label>
                  <input
                    type="text"
                    required
                    value={newNavLabel}
                    onChange={(e) => {
                      setNewNavLabel(e.target.value);
                      if (!newNavKey) {
                        setNewNavKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                      }
                    }}
                    placeholder="e.g. Library"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Route / Tab Key
                  </label>
                  <input
                    type="text"
                    required
                    value={newNavKey}
                    onChange={(e) => setNewNavKey(e.target.value)}
                    placeholder="e.g. library"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Navigation Item</span>
                </button>
              </form>

              <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Active Navigation Items ({navItems.length})
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">Top Bar Directory</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {navItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {item.label}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            /{item.key}
                          </span>
                          {item.isSystem && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                              · System
                            </span>
                          )}
                        </div>
                      </div>

                      {!item.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNavItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                          title="Delete Navigation Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SAFETY & MODERATION LOGS (2-COLUMN BENTO GRID) */}
          {activeTab === 'moderation' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  Automated Safety &amp; Moderation Filter:{' '}
                </span>
                All community posts and classroom chat messages are scanned in real-time. Blocked messages are logged below for Chancellor review.
              </div>

              {moderationLogs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {moderationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 text-xs shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            {log.action.toUpperCase()}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            {log.source}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {log.authorName}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-rose-700 dark:text-rose-200 border border-slate-200 dark:border-slate-800">
                          &quot;{log.content}&quot;
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          Trigger: <strong>{log.flaggedKeyword}</strong> ·{' '}
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                        {log.reviewedByMustaqeem ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Reviewed by Mustaqeem</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onReviewModerationLog(log.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors text-xs whitespace-nowrap"
                          >
                            Mark Reviewed
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                  No content violations flagged. Safety filters are healthy and operational.
                </div>
              )}
            </div>
          )}

          {/* TAB 8: ZOOM CLOUD AUTOMATION HOOK (2-COLUMN SPLIT) */}
          {activeTab === 'zoom' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              <div className="md:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Video className="w-5 h-5 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Zoom Server-to-Server Cloud Recording &amp; Sync</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Live classes initiated with{' '}
                    <code className="text-[#0284C7] dark:text-[#00F2FE]">
                      auto_recording: &quot;cloud&quot;
                    </code>{' '}
                    trigger the automated cloud archive pipeline. When the meeting concludes, the webhook ingests the MP4 payload into the course&apos;s permanent archive bucket.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => courses[0] && onTriggerZoomWebhook(courses[0].id)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Simulate Webhook Trigger (Auto-Push MP4)</span>
                  </button>
                </div>
              </div>

              <div className="md:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs shadow-sm">
                <div className="text-slate-900 dark:text-white font-bold font-sans text-sm">
                  Webhook Endpoint Telemetry
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[#0284C7] dark:text-[#00F2FE] break-all">
                    POST /api/zoom/webhook/recording-completed
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Event: MEETING_RECORDING_COMPLETED
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Listener Active &amp; Ready
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: PLATFORM SETTINGS & HERO BANNER ENGINE (2-COLUMN STUDIO SPLIT) */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
            >
              {/* Left 7-col: Mode & Copy Controls */}
              <div className="xl:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Hero &amp; Platform Branding Copy
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure homepage hero mode, headline, and academic intro text.
                    </p>
                  </div>
                  {settingsSaved && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Settings Saved
                    </span>
                  )}
                </div>

                {heroUploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-200">
                    {heroUploadError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Homepage Hero Background Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setHeroMode('video')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        heroMode === 'video'
                          ? 'bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] border-[#00F2FE]'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Looping Promotional Video (.mp4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroMode('image')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        heroMode === 'image'
                          ? 'bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] border-[#00F2FE]'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      High-Res Cover Photography
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hero Headline
                  </label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hero Subheadline
                  </label>
                  <textarea
                    rows={3}
                    value={heroSubheadline}
                    onChange={(e) => setHeroSubheadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] whitespace-nowrap"
                >
                  Save Platform Settings
                </button>
              </div>

              {/* Right 5-col: Media & Logo Upload Deck */}
              <div className="xl:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Media &amp; Emblem Assets
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap">
                    {heroUploadState?.kind === 'custom_logo' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00F2FE]" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                    )}
                    <span>
                      {heroUploadState?.kind === 'custom_logo'
                        ? `${heroUploadState.pct}%`
                        : 'Upload Logo'}
                    </span>
                    <input
                      type="file"
                      accept="image/svg+xml,image/png,image/jpeg,image/webp"
                      onChange={(e) => handleBrandingFileUpload('custom_logo', e)}
                      disabled={heroUploadState !== null}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Hero Video URL (.mp4)
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] dark:text-[#00F2FE] cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />
                      {heroUploadState?.kind === 'hero_video'
                        ? `${heroUploadState.pct}%`
                        : 'Upload .MP4'}
                      <input
                        type="file"
                        accept="video/mp4,.mp4"
                        onChange={(e) => handleBrandingFileUpload('hero_video', e)}
                        disabled={heroUploadState !== null}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={heroVideoUrl}
                    onChange={(e) => setHeroVideoUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Hero Video Poster Image URL
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] dark:text-[#00F2FE] cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />
                      {heroUploadState?.kind === 'hero_poster'
                        ? `${heroUploadState.pct}%`
                        : 'Upload Poster'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={(e) => handleBrandingFileUpload('hero_poster', e)}
                        disabled={heroUploadState !== null}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={heroPosterUrl}
                    onChange={(e) => setHeroPosterUrl(e.target.value)}
                    placeholder="Upload poster or enter URL"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Hero Static Image URL (Fallback)
                    </label>
                    <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] dark:text-[#00F2FE] cursor-pointer hover:underline">
                      <Upload className="w-3 h-3" />
                      {heroUploadState?.kind === 'hero_image'
                        ? `${heroUploadState.pct}%`
                        : 'Upload Cover'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={(e) => handleBrandingFileUpload('hero_image', e)}
                        disabled={heroUploadState !== null}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* CREATE COURSE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Create New Course Module
            </h3>

            <form onSubmit={handleCreateCourseSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Classical Arabic Syntax (Nahw 101)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="DHA-NHW101"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive curriculum breakdown and prerequisites..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Open for Enrollment">Open for Enrollment</option>
                    <option value="Active">Active</option>
                    <option value="Coming Soon">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Total Lectures
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalLectures}
                    onChange={(e) => setTotalLectures(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Student Limit (Max Spots)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={maxSpots}
                    onChange={(e) => setMaxSpots(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course Duration (Time Span)
                  </label>
                  <input
                    type="text"
                    value={durationLabel}
                    onChange={(e) => setDurationLabel(e.target.value)}
                    placeholder="e.g. 12 Weeks · 90 min/wk"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Enrollment Time Limit / Cutoff (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={enrollmentDeadlineLocal}
                    onChange={(e) => setEnrollmentDeadlineLocal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {courseCreateError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-200">
                  {courseCreateError}
                </div>
              )}

              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Course Cover Thumbnail (Auto-watermarked with DHA Logo)
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00F2FE]/15 hover:bg-[#00F2FE]/25 text-[#0284C7] dark:text-[#00F2FE] border border-[#00F2FE]/40 text-[11px] font-semibold cursor-pointer">
                    {courseThumbUploadPct !== null ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>
                      {courseThumbUploadPct !== null
                        ? `Uploading ${courseThumbUploadPct}%`
                        : 'Upload Cover'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleCourseThumbnailUpload}
                      disabled={courseThumbUploadPct !== null}
                      className="hidden"
                    />
                  </label>
                </div>

                <input
                  type="text"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="Upload cover above or enter thumbnail URL"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                />

                <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img
                    src={resolveMediaSrc(thumbnail, 'course')}
                    alt="Course cover preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/85 text-[9px] font-mono text-[#00F2FE]">
                    Deen Hijrah
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCourseCreateError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || courseThumbUploadPct !== null}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Publish Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0A192F] border border-rose-500/40 p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete User Account?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will permanently delete this record.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div>
                <strong>Name:</strong> {userToDelete.firstName} {userToDelete.lastName}
              </div>
              <div>
                <strong>Email:</strong> {userToDelete.email}
              </div>
              <div>
                <strong>Role:</strong> {userToDelete.role}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
              >
                Permanently Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COURSE LIMITS & DURATION MODAL */}
      {editingCourseLimits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0A192F] border border-slate-200 dark:border-slate-700 p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE]">
                {editingCourseLimits.code} · Student Cap &amp; Time Limit Controls
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {editingCourseLimits.title}
              </h4>
            </div>

            <form onSubmit={handleSaveCourseLimits} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Limit (Max Enrolled Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    required
                    value={editMaxSpots}
                    onChange={(e) => setEditMaxSpots(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Duration Label
                  </label>
                  <input
                    type="text"
                    required
                    value={editDurationLabel}
                    onChange={(e) => setEditDurationLabel(e.target.value)}
                    placeholder="12 Weeks · 90 min/wk"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enrollment Time Limit (Optional Cutoff)
                  </label>
                  <input
                    type="datetime-local"
                    value={editDeadlineLocal}
                    onChange={(e) => setEditDeadlineLocal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Course['status'])}
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
                  value={editTotalLectures}
                  onChange={(e) => setEditTotalLectures(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200">
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCourseLimits(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 disabled:opacity-50"
                >
                  {editSaving ? 'Saving Limits...' : 'Save Course Limits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
