import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Navbar,
  DEFAULT_SEERAHVERSE_LINKS,
  resolvePublicNavLinks,
} from './components/Navbar';
import { CursorSpotlight } from './components/CursorSpotlight';
import { LogoPreloader } from './components/LogoPreloader';
import { NavigationLoader, type ProfileLoaderPreview } from './components/NavigationLoader';
import { HeroBanner } from './components/HeroBanner';
import { CourseCatalog } from './components/CourseCatalog';
import { CourseDetailPage } from './components/CourseDetailPage';
import { CourseRegistrationPage } from './components/CourseRegistrationPage';
import { PreRegisterSection } from './components/PreRegisterSection';
import { CounselingSection } from './components/CounselingSection';
import { EventsPinBoard } from './components/EventsPinBoard';
import { AuthView } from './components/AuthView';
import { StudentPortal } from './components/StudentPortal';
import { AdminPortal } from './components/AdminPortal';
import { TeacherPortal } from './components/TeacherPortal';
import { LiveClassroomModal, LiveSessionContext } from './components/LiveClassroomModal';
import { CommunityHub } from './components/CommunityHub';
import { AcademicCalendar } from './components/AcademicCalendar';
import { ArticlesBlog, BlogArticlePage } from './components/ArticlesBlog';
import { AboutSection } from './components/AboutSection';
import { FacultySection } from './components/FacultySection';
import { ContactSection } from './components/ContactSection';
import { NavigationAIAssistant } from './components/NavigationAIAssistant';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { useFirebase } from './contexts/FirebaseContext';
import type {
  User,
  Course,
  PlatformSettings,
  CommunityPost,
  ChatMessage,
  ModerationLog,
  CalendarEvent,
  BlogPost,
  StudentSubjectProgress,
  CustomNavItem,
  CompletedVideoArchive,
  PostComment,
  EnrollmentIntakePayload,
} from './types';
import { getUserTimezone, setSavedTimezonePreference } from './utils/timezone';
import { findCourseBySlugOrId, toCourseSlug } from './utils/courseSlug';
import { auth, getFirebaseIdToken, signOut } from './firebase';
import {
  CHANCELLOR_EMAIL,
  syncUserProfileToFirestore,
  syncCourseToFirestore,
  deleteCourseFromFirestore,
  deleteRecordingFromFirestore,
  enrollStudentInFirestore,
  syncSettingsToFirestore,
  syncEventToFirestore,
  deleteEventFromFirestore,
  syncBlogPostToFirestore,
  createCommunityPostInFirestore,
  addCommunityCommentInFirestore,
  toggleCommunityLikeInFirestore,
  createChatMessageInFirestore,
  subscribeToPlatformSettings,
  subscribeToCourses,
  subscribeToEvents,
  subscribeToBlogPosts,
  subscribeToCommunityPosts,
  subscribeToChatMessages,
  subscribeToUserAccount,
  subscribeToUserPreferences,
  saveUserThemePreferenceToFirestore,
  saveUserThemePreferenceToServer,
  getStoredSessionToken,
  setStoredSessionToken,
  getStoredCachedUser,
  setStoredCachedUser,
  SESSION_STORAGE_KEY,
  CACHED_USER_KEY,
  getAuthHeaders,
} from './services/firebaseService';

const BUILT_IN_TABS = new Set([
  'home',
  'courses',
  'course-detail',
  'course-registration',
  'pre-register',
  'counseling',
  'blogs',
  'blog-detail',
  'faculty',
  'about',
  'contact',
  'schedule',
  'events',
  'student-portal',
  'teacher-portal',
  'admin-portal',
  'classroom',
  'community',
  'signin',
  'signup',
]);

function getInitialRouteFromUrl(): {
  tab: string;
  blogId: string | null;
  courseId: string | null;
  courseSlug: string | null;
  roomCode: string | null;
  signupType: 'student' | 'instructor';
} {
  try {
    const url = new URL(window.location.href);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const params = url.searchParams;
    const blogParam = params.get('blog');
    const courseParam = params.get('course');
    const tabParam = params.get('tab');
    const roomParam = params.get('room');
    const typeParam = params.get('type');
    const signupType: 'student' | 'instructor' =
      typeParam && typeParam.trim().toLowerCase() === 'instructor' ? 'instructor' : 'student';

    if (pathname === '/signup') {
      return {
        tab: 'signup',
        blogId: null,
        courseId: null,
        courseSlug: null,
        roomCode: null,
        signupType,
      };
    }

    if (pathname === '/signin') {
      return {
        tab: 'signin',
        blogId: null,
        courseId: null,
        courseSlug: null,
        roomCode: null,
        signupType: 'student',
      };
    }

    if (pathname === '/course-registration') {
      return {
        tab: 'course-registration',
        blogId: null,
        courseId: courseParam && courseParam.trim() ? courseParam.trim() : null,
        courseSlug: null,
        roomCode: null,
        signupType: 'student',
      };
    }

    if (pathname.startsWith('/course/')) {
      const rawSlug = pathname.slice('/course/'.length);
      let decodedSlug = rawSlug;
      try {
        decodedSlug = decodeURIComponent(rawSlug);
      } catch {
        decodedSlug = rawSlug;
      }
      return {
        tab: 'course-detail',
        blogId: null,
        courseId: courseParam && courseParam.trim() ? courseParam.trim() : null,
        courseSlug: decodedSlug.trim() || null,
        roomCode: null,
        signupType: 'student',
      };
    }

    if (blogParam && blogParam.trim()) {
      return {
        tab: 'blog-detail',
        blogId: blogParam.trim(),
        courseId: null,
        courseSlug: null,
        roomCode: null,
        signupType: 'student',
      };
    }
    if (tabParam && tabParam.trim() === 'course-registration' && courseParam && courseParam.trim()) {
      return {
        tab: 'course-registration',
        blogId: null,
        courseId: courseParam.trim(),
        courseSlug: null,
        roomCode: null,
        signupType: 'student',
      };
    }
    if (courseParam && courseParam.trim()) {
      return {
        tab: 'course-detail',
        blogId: null,
        courseId: courseParam.trim(),
        courseSlug: null,
        roomCode: null,
        signupType: 'student',
      };
    }
    if (tabParam && tabParam.trim()) {
      return {
        tab: tabParam.trim(),
        blogId: null,
        courseId: null,
        courseSlug: null,
        roomCode: roomParam && roomParam.trim() ? roomParam.trim() : null,
        signupType,
      };
    }
  } catch {
    // Ignore URL parse error
  }
  return {
    tab: 'home',
    blogId: null,
    courseId: null,
    courseSlug: null,
    roomCode: null,
    signupType: 'student',
  };
}

function updateBrowserUrl(
  tab: string,
  blogId?: string | null,
  courseId?: string | null,
  options?: {
    courseTitle?: string;
    signupType?: 'student' | 'instructor';
    replace?: boolean;
  }
) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('blog');
    url.searchParams.delete('course');
    url.searchParams.delete('tab');
    url.searchParams.delete('type');

    if (tab === 'signup') {
      url.pathname = '/signup';
      url.searchParams.set('type', options?.signupType === 'instructor' ? 'Instructor' : 'Student');
    } else if (tab === 'signin') {
      url.pathname = '/signin';
    } else if (tab === 'course-registration' && courseId) {
      url.pathname = '/course-registration';
      url.searchParams.set('course', courseId);
    } else if (tab === 'course-detail' && (courseId || options?.courseTitle)) {
      const slug = toCourseSlug(options?.courseTitle || courseId || 'course');
      url.pathname = `/course/${encodeURIComponent(slug)}`;
      if (courseId) {
        url.searchParams.set('course', courseId);
      }
    } else if (tab === 'blog-detail' && blogId) {
      url.pathname = '/';
      url.searchParams.set('tab', 'blog-detail');
      url.searchParams.set('blog', blogId);
    } else if (tab && tab !== 'home') {
      url.pathname = '/';
      url.searchParams.set('tab', tab);
    } else {
      url.pathname = '/';
    }

    const stateObj = {
      tab,
      blogId: blogId || null,
      courseId: courseId || null,
      signupType: options?.signupType || 'student',
    };
    if (options?.replace) {
      window.history.replaceState(stateObj, '', url.toString());
    } else {
      window.history.pushState(stateObj, '', url.toString());
    }
  } catch {
    // Ignore restricted history API in opaque origins
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }
  } catch {
    // Response is not JSON
  }
  return `${fallback} (HTTP ${res.status})`;
}

export default function App() {
  const initialRouteRef = useRef(getInitialRouteFromUrl());
  const pendingRoomCodeRef = useRef<string | null>(initialRouteRef.current.roomCode);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preloaderFinished, setPreloaderFinished] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() =>
    initialRouteRef.current.tab === 'classroom' ? 'home' : initialRouteRef.current.tab
  );
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(() => initialRouteRef.current.blogId);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => initialRouteRef.current.courseId);
  const [pendingCourseSlug, setPendingCourseSlug] = useState<string | null>(() => initialRouteRef.current.courseSlug);
  const [signupType, setSignupType] = useState<'student' | 'instructor'>(() => initialRouteRef.current.signupType);
  const [activeLiveSession, setActiveLiveSession] = useState<LiveSessionContext | null>(null);
  const [articlesLoaded, setArticlesLoaded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingTarget, setNavigatingTarget] = useState('Destination');
  const [navigatingSubtitle, setNavigatingSubtitle] = useState('Synchronizing scholastic chamber...');
  const [navigatingProfile, setNavigatingProfile] = useState<ProfileLoaderPreview | null>(null);

  const buildProfilePreview = (u: User | null | undefined): ProfileLoaderPreview | null => {
    if (!u) return null;
    const roleLabel =
      u.role === 'admin'
        ? 'Chancellor Account'
        : u.role === 'teacher'
        ? 'Faculty Teacher Account'
        : 'Student Scholar Profile';
    return {
      name: `${u.firstName} ${u.lastName}`.trim() || 'Academy Member',
      roleLabel,
      avatarUrl: u.avatarUrl,
      gender: u.gender,
    };
  };

  // Firebase Auth Readiness & Firestore Context
  const {
    firebaseUser,
    isAuthReady,
    isVerifiedUser,
    firestoreErrorMessage,
    isQuotaExceeded,
    quotaUpgradeUrl,
    quotaPricingUrl,
    reportFirestoreError,
    clearFirestoreError,
  } = useFirebase();

  // Theme state: dark / light (synced with Firebase & user preferences across devices)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const cachedUser = getStoredSessionToken() ? getStoredCachedUser() : null;
      if (cachedUser?.preferredTheme === 'light' || cachedUser?.preferredTheme === 'dark') {
        return cachedUser.preferredTheme;
      }
      const saved = localStorage.getItem('dha_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('dha_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const applySyncedTheme = useCallback((nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    setCurrentUser((prev) => {
      if (!prev || prev.preferredTheme === nextTheme) return prev;
      const updated = { ...prev, preferredTheme: nextTheme };
      setStoredCachedUser(updated);
      return updated;
    });
  }, []);

  const toggleTheme = () => {
    const nextTheme: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    const activeUser = currentUserRef.current;
    if (activeUser && !isTesterModeRef.current) {
      const updatedUser: User = { ...activeUser, preferredTheme: nextTheme };
      currentUserRef.current = updatedUser;
      setCurrentUser(updatedUser);
      setStoredCachedUser(updatedUser);

      if (isVerifiedUser && firebaseUser) {
        saveUserThemePreferenceToFirestore(nextTheme).catch(reportFirestoreError);
      }
      void saveUserThemePreferenceToServer(activeUser.id, nextTheme, activeUser.email);
    }
  };

  // Application Data States (Hydrate synchronously from cached user snapshot when session token exists)
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getStoredSessionToken() ? getStoredCachedUser() : null
  );
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const syncedUidRef = useRef<string | null>(null);
  const firestorePostIdsRef = useRef<Set<string>>(new Set());

  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    heroMode: 'video',
    heroVideoUrl: '',
    heroPosterUrl: 'fallback://hero',
    heroImageUrl: 'fallback://hero',
    heroHeadline: 'Pursue Sacred Knowledge with Rigor & Elegance',
    heroSubheadline: 'A sanctuary of classical Islamic scholarship engineered with immersive real-time classrooms, automated Zoom lecture archives, and global timezone intelligence.',
    customLogoUrl: '',
    customNavItems: DEFAULT_SEERAHVERSE_LINKS,
  });

  // Modal & Viewer States
  const [pinBoardOpen, setPinBoardOpen] = useState(false);
  const pinBoardAutoShownRef = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState<'timezone' | 'password'>('timezone');
  const [isTesterMode, setIsTesterMode] = useState(false);
  const isTesterModeRef = useRef(false);
  useEffect(() => {
    isTesterModeRef.current = isTesterMode;
  }, [isTesterMode]);
  const [savedAdminUser, setSavedAdminUser] = useState<User | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(() => {
    const stored = getStoredSessionToken();
    return stored || null;
  });
  const [toastNotice, setToastNotice] = useState<{
    kind: 'info' | 'error' | 'success';
    message: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);

  const showToast = (
    kind: 'info' | 'error' | 'success',
    message: string,
    linkUrl?: string,
    linkLabel?: string
  ) => {
    setToastNotice({ kind, message, linkUrl, linkLabel });
    if (!linkUrl) {
      setTimeout(() => {
        setToastNotice((prev) => (prev?.message === message ? null : prev));
      }, 6000);
    }
  };

  // Real-time Student Viewer Mode (When Admin/Teacher clicks on a student in the roster)
  const [viewerStudentId, setViewerStudentId] = useState<string | null>(null);
  const [viewerStudent, setViewerStudent] = useState<User | undefined>(undefined);
  const [viewerProgress, setViewerProgress] = useState<StudentSubjectProgress | undefined>(undefined);

  // Initial Data Fetch (passes auth headers and restricts admin endpoints to verified admins)
  const fetchData = async (overrideUser?: User | null) => {
    try {
      const headers = await getAuthHeaders();
      const effectiveUser = overrideUser !== undefined ? overrideUser : currentUserRef.current;
      const isAdminViewer = effectiveUser?.role === 'admin' && !isTesterModeRef.current;

      const [
        coursesRes,
        postsRes,
        chatRes,
        calRes,
        blogRes,
        settingsRes,
        usersRes,
        modRes,
      ] = await Promise.all([
        fetch('/api/courses', { headers, credentials: 'include' }),
        fetch('/api/community/posts'),
        fetch('/api/chat/messages'),
        fetch('/api/calendar/events'),
        fetch('/api/blogs'),
        fetch('/api/settings'),
        isAdminViewer ? fetch('/api/users', { headers }) : Promise.resolve(null),
        isAdminViewer ? fetch('/api/admin/moderation-logs', { headers }) : Promise.resolve(null),
      ]);

      if (coursesRes.ok) setCourses(await coursesRes.json());
      if (usersRes && usersRes.ok) {
        const uList: User[] = await usersRes.json();
        setUsers(uList);
        if (!isTesterModeRef.current) {
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const fresh = uList.find(
              (u) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
            );
            if (
              fresh &&
              (fresh.avatarUrl !== prev.avatarUrl ||
                fresh.firstName !== prev.firstName ||
                fresh.lastName !== prev.lastName ||
                fresh.role !== prev.role)
            ) {
              setStoredCachedUser(fresh);
              return fresh;
            }
            return prev;
          });
        }
      } else if (!isAdminViewer) {
        setUsers([]);
      }
      if (postsRes.ok) setCommunityPosts(await postsRes.json());
      if (chatRes.ok) setChatMessages(await chatRes.json());
      if (modRes && modRes.ok) {
        setModerationLogs(await modRes.json());
      } else if (!isAdminViewer) {
        setModerationLogs([]);
      }
      if (calRes.ok) setCalendarEvents(await calRes.json());
      if (blogRes.ok) {
        setArticles(await blogRes.json());
      }
      setArticlesLoaded(true);
      if (settingsRes.ok) {
        const loadedSettings: PlatformSettings = await settingsRes.json();
        const rawVideo = loadedSettings.heroVideoUrl || '';
        const sanitizedVideo =
          rawVideo.includes('mixkit.co') ||
          rawVideo.includes('commondatastorage.googleapis.com/gtv-videos-bucket/sample')
            ? ''
            : rawVideo;
        setSettings({
          ...loadedSettings,
          heroVideoUrl: sanitizedVideo,
        });
      }
    } catch (e) {
      setArticlesLoaded(true);
      console.error('Initial fetch error:', e);
    }
  };

  useEffect(() => {
    void fetchData();

    const restoreSession = async () => {
      const token = getStoredSessionToken();
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated && data?.user) {
            setCurrentUser(data.user);
            setStoredCachedUser(data.user);
            if (data.user.timezone) {
              setSavedTimezonePreference(data.user.timezone);
            }
            if (
              !isTesterModeRef.current &&
              (data.user.preferredTheme === 'dark' || data.user.preferredTheme === 'light')
            ) {
              setTheme(data.user.preferredTheme);
            }
            const activeToken = data.adminSessionToken || data.sessionToken || token;
            if (activeToken) {
              setStoredSessionToken(activeToken);
            }
            if (data.isAdmin || data.user.role === 'admin') {
              setSavedAdminUser(data.user);
              setAdminSessionToken(activeToken || null);
            }
            void fetchData(data.user);
          } else if (!isTesterModeRef.current && !auth.currentUser && (token || getStoredCachedUser())) {
            setStoredSessionToken(null);
            setStoredCachedUser(null);
            setAdminSessionToken(null);
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.error('Session restore warning:', err);
      }
    };
    void restoreSession();

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'dha_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
      if (e.key === SESSION_STORAGE_KEY || e.key === CACHED_USER_KEY) {
        const tok = getStoredSessionToken();
        const cached = getStoredCachedUser();
        if (!tok && !cached) {
          setCurrentUser(null);
          setSavedAdminUser(null);
          setAdminSessionToken(null);
        } else if (cached) {
          setCurrentUser(cached);
          if (tok) setAdminSessionToken(tok);
        } else if (tok) {
          void restoreSession();
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);

    const handlePopState = () => {
      const next = getInitialRouteFromUrl();
      setActiveTab(next.tab);
      setSelectedBlogId(next.blogId);
      setSelectedCourseId(next.courseId);
      setPendingCourseSlug(next.courseSlug);
      setSignupType(next.signupType);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('popstate', handlePopState);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  // Resolve course slug routes (/course/<slug>) once courses load
  useEffect(() => {
    if (!selectedCourseId && pendingCourseSlug && courses.length > 0) {
      const matched = findCourseBySlugOrId(courses, pendingCourseSlug);
      if (matched) {
        setSelectedCourseId(matched.id);
      }
    }
  }, [courses, pendingCourseSlug, selectedCourseId]);

  // Synchronize Firebase authenticated identity cleanly after isAuthReady
  useEffect(() => {
    if (!isAuthReady) return;
    if (!firebaseUser || !firebaseUser.emailVerified) {
      syncedUidRef.current = null;
      return;
    }
    if (isTesterModeRef.current) return;
    if (syncedUidRef.current === firebaseUser.uid) return;

    syncedUidRef.current = firebaseUser.uid;
    let active = true;
    const parts = (firebaseUser.displayName || 'Scholar User').split(' ');
    const isChancellor = firebaseUser.email?.toLowerCase() === CHANCELLOR_EMAIL;

    void syncUserProfileToFirestore({
      id: firebaseUser.uid,
      firstName: parts[0] || 'Scholar',
      lastName: parts.slice(1).join(' ') || 'User',
      email: firebaseUser.email || '',
      role: isChancellor ? 'admin' : 'student',
      gender: 'male',
      avatarUrl: firebaseUser.photoURL || undefined,
      createdAt: new Date().toISOString(),
    }).catch((err) => {
      if (active) reportFirestoreError(err);
    });

    // If interactive AuthView flow already synced this UID, just load admin data without duplicate POST
    if (currentUserRef.current?.id === firebaseUser.uid) {
      void fetchData(currentUserRef.current);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const sqlRes = await fetch('/api/auth/google-callback', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            firstName: parts[0] || 'Scholar',
            lastName: parts.slice(1).join(' ') || 'User',
            avatarUrl: firebaseUser.photoURL || undefined,
          }),
        });
        if (!active || !sqlRes.ok) return;
        const sqlData = await sqlRes.json();
        const token = sqlData?.adminSessionToken || sqlData?.sessionToken;
        if (token) {
          setStoredSessionToken(token);
        }
        if (sqlData?.user) {
          setCurrentUser(sqlData.user);
          setStoredCachedUser(sqlData.user);
          if (sqlData.user.timezone) {
            setSavedTimezonePreference(sqlData.user.timezone);
          }
          if (
            sqlData.user.preferredTheme === 'dark' ||
            sqlData.user.preferredTheme === 'light'
          ) {
            setTheme(sqlData.user.preferredTheme);
          }
          if (sqlData.user.role === 'admin') {
            setSavedAdminUser(sqlData.user);
            setAdminSessionToken(token || null);
          } else {
            setSavedAdminUser(null);
            setAdminSessionToken(null);
          }
          void fetchData(sqlData.user);
        }
      } catch (err) {
        console.error('Firebase session sync warning:', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthReady, firebaseUser?.uid, reportFirestoreError]);

  // Real-time Firestore onSnapshot listeners (Strictly gated on isAuthReady && isVerifiedUser)
  useEffect(() => {
    if (!isAuthReady || !isVerifiedUser || !firebaseUser) return;

    const unsubs = [
      subscribeToPlatformSettings(
        (fbSettings) => {
          setSettings((prev) => ({
            ...prev,
            ...fbSettings,
            customNavItems:
              fbSettings.customNavItems && fbSettings.customNavItems.length > 0
                ? fbSettings.customNavItems
                : prev.customNavItems,
          }));
        },
        reportFirestoreError
      ),
      subscribeToCourses(
        (fbCourses) => {
          setCourses((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            fbCourses.forEach((fc) => {
              if (!fc.id) return;
              const existing = byId.get(fc.id);
              if (existing) {
                byId.set(fc.id, { ...existing, ...fc });
              } else {
                byId.set(fc.id, {
                  id: fc.id,
                  code: fc.code || 'DHA-101',
                  title: fc.title || 'Course',
                  description: fc.description || '',
                  instructorId: fc.instructorId || 'admin-mustaqeem',
                  instructorName: fc.instructorName || 'Mustaqeem Shaikh',
                  status: fc.status || 'Open for Enrollment',
                  level: fc.level || 'Beginner',
                  thumbnail: fc.thumbnail || 'fallback://course',
                  modules: [],
                  schedules: [],
                  videoArchives: [],
                  materials: [],
                  assignments: [],
                  enrolledStudentIds: [],
                  totalLectures: fc.totalLectures || 12,
                });
              }
            });
            return Array.from(byId.values());
          });
        },
        reportFirestoreError
      ),
      subscribeToEvents(
        (fbEvents) => {
          setCalendarEvents((prev) => {
            const derivedOnly = prev.filter((ev) => ev.isDerived);
            const byId = new Map(
              prev.filter((ev) => !ev.isDerived).map((ev) => [ev.id, ev])
            );
            fbEvents.forEach((ev) => byId.set(ev.id, ev));
            return [...Array.from(byId.values()), ...derivedOnly];
          });
        },
        reportFirestoreError
      ),
      subscribeToBlogPosts(
        (fbPosts) => {
          setArticles((prev) => {
            const byId = new Map(prev.map((a) => [a.id, a]));
            fbPosts.forEach((p) => byId.set(p.id, p));
            const merged = Array.from(byId.values());
            merged.sort(
              (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
            return merged;
          });
          setArticlesLoaded(true);
        },
        reportFirestoreError
      ),
      subscribeToCommunityPosts(
        (fbPosts) => {
          firestorePostIdsRef.current = new Set(fbPosts.map((p) => p.id));
          setCommunityPosts((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            fbPosts.forEach((fp) => {
              const existing = byId.get(fp.id);
              byId.set(
                fp.id,
                existing
                  ? {
                      ...existing,
                      ...fp,
                      likes: Math.max(fp.likes, existing.likes),
                      likedByUserIds: existing.likedByUserIds,
                      comments: existing.comments,
                    }
                  : fp
              );
            });
            const merged = Array.from(byId.values());
            merged.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return merged;
          });
        },
        reportFirestoreError
      ),
      subscribeToChatMessages(
        (fbMsgs) => {
          setChatMessages((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            fbMsgs.forEach((m) => byId.set(m.id, m));
            const merged = Array.from(byId.values());
            merged.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return merged;
          });
        },
        reportFirestoreError
      ),
      subscribeToUserAccount(
        firebaseUser.uid,
        (patch) => {
          if (isTesterModeRef.current) return;
          setCurrentUser((prev) => {
            if (!prev || prev.id !== firebaseUser.uid) return prev;
            const next = { ...prev, ...patch };
            setStoredCachedUser(next);
            return next;
          });
        },
        reportFirestoreError
      ),
      subscribeToUserPreferences(
        firebaseUser.uid,
        (fbTheme) => {
          if (isTesterModeRef.current) return;
          applySyncedTheme(fbTheme);
        },
        reportFirestoreError
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAuthReady, isVerifiedUser, firebaseUser?.uid, reportFirestoreError, applySyncedTheme]);

  // Synchronize dynamic browser tab favicon with Academy Custom Logo
  useEffect(() => {
    const iconHref = settings.customLogoUrl?.trim() ? settings.customLogoUrl.trim() : '/favicon.svg';
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    rels.forEach((rel) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = iconHref;
    });
  }, [settings.customLogoUrl]);

  // Resolve classroom deep links (?tab=classroom&room=...) once data & user are ready
  useEffect(() => {
    const roomCode = pendingRoomCodeRef.current;
    if (!roomCode || !preloaderFinished) return;
    if (!currentUser) return;

    const cleanRoom = roomCode.replace(/\s+/g, '').toLowerCase();
    const matchedEvent = calendarEvents.find(
      (ev) =>
        ev.id.toLowerCase() === cleanRoom ||
        (ev.meetingId || '').replace(/\s+/g, '').toLowerCase() === cleanRoom
    );
    if (matchedEvent) {
      pendingRoomCodeRef.current = null;
      const isStaffUser = currentUser.role === 'admin' || currentUser.role === 'teacher';
      setActiveLiveSession({
        mode: isStaffUser ? 'host' : 'student',
        title: matchedEvent.title,
        courseId: matchedEvent.courseId,
        courseTitle: matchedEvent.courseTitle,
        eventId: matchedEvent.id,
        instructorName: matchedEvent.instructorName || 'Mustaqeem Shaikh',
        meetingId: matchedEvent.meetingId || matchedEvent.id,
        meetingPasscode: matchedEvent.meetingPasscode,
        joinUrl: matchedEvent.joinUrl,
      });
      return;
    }

    for (const c of courses) {
      const sch = c.schedules.find(
        (s) =>
          s.id.toLowerCase() === cleanRoom ||
          (s.zoomMeetingId || '').replace(/\s+/g, '').toLowerCase() === cleanRoom
      );
      if (sch) {
        pendingRoomCodeRef.current = null;
        const isStaffUser = currentUser.role === 'admin' || currentUser.role === 'teacher';
        setActiveLiveSession({
          mode: isStaffUser ? 'host' : 'student',
          title: sch.title,
          courseId: c.id,
          courseTitle: c.title,
          scheduleId: sch.id,
          instructorName: c.instructorName || 'Mustaqeem Shaikh',
          meetingId: sch.zoomMeetingId,
          meetingPasscode: sch.zoomPasscode,
          joinUrl: sch.zoomJoinUrl,
        });
        return;
      }
    }
  }, [preloaderFinished, currentUser, calendarEvents, courses]);

  // Automatically open rectangular Events Poster Pin Board once on initial home load
  useEffect(() => {
    if (preloaderFinished && !pinBoardAutoShownRef.current && activeTab === 'home') {
      pinBoardAutoShownRef.current = true;
      setPinBoardOpen(true);
    }
  }, [preloaderFinished, activeTab]);

  // Fast Themed Navigation Loader Trigger (650ms)
  const handleNavigateWithLoader = (
    targetTab: string,
    nextSignupType?: 'student' | 'instructor'
  ) => {
    const resolvedSignupType =
      targetTab === 'signup' ? nextSignupType || signupType || 'student' : 'student';
    if (
      targetTab === activeTab &&
      targetTab !== 'blog-detail' &&
      targetTab !== 'course-detail' &&
      targetTab !== 'course-registration' &&
      !(targetTab === 'signup' && nextSignupType && nextSignupType !== signupType)
    ) {
      return;
    }
    if (viewerStudentId) {
      handleExitViewerMode();
    }
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }
    const isProfilePortal =
      targetTab === 'student-portal' ||
      targetTab === 'teacher-portal' ||
      targetTab === 'admin-portal';
    const match = settings.customNavItems?.find((n) => n.key === targetTab);
    const readableName =
      targetTab === 'student-portal'
        ? 'Student Profile & Dashboard'
        : targetTab === 'teacher-portal'
        ? 'Faculty Teacher Profile'
        : targetTab === 'admin-portal'
        ? 'Chancellor Profile'
        : targetTab === 'blogs'
        ? 'Scholastic Articles'
        : targetTab === 'blog-detail'
        ? 'Scholastic Article'
        : targetTab === 'course-detail'
        ? 'Course Overview'
        : targetTab === 'course-registration'
        ? 'Free Cohort Registration'
        : targetTab === 'signup'
        ? resolvedSignupType === 'instructor'
          ? 'Instructor Sign Up'
          : 'Student Sign Up'
        : targetTab === 'signin'
        ? 'Academy Sign In'
        : targetTab === 'pre-register'
        ? 'Cohort Pre-Registration'
        : targetTab === 'counseling'
        ? 'Academic Counseling'
        : match?.label || targetTab;
    setNavigatingProfile(
      isProfilePortal ? buildProfilePreview(currentUserRef.current || currentUser) : null
    );
    setNavigatingSubtitle(
      isProfilePortal
        ? 'Loading profile...'
        : 'Preparing your academy view...'
    );
    setNavigatingTarget(readableName);
    setIsNavigating(true);

    navTimeoutRef.current = setTimeout(() => {
      if (targetTab === 'signup') {
        setSignupType(resolvedSignupType);
      }
      setActiveTab(targetTab);
      if (targetTab !== 'blog-detail') {
        setSelectedBlogId(null);
      }
      if (targetTab !== 'course-detail' && targetTab !== 'course-registration') {
        setSelectedCourseId(null);
        setPendingCourseSlug(null);
      }
      updateBrowserUrl(targetTab, null, null, {
        signupType: resolvedSignupType,
      });
      setIsNavigating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, isProfilePortal ? 900 : 820);
  };

  // Course Click -> Fast Loading Sign -> Open Dedicated SeerahVerse Course Detail Page
  const handleOpenCoursePage = (course: Course) => {
    if (activeTab === 'course-detail' && selectedCourseId === course.id) return;
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }
    setPinBoardOpen(false);
    setNavigatingProfile(null);
    setNavigatingTarget(course.title);
    setNavigatingSubtitle('Loading curriculum, orientation & cohort explanation...');
    setIsNavigating(true);

    navTimeoutRef.current = setTimeout(() => {
      setSelectedCourseId(course.id);
      setPendingCourseSlug(toCourseSlug(course.title));
      setActiveTab('course-detail');
      updateBrowserUrl('course-detail', null, course.id, {
        courseTitle: course.title,
      });
      setIsNavigating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 800);
  };

  // Register CTA -> Dedicated Free ($0) Course Registration Route (/course-registration?course=<id>)
  const handleOpenCourseRegistration = (course: Course) => {
    if (activeTab === 'course-registration' && selectedCourseId === course.id) return;
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }
    setPinBoardOpen(false);
    setNavigatingProfile(null);
    setNavigatingTarget(`Register: ${course.title}`);
    setNavigatingSubtitle('Preparing free $0 cohort admission sheet...');
    setIsNavigating(true);

    navTimeoutRef.current = setTimeout(() => {
      setSelectedCourseId(course.id);
      setPendingCourseSlug(toCourseSlug(course.title));
      setActiveTab('course-registration');
      updateBrowserUrl('course-registration', null, course.id, {
        courseTitle: course.title,
      });
      setIsNavigating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 760);
  };

  // Blog Click -> Fast Loading Sign -> Open Dedicated Full-Page Blog Reader
  const handleOpenBlogWithLoader = (article: BlogPost) => {
    if (activeTab === 'blog-detail' && selectedBlogId === article.id) return;
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }
    setNavigatingProfile(null);
    setNavigatingTarget(article.title);
    setNavigatingSubtitle('Opening full scholastic article...');
    setIsNavigating(true);

    navTimeoutRef.current = setTimeout(() => {
      setSelectedBlogId(article.id);
      setActiveTab('blog-detail');
      updateBrowserUrl('blog-detail', article.id, null);
      setIsNavigating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 800);
  };

  // Handlers
  const handleToggleStudentTester = () => {
    if (!isTesterMode) {
      const studentTester = users.find((u) => u.role === 'student') || {
        id: 'student-tester',
        firstName: 'Zayd',
        lastName: 'Farooq',
        email: 'zayd.farooq@deenhijrahacademia.edu',
        role: 'student' as const,
        gender: 'male' as const,
        createdAt: new Date().toISOString(),
      };
      if (currentUser?.role === 'admin') {
        setSavedAdminUser(currentUser);
      }
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }
      setNavigatingProfile(buildProfilePreview(studentTester));
      setNavigatingTarget('Student Profile');
      setNavigatingSubtitle('Loading profile...');
      setIsNavigating(true);

      navTimeoutRef.current = setTimeout(() => {
        setCurrentUser(studentTester);
        currentUserRef.current = studentTester;
        setIsTesterMode(true);
        setActiveTab('student-portal');
        setIsNavigating(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 740);
    } else {
      if (savedAdminUser) {
        setCurrentUser(savedAdminUser);
        currentUserRef.current = savedAdminUser;
      } else {
        const admin = users.find((u) => u.role === 'admin');
        if (admin) {
          setCurrentUser(admin);
          currentUserRef.current = admin;
        }
      }
      setIsTesterMode(false);
      setActiveTab('home');
    }
  };

  const handleEnrollCourseWithIntake = async (
    courseId: string,
    intake: EnrollmentIntakePayload
  ) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/courses/${courseId}/enroll`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        ...intake,
        studentId: currentUserRef.current?.id,
      }),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to enroll in course');
      showToast('error', msg);
      throw new Error(msg);
    }
    const data = await res.json();
    let effectiveUser = currentUserRef.current;

    if (data?.user && data?.sessionToken) {
      setStoredSessionToken(data.sessionToken);
      setStoredCachedUser(data.user);
      setCurrentUser(data.user);
      currentUserRef.current = data.user;
      effectiveUser = data.user;
    }

    if (data?.course) {
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, ...data.course } : c))
      );
    } else if (effectiveUser) {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId && !c.enrolledStudentIds.includes(effectiveUser!.id)
            ? { ...c, enrolledStudentIds: [...c.enrolledStudentIds, effectiveUser!.id] }
            : c
        )
      );
    }

    const idToken = await getFirebaseIdToken();
    if (idToken) {
      fetch(`/api/sql/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      }).catch(console.error);
    }
    const targetCourse = courses.find((c) => c.id === courseId);
    if (targetCourse && firebaseUser?.emailVerified) {
      enrollStudentInFirestore(targetCourse).catch(reportFirestoreError);
    }
    await fetchData(effectiveUser);
    showToast(
      'success',
      `Enrollment confirmed for ${targetCourse?.title || 'your course'}! Added to your Student Dashboard.`
    );
  };

  const handleEnrollCourse = async (courseId: string) => {
    const targetCourse = courses.find((c) => c.id === courseId);
    if (!currentUser) {
      setAuthModalOpen(false);
      if (targetCourse) {
        handleOpenCoursePage(targetCourse);
      } else {
        handleNavigateWithLoader('signup');
      }
      return;
    }
    await handleEnrollCourseWithIntake(courseId, {
      courseId,
      studentId: currentUser.id,
      fullName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      email: currentUser.email,
      gender: currentUser.gender,
    });
  };

  const handleStartMeeting = async (session: LiveSessionContext) => {
    setActiveLiveSession({ ...session, mode: 'host' });
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      await fetch('/api/zoom/start-meeting', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseId: session.courseId,
          scheduleId: session.scheduleId,
          eventId: session.eventId,
        }),
      });
      await fetchData();
    } catch (e) {
      console.error('Start meeting telemetry warning:', e);
    }
  };

  const handleJoinClassWithAttendance = async (courseId: string, scheduleId: string) => {
    if (!currentUser) {
      setAuthModalOpen(false);
      handleNavigateWithLoader('signin');
      return;
    }
    const targetCourse = courses.find((c) => c.id === courseId);
    const targetSch = targetCourse?.schedules.find((s) => s.id === scheduleId);

    setActiveLiveSession({
      mode: currentUser.role === 'admin' || currentUser.role === 'teacher' ? 'host' : 'student',
      title: targetSch?.title || targetCourse?.title || 'Live Cohort Class',
      courseId,
      courseTitle: targetCourse?.title,
      scheduleId,
      instructorName: targetCourse?.instructorName || 'Mustaqeem Shaikh',
      meetingId: targetSch?.zoomMeetingId || `DHA-${scheduleId.slice(-6)}`,
      meetingPasscode: targetSch?.zoomPasscode || '78699',
      joinUrl: targetSch?.zoomJoinUrl,
    });

    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/attendance/join', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseId,
          scheduleId,
          studentId: currentUser.id,
          studentName: `${currentUser.firstName} ${currentUser.lastName}`,
          timezoneDetected: getUserTimezone(),
        }),
      });
      if (res.ok) {
        await fetchData();
        showToast('success', 'Attendance recorded in your local timezone. Welcome to the live class.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinEventMeeting = async (ev: CalendarEvent) => {
    if (!currentUser) {
      setPinBoardOpen(false);
      handleNavigateWithLoader('signin');
      return;
    }
    setPinBoardOpen(false);
    setActiveLiveSession({
      mode: currentUser.role === 'admin' || currentUser.role === 'teacher' ? 'host' : 'student',
      title: ev.title,
      courseId: ev.courseId,
      courseTitle: ev.courseTitle,
      eventId: ev.id,
      instructorName: ev.instructorName || 'Mustaqeem Shaikh',
      meetingId: ev.meetingId || ev.id,
      meetingPasscode: ev.meetingPasscode || '78699',
      joinUrl: ev.joinUrl,
    });

    if (ev.courseId) {
      try {
        const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
        await fetch('/api/attendance/join', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            courseId: ev.courseId,
            scheduleId: ev.id,
            studentId: currentUser.id,
            studentName: `${currentUser.firstName} ${currentUser.lastName}`,
            timezoneDetected: getUserTimezone(),
          }),
        });
      } catch {
        // Non-fatal
      }
    }
    showToast('success', `Joined "${ev.title}" with ${ev.instructorName || 'Mustaqeem Shaikh'}.`);
  };

  const handleStartEventMeeting = async (ev: CalendarEvent) => {
    setPinBoardOpen(false);
    await handleStartMeeting({
      mode: 'host',
      title: ev.title,
      courseId: ev.courseId,
      courseTitle: ev.courseTitle,
      eventId: ev.id,
      instructorName: ev.instructorName || 'Mustaqeem Shaikh',
      meetingId: ev.meetingId || ev.id,
      meetingPasscode: ev.meetingPasscode,
      joinUrl: ev.joinUrl,
    });
  };

  const handleOpenStudentViewer = async (courseId: string, studentId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/student-viewer/${courseId}/${studentId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (navTimeoutRef.current) {
          clearTimeout(navTimeoutRef.current);
        }
        setNavigatingProfile(buildProfilePreview(data.student));
        setNavigatingTarget('Student Profile');
        setNavigatingSubtitle('Loading profile...');
        setIsNavigating(true);

        navTimeoutRef.current = setTimeout(() => {
          setViewerStudentId(studentId);
          setViewerStudent(data.student);
          setViewerProgress(data.progress);
          setActiveTab('student-portal');
          setIsNavigating(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 740);
      } else {
        const msg = await readApiError(res, 'Unable to open student portal view');
        showToast('error', msg);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExitViewerMode = () => {
    setViewerStudentId(null);
    setViewerStudent(undefined);
    setViewerProgress(undefined);
    setActiveTab('admin-portal');
  };

  const handleSeedSampleCourse = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/courses/seed-sample', { method: 'POST', headers });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to seed sample course');
      showToast('error', msg);
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.course) {
      syncCourseToFirestore(data.course).catch(reportFirestoreError);
    }
    await fetchData();
    showToast('success', 'Sample course added and persisted.');
    setActiveTab('courses');
  };

  const handleCreateCourse = async (courseData: Partial<Course>) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers,
      body: JSON.stringify(courseData),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to publish course');
      showToast('error', msg);
      throw new Error(msg);
    }
    const created: Course = await res.json();
    syncCourseToFirestore(created).catch(reportFirestoreError);
    await fetchData();
    showToast('success', `Course "${created.title}" published and saved.`);
  };

  const handleDeleteCourse = async (courseId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to delete course');
      showToast('error', msg);
      throw new Error(msg);
    }
    deleteCourseFromFirestore(courseId).catch(reportFirestoreError);
    await fetchData();
    showToast('success', 'Course permanently deleted.');
  };

  const handleDeleteUser = async (userId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to delete user');
      showToast('error', msg);
      throw new Error(msg);
    }
    await fetchData();
    showToast('success', 'Member account removed.');
  };

  const handleAddRecording = async (
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
  ) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/courses/${courseId}/recordings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(recData),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to save lecture recording');
      showToast('error', msg);
      throw new Error(msg);
    }
    const savedRec: CompletedVideoArchive = await res.json();
    const targetCourse = courses.find((c) => c.id === courseId);
    if (targetCourse) {
      syncCourseToFirestore({
        ...targetCourse,
        videoArchives: [...(targetCourse.videoArchives || []), savedRec],
      }).catch(reportFirestoreError);
    }
    await fetchData();
    showToast('success', `Recording "${savedRec.title}" published and saved permanently.`);
  };

  const handleUpdateRecording = async (
    courseId: string,
    recId: string,
    patch: Partial<CompletedVideoArchive>
  ) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/courses/${courseId}/recordings/${recId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to update recording');
      showToast('error', msg);
      throw new Error(msg);
    }
    const updatedRec: CompletedVideoArchive = await res.json();
    const targetCourse = courses.find((c) => c.id === courseId);
    if (targetCourse) {
      syncCourseToFirestore({
        ...targetCourse,
        videoArchives: (targetCourse.videoArchives || []).map((r) =>
          r.id === recId ? updatedRec : r
        ),
      }).catch(reportFirestoreError);
    }
    await fetchData();
    showToast('success', `Recording "${updatedRec.title}" updated and saved.`);
  };

  const handleDeleteRecording = async (courseId: string, recId: string) => {
    const targetCourse = courses.find((c) => c.id === courseId);
    const targetRec = targetCourse?.videoArchives?.find((r) => r.id === recId);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/courses/${courseId}/recordings/${recId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to delete recording');
      showToast('error', msg);
      throw new Error(msg);
    }
    deleteRecordingFromFirestore(courseId, recId, targetRec?.storagePath).catch(reportFirestoreError);
    await fetchData();
    showToast('success', 'Recording deleted.');
  };

  const handleUpdateNavItems = async (items: CustomNavItem[]) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/settings/nav-items', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ navItems: items }),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to save navigation bar items');
      showToast('error', msg);
      throw new Error(msg);
    }
    const data = await res.json();
    const updatedItems = Array.isArray(data) ? data : data.customNavItems || items;
    const nextSettings = { ...settings, customNavItems: updatedItems };
    setSettings(nextSettings);
    syncSettingsToFirestore(nextSettings).catch(reportFirestoreError);
    showToast('success', 'Navigation links updated and saved.');
  };

  const handleUpdateSettings = async (newSettings: Partial<PlatformSettings>) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers,
      body: JSON.stringify(newSettings),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to save platform settings');
      showToast('error', msg);
      throw new Error(msg);
    }
    const updated: PlatformSettings = await res.json();
    setSettings(updated);
    syncSettingsToFirestore(updated).catch(reportFirestoreError);
    showToast('success', 'Platform branding & hero settings saved.');
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to pin event to poster board');
      showToast('error', msg);
      throw new Error(msg);
    }
    const created: CalendarEvent = await res.json();
    syncEventToFirestore(created).catch(reportFirestoreError);
    await fetchData();
    showToast('success', `Live class "${created.title}" scheduled with meeting link & pinned.`);
    return created;
  };

  const handleTogglePinEvent = async (id: string, pinned: boolean) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/calendar/events/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ pinnedToBoard: pinned }),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to update event pin state');
      showToast('error', msg);
      throw new Error(msg);
    }
    const updated: CalendarEvent = await res.json();
    syncEventToFirestore(updated).catch(reportFirestoreError);
    await fetchData();
    showToast('success', pinned ? 'Event pinned to poster board.' : 'Event unpinned from poster board.');
  };

  const handleDeleteEvent = async (id: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/calendar/events/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to delete event');
      showToast('error', msg);
      throw new Error(msg);
    }
    deleteEventFromFirestore(id).catch(reportFirestoreError);
    await fetchData();
    showToast('success', 'Event deleted from poster board and schedule.');
  };

  const handleTriggerZoomWebhook = async (courseId: string) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/zoom/webhook/recording-completed', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId,
        topic: 'Live Cohort Recording: Prophetic Pedagogy',
        duration: '1 hr 22 min',
      }),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to sync Zoom recording webhook');
      showToast('error', msg);
      return;
    }
    await fetchData();
    showToast(
      'success',
      'Zoom automated recording webhook caught and synced to the course video archive.'
    );
  };

  const handleAddCommunityPost = async (
    content: string,
    category: 'announcement' | 'community',
    mediaUrl?: string
  ) => {
    if (!currentUser) return;
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        authorId: currentUser.id,
        authorName: `${currentUser.firstName} ${currentUser.lastName}`,
        authorRole: currentUser.role,
        authorGender: currentUser.gender,
        authorAvatar: currentUser.avatarUrl,
        content,
        category,
        mediaUrl,
      }),
    });
    const data: CommunityPost & { error?: string } = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish post.');
    createCommunityPostInFirestore(data).catch(reportFirestoreError);
    await fetchData();
  };

  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/community/posts/${postId}/like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: currentUser.id }),
    });
    if (res.ok) {
      if (firestorePostIdsRef.current.has(postId)) {
        toggleCommunityLikeInFirestore(postId).catch(reportFirestoreError);
      }
      await fetchData();
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!currentUser) return;
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        authorId: currentUser.id,
        authorName: `${currentUser.firstName} ${currentUser.lastName}`,
        authorRole: currentUser.role,
        authorGender: currentUser.gender,
        content,
      }),
    });
    const data: PostComment & { error?: string } = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add comment.');
    if (firestorePostIdsRef.current.has(postId)) {
      addCommunityCommentInFirestore(postId, data).catch(reportFirestoreError);
    }
    await fetchData();
  };

  const handleSendMessage = async (content: string, courseId?: string, channelId?: string) => {
    if (!currentUser) return;
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId,
        channelId,
        senderId: currentUser.id,
        senderName: `${currentUser.firstName} ${currentUser.lastName}`,
        senderRole: currentUser.role,
        senderGender: currentUser.gender,
        content,
      }),
    });
    const data: ChatMessage & { error?: string } = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send message.');
    createChatMessageInFirestore(data).catch(reportFirestoreError);
    await fetchData();
  };

  const handleAddArticle = async (article: Partial<BlogPost>) => {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/blogs', {
      method: 'POST',
      headers,
      body: JSON.stringify(article),
    });
    if (!res.ok) {
      const msg = await readApiError(res, 'Failed to publish blog article');
      showToast('error', msg);
      throw new Error(msg);
    }
    const created: BlogPost = await res.json();
    syncBlogPostToFirestore(created).catch(reportFirestoreError);
    await fetchData();
    showToast('success', 'Blog post published.');
  };

  const handleReviewModerationLog = async (logId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/moderation-logs/${logId}/review`, {
      method: 'PATCH',
      headers,
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const isLight = theme === 'light';
  const prefersReducedPageMotion = useReducedMotion();
  const routeTransitionKey = `${activeTab}:${selectedCourseId || ''}:${selectedBlogId || ''}:${
    activeTab === 'signup' ? signupType : ''
  }`;
  const pinnedEventsCount = calendarEvents.filter(
    (ev) => !ev.isDerived && ev.pinnedToBoard !== false
  ).length;
  const activeCustomNavItem = !BUILT_IN_TABS.has(activeTab)
    ? settings.customNavItems?.find((item) => item.key === activeTab)
    : undefined;
  const selectedBlogArticle =
    selectedBlogId ? articles.find((a) => a.id === selectedBlogId) || null : null;
  const selectedCourseObj =
    (selectedCourseId ? courses.find((c) => c.id === selectedCourseId) || null : null) ||
    (pendingCourseSlug ? findCourseBySlugOrId(courses, pendingCourseSlug) : null);
  const publicNavLinks = resolvePublicNavLinks(settings.customNavItems);

  return (
    <div className={`min-h-screen transition-colors duration-200 relative selection:bg-[#0284C7]/20 dark:selection:bg-[#00F2FE]/20 selection:text-[#0284C7] dark:selection:text-[#00F2FE] ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#071120] text-slate-100'
    }`}>
      {/* 1. Fast Theme-Aware Logo Preloader Splash */}
      {!preloaderFinished && (
        <LogoPreloader
          onComplete={() => setPreloaderFinished(true)}
          customLogoUrl={settings.customLogoUrl}
          theme={theme}
          onUploadCustomLogo={(logo) => {
            setSettings((prev) => ({ ...prev, customLogoUrl: logo }));
            if (currentUser?.role === 'admin' && !logo.startsWith('data:')) {
              void handleUpdateSettings({ customLogoUrl: logo }).catch(() => {});
            }
          }}
        />
      )}

      {/* Fast 650ms Theme-Aware Navigation & Profile Loader Overlay */}
      <NavigationLoader
        isLoading={isNavigating}
        targetTabName={navigatingTarget}
        subtitle={navigatingSubtitle}
        customLogoUrl={settings.customLogoUrl}
        theme={theme}
        profilePreview={navigatingProfile}
      />

      {/* 2. Interactive Cursor & Ambient Effects Spotlight */}
      <CursorSpotlight />

      {/* 3. Top Navigation Bar (No Admin or Portal links shown publicly) */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleNavigateWithLoader}
        onOpenAuth={(mode) => {
          handleNavigateWithLoader(mode === 'signup' ? 'signup' : 'signin', 'student');
        }}
        onLogout={() => {
          const token = getStoredSessionToken();
          fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: token
              ? {
                  'x-session-token': token,
                  'x-admin-session': token,
                }
              : {},
          }).catch(() => {});
          setStoredSessionToken(null);
          setStoredCachedUser(null);
          signOut(auth).catch(() => {});
          setCurrentUser(null);
          setSavedAdminUser(null);
          setAdminSessionToken(null);
          setIsTesterMode(false);
          setSelectedCourseId(null);
          setSelectedBlogId(null);
          updateBrowserUrl('home', null, null);
          setActiveTab('home');
          void fetchData(null);
        }}
        onOpenAccountSettings={(tab = 'timezone') => {
          setAccountSettingsTab(tab);
          setAccountSettingsOpen(true);
        }}
        customLogoUrl={settings.customLogoUrl}
        customNavItems={settings.customNavItems}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 4. Active Main Content Route with Smooth Architectural Page Transitions */}
      <main className="relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={routeTransitionKey}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{
              duration: 0.36,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
        
        {/* TAB: HOME */}
        {activeTab === 'home' && (
          <>
            <HeroBanner
              settings={settings}
              courses={courses}
              customLogoUrl={settings.customLogoUrl}
              isAdmin={currentUser?.role === 'admin'}
              onSelectCourse={handleOpenCoursePage}
              onExploreCourses={() => {
                const el = document.getElementById('catalog-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenEnrollment={() => handleNavigateWithLoader('signup')}
              totalCoursesCount={courses.length}
              pinnedEventsCount={pinnedEventsCount}
              onOpenPinBoard={() => setPinBoardOpen(true)}
            />

            {/* Quick Navigation Strips */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
              <div className={`p-2 sm:p-3 rounded-2xl backdrop-blur-md border flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs shadow-xl transition-colors ${
                isLight ? 'bg-white/95 border-slate-200' : 'bg-[#0A192F]/90 border-slate-800'
              }`}>
                <span className="text-slate-400 font-mono text-[11px] mr-1 hidden sm:inline">Explore:</span>
                {publicNavLinks
                  .filter((item) => item.key !== 'home')
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.key === 'courses') {
                          const el = document.getElementById('catalog-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                          else handleNavigateWithLoader('courses');
                        } else {
                          handleNavigateWithLoader(item.key);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl border transition-colors font-medium whitespace-nowrap ${
                        isLight
                          ? 'bg-slate-100 hover:bg-[#00F2FE]/20 hover:text-[#0284C7] border-slate-200 text-slate-700'
                          : 'bg-slate-900/80 hover:bg-[#00F2FE]/20 hover:text-[#00F2FE] border-slate-700/60 text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Courses Catalog Section */}
            <div id="catalog-section">
              <CourseCatalog
                courses={courses}
                customLogoUrl={settings.customLogoUrl}
                onSelectCourse={handleOpenCoursePage}
                onOpenCreateCourse={() => handleNavigateWithLoader('admin-portal')}
                onSeedSampleCourse={handleSeedSampleCourse}
                onNavigateAuth={(mode) => handleNavigateWithLoader(mode)}
                isAdmin={currentUser?.role === 'admin'}
              />
            </div>

            {/* About Section */}
            <AboutSection />

            {/* Faculty Section */}
            <FacultySection />

            {/* Contact Section */}
            <ContactSection />
          </>
        )}

        {/* TAB: COURSES */}
        {activeTab === 'courses' && (
          <div className="py-6">
            <CourseCatalog
              courses={courses}
              customLogoUrl={settings.customLogoUrl}
              onSelectCourse={handleOpenCoursePage}
              onOpenCreateCourse={() => handleNavigateWithLoader('admin-portal')}
              onSeedSampleCourse={handleSeedSampleCourse}
              onNavigateAuth={(mode) => handleNavigateWithLoader(mode)}
              isAdmin={currentUser?.role === 'admin'}
            />
          </div>
        )}

        {/* TAB: COURSE DETAIL PAGE (SeerahVerse Overview + SourceCode Recordings Workspace + Intake Enrollment) */}
        {activeTab === 'course-detail' && (
          <CourseDetailPage
            course={selectedCourseObj}
            currentUser={currentUser}
            customLogoUrl={settings.customLogoUrl}
            onBackToCourses={() => handleNavigateWithLoader('courses')}
            onEnrollWithIntake={handleEnrollCourseWithIntake}
            onJoinClassWithAttendance={handleJoinClassWithAttendance}
            onStartMeeting={(info) => {
              void handleStartMeeting({
                mode: 'host',
                title: info.title,
                courseId: info.courseId,
                courseTitle: info.courseTitle,
                scheduleId: info.scheduleId,
                instructorName: info.instructorName,
                meetingId: info.meetingId,
                meetingPasscode: info.meetingPasscode,
                joinUrl: info.joinUrl,
              });
            }}
            onNavigateToPortal={() => handleNavigateWithLoader('student-portal')}
            onNavigateToRegistration={handleOpenCourseRegistration}
            onRefreshData={fetchData}
          />
        )}

        {/* TAB: DEDICATED FREE COURSE REGISTRATION PAGE (/course-registration?course=<id>) */}
        {activeTab === 'course-registration' && (
          <CourseRegistrationPage
            course={selectedCourseObj}
            currentUser={currentUser}
            customLogoUrl={settings.customLogoUrl}
            onBackToCourse={handleOpenCoursePage}
            onBackToCourses={() => handleNavigateWithLoader('courses')}
            onEnrollWithIntake={handleEnrollCourseWithIntake}
            onAuthenticated={(u, token) => {
              setCurrentUser(u);
              currentUserRef.current = u;
              if (u.preferredTheme === 'dark' || u.preferredTheme === 'light') {
                setTheme(u.preferredTheme);
              }
              if (token) setAdminSessionToken(token);
              if (u.role === 'admin') setSavedAdminUser(u);
              void fetchData(u);
            }}
            onOpenStudentPortal={() => handleNavigateWithLoader('student-portal')}
          />
        )}

        {/* TAB: PRE-REGISTER */}
        {activeTab === 'pre-register' && (
          <PreRegisterSection
            courses={courses}
            currentUser={currentUser}
            onSelectCourse={handleOpenCoursePage}
          />
        )}

        {/* TAB: COUNSELING */}
        {activeTab === 'counseling' && <CounselingSection currentUser={currentUser} />}

        {/* TAB: BLOGS */}
        {activeTab === 'blogs' && (
          <ArticlesBlog
            articles={articles}
            currentUser={currentUser}
            onAddArticle={handleAddArticle}
            onSelectArticle={handleOpenBlogWithLoader}
            theme={theme}
          />
        )}

        {/* TAB: BLOG DETAIL FULL PAGE */}
        {activeTab === 'blog-detail' && (
          <BlogArticlePage
            article={selectedBlogArticle}
            allArticles={articles}
            isLoadingArticles={!articlesLoaded}
            onBackToBlogs={() => handleNavigateWithLoader('blogs')}
            onSelectArticle={handleOpenBlogWithLoader}
            theme={theme}
          />
        )}

        {/* TAB: FACULTY */}
        {activeTab === 'faculty' && <FacultySection />}

        {/* TAB: ABOUT */}
        {activeTab === 'about' && <AboutSection />}

        {/* TAB: CONTACT */}
        {activeTab === 'contact' && <ContactSection />}

        {/* TAB: SCHEDULE & EVENTS */}
        {(activeTab === 'schedule' || activeTab === 'events') && (
          <AcademicCalendar
            events={calendarEvents}
            courses={courses}
            onSelectCourse={handleOpenCoursePage}
            onOpenPinBoard={() => setPinBoardOpen(true)}
            isAdmin={currentUser?.role === 'admin'}
            isStaff={currentUser?.role === 'admin' || currentUser?.role === 'teacher'}
            onDeleteEvent={(id) => {
              void handleDeleteEvent(id).catch(() => {});
            }}
            onJoinEventMeeting={handleJoinEventMeeting}
            onStartEventMeeting={handleStartEventMeeting}
          />
        )}

        {/* TAB: STUDENT PORTAL */}
        {activeTab === 'student-portal' && (
          <StudentPortal
            currentUser={currentUser}
            courses={courses}
            events={calendarEvents}
            customLogoUrl={settings.customLogoUrl}
            theme={theme}
            onToggleTheme={toggleTheme}
            onJoinClassWithAttendance={handleJoinClassWithAttendance}
            onJoinEventMeeting={handleJoinEventMeeting}
            onEnroll={handleEnrollCourse}
            onBrowseCourses={() => handleNavigateWithLoader('courses')}
            onOpenCoursePage={handleOpenCoursePage}
            onOpenAccountSettings={(tab = 'timezone') => {
              setAccountSettingsTab(tab);
              setAccountSettingsOpen(true);
            }}
            viewerStudentId={viewerStudentId || undefined}
            viewerStudent={viewerStudent}
            viewerProgress={viewerProgress}
            onExitViewerMode={handleExitViewerMode}
            onRefreshData={fetchData}
          />
        )}

        {/* TAB: TEACHER PORTAL */}
        {activeTab === 'teacher-portal' && (currentUser?.role === 'teacher' || currentUser?.role === 'admin') && (
          <TeacherPortal
            currentUser={currentUser}
            courses={courses}
            events={calendarEvents}
            customLogoUrl={settings.customLogoUrl}
            theme={theme}
            onToggleTheme={toggleTheme}
            onCoursesUpdated={setCourses}
            onCreateEvent={handleCreateEvent}
            onDeleteEvent={handleDeleteEvent}
            onStartMeeting={handleStartMeeting}
            onAddRecording={handleAddRecording}
            onUpdateRecording={handleUpdateRecording}
            onDeleteRecording={handleDeleteRecording}
            onSelectCourse={handleOpenCoursePage}
            onRefreshData={fetchData}
          />
        )}

        {/* TAB: ADMIN PORTAL */}
        {activeTab === 'admin-portal' && (
          <AdminPortal
            currentUser={currentUser}
            courses={courses}
            users={users}
            events={calendarEvents}
            moderationLogs={moderationLogs}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onCreateCourse={handleCreateCourse}
            onDeleteCourse={handleDeleteCourse}
            onCoursesUpdated={setCourses}
            onOpenStudentViewer={handleOpenStudentViewer}
            onTriggerZoomWebhook={handleTriggerZoomWebhook}
            onReviewModerationLog={handleReviewModerationLog}
            onSeedSample={handleSeedSampleCourse}
            onToggleStudentTester={handleToggleStudentTester}
            onDeleteUser={handleDeleteUser}
            onAddRecording={handleAddRecording}
            onUpdateRecording={handleUpdateRecording}
            onDeleteRecording={handleDeleteRecording}
            onUpdateNavItems={handleUpdateNavItems}
            onCreateEvent={handleCreateEvent}
            onTogglePinEvent={handleTogglePinEvent}
            onDeleteEvent={handleDeleteEvent}
            onPreviewPinBoard={() => setPinBoardOpen(true)}
            onStartMeeting={handleStartMeeting}
            onRefreshData={fetchData}
            adminSessionToken={adminSessionToken}
          />
        )}

        {/* TAB: COMMUNITY */}
        {activeTab === 'community' && (
          <CommunityHub
            currentUser={currentUser}
            posts={communityPosts}
            chatMessages={chatMessages}
            courses={courses}
            onAddPost={handleAddCommunityPost}
            onLikePost={handleLikePost}
            onAddComment={handleAddComment}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* TAB: SIGN IN / SIGN UP DEDICATED FULL VIEW (Seerahverse Layout + Firebase Login) */}
        {(activeTab === 'signin' || activeTab === 'signup') && (
          <AuthView
            initialMode={activeTab === 'signup' ? 'signup' : 'signin'}
            initialSignupType={signupType}
            onSignupTypeChange={(nextType) => {
              setSignupType(nextType);
              if (activeTab === 'signup') {
                updateBrowserUrl('signup', null, null, {
                  signupType: nextType,
                  replace: true,
                });
              }
            }}
            customLogoUrl={settings.customLogoUrl}
            onAuthenticated={(u, token) => {
              setCurrentUser(u);
              currentUserRef.current = u;
              if (u.preferredTheme === 'dark' || u.preferredTheme === 'light') {
                setTheme(u.preferredTheme);
              }
              if (token) setAdminSessionToken(token);
              if (u.role === 'admin') setSavedAdminUser(u);
              void fetchData(u);
            }}
            onNavigateTab={(tab) => handleNavigateWithLoader(tab)}
          />
        )}

        {/* CUSTOM DYNAMIC NAV BAR SECTION FALLBACK */}
        {!BUILT_IN_TABS.has(activeTab) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
            <div className="p-8 rounded-3xl bg-white dark:bg-[#0A192F]/90 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE]">
                Deen Hijrah Academia · Section
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {activeCustomNavItem?.label || activeTab}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Explore active cohort programs, pinned academy events, or open our published syllabus catalog below.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleNavigateWithLoader('courses')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs"
                >
                  Browse Courses
                </button>
                <button
                  type="button"
                  onClick={() => setPinBoardOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs"
                >
                  Open Events Pin Board
                </button>
              </div>
            </div>
            <CourseCatalog
              courses={courses}
              customLogoUrl={settings.customLogoUrl}
              onSelectCourse={handleOpenCoursePage}
              onOpenCreateCourse={() => handleNavigateWithLoader('admin-portal')}
              onSeedSampleCourse={handleSeedSampleCourse}
              onNavigateAuth={(mode) => handleNavigateWithLoader(mode)}
              isAdmin={currentUser?.role === 'admin'}
            />
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Firestore Error & Quota Limit Banner (Surfaces wrapped JSON errors or upgrade links) */}
      {firestoreErrorMessage && (
        <div className="fixed bottom-4 left-4 sm:left-6 z-50 max-w-md rounded-2xl p-4 shadow-2xl border backdrop-blur-xl bg-slate-950/95 border-rose-500/45 text-white text-xs space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-rose-400">
                {isQuotaExceeded ? 'Cloud Firestore Quota Limit' : 'Cloud Firestore Synchronization Notice'}
              </div>
              <p className="text-slate-200 leading-relaxed">{firestoreErrorMessage}</p>
            </div>
            <button
              type="button"
              onClick={clearFirestoreError}
              className="text-slate-400 hover:text-white shrink-0"
              aria-label="Dismiss Firestore alert"
            >
              ✕
            </button>
          </div>
          {isQuotaExceeded && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <a
                href={quotaUpgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:brightness-110 transition-all"
              >
                Upgrade Database in Console
              </a>
              <a
                href={quotaPricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-semibold hover:border-amber-400/50 transition-colors"
              >
                Spark / Enterprise Quotas
              </a>
            </div>
          )}
        </div>
      )}

      {/* In-App Dismissible Toast Banner (Replaces browser alert/window.open) */}
      {toastNotice && (
        <div className="fixed bottom-20 left-4 sm:left-6 z-50 max-w-sm rounded-2xl p-4 shadow-2xl border backdrop-blur-xl bg-slate-950/95 border-[#00F2FE]/40 text-white text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <span
              className={`font-semibold ${
                toastNotice.kind === 'error'
                  ? 'text-rose-400'
                  : toastNotice.kind === 'success'
                  ? 'text-emerald-400'
                  : 'text-[#00F2FE]'
              }`}
            >
              {toastNotice.message}
            </span>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-slate-400 hover:text-white shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
          {toastNotice.linkUrl && (
            <a
              href={toastNotice.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setToastNotice(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold hover:brightness-110 transition-all"
            >
              <span>{toastNotice.linkLabel || 'Open Classroom Link'}</span>
            </a>
          )}
        </div>
      )}

      {/* 5. Modals & Floating Assistants */}
      <EventsPinBoard
        isOpen={pinBoardOpen}
        events={calendarEvents}
        courses={courses}
        customLogoUrl={settings.customLogoUrl}
        isAdmin={currentUser?.role === 'admin'}
        isStaff={currentUser?.role === 'admin' || currentUser?.role === 'teacher'}
        onClose={() => setPinBoardOpen(false)}
        onSelectCourse={(c) => {
          setPinBoardOpen(false);
          handleOpenCoursePage(c);
        }}
        onTogglePinEvent={handleTogglePinEvent}
        onDeleteEvent={handleDeleteEvent}
        onManageEvents={() =>
          handleNavigateWithLoader(
            currentUser?.role === 'teacher' ? 'teacher-portal' : 'admin-portal'
          )
        }
        onJoinEventMeeting={handleJoinEventMeeting}
        onStartEventMeeting={handleStartEventMeeting}
      />

      {/* Built-in Live Sanctuary Classroom & Recording Studio Modal */}
      {currentUser && (
        <LiveClassroomModal
          session={activeLiveSession}
          currentUser={currentUser}
          courses={courses}
          onClose={() => setActiveLiveSession(null)}
          onRecordingSaved={(courseId, rec) => {
            setCourses((prev) =>
              prev.map((c) =>
                c.id === courseId
                  ? { ...c, videoArchives: [...(c.videoArchives || []), rec] }
                  : c
              )
            );
            void fetchData();
            showToast('success', `Class recording "${rec.title}" permanently saved to course archive.`);
          }}
          onMeetingEnded={async (info) => {
            try {
              const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
              await fetch('/api/meetings/end', {
                method: 'POST',
                headers,
                body: JSON.stringify(info),
              });
              await fetchData();
            } catch {
              // Ignore non-fatal end telemetry
            }
          }}
        />
      )}

      {/* Fallback Modal Auth (when invoked outside page routes) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-5xl my-8">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 z-30 p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 transition-colors"
              aria-label="Close sign in window"
            >
              ✕
            </button>
            <AuthView
              initialMode={authModalMode}
              initialSignupType={signupType}
              onSignupTypeChange={(nextType) => setSignupType(nextType)}
              isModal={true}
              customLogoUrl={settings.customLogoUrl}
              onClose={() => setAuthModalOpen(false)}
              onAuthenticated={(u, token) => {
                setCurrentUser(u);
                currentUserRef.current = u;
                if (u.preferredTheme === 'dark' || u.preferredTheme === 'light') {
                  setTheme(u.preferredTheme);
                }
                if (token) setAdminSessionToken(token);
                if (u.role === 'admin') setSavedAdminUser(u);
                void fetchData(u);
              }}
              onNavigateTab={(tab) => {
                handleNavigateWithLoader(tab);
                setAuthModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Account Settings Modal (Saved Timezone & Password Reset/Change) */}
      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        initialTab={accountSettingsTab}
        currentUser={currentUser}
        onClose={() => setAccountSettingsOpen(false)}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          currentUserRef.current = updatedUser;
          setStoredCachedUser(updatedUser);
          if (updatedUser.role === 'admin') {
            setSavedAdminUser(updatedUser);
          }
        }}
        onNotify={(kind, message) => showToast(kind, message)}
      />

      {/* Navigation AI Assistant */}
      <NavigationAIAssistant
        onNavigateTab={(tab) => handleNavigateWithLoader(tab)}
        userRole={currentUser?.role || 'student'}
      />

      {/* Footer */}
      <footer className={`mt-20 border-t py-10 px-4 sm:px-6 lg:px-8 text-xs transition-colors ${
        isLight
          ? 'bg-white border-slate-200 text-slate-500'
          : 'bg-[#050C1A] border-slate-800/80 text-slate-400'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Deen Hijrah Academia
            </span>
            <span aria-hidden="true">·</span>
            <span>Classical &amp; Modern Cohorts</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#0284C7] dark:text-[#00F2FE]">deenhijrahacademia.com</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {publicNavLinks.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigateWithLoader(item.key)}
                className="hover:text-[#00F2FE] transition-colors whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
