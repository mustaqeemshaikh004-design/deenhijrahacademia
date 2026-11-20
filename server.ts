import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import type {
  User,
  Course,
  AttendanceRecord,
  StudentSubmission,
  CommunityPost,
  ChatMessage,
  ModerationLog,
  PlatformSettings,
  BlogPost,
  CalendarEvent,
  AcademicAssessment,
  StudentSubjectProgress,
  FacultyProfile,
  CourseReview,
  InstructorReview
} from './src/types.ts';
import { resolveCourseAssessmentById } from './src/utils/moduleQuizHelper.ts';
import { isCloudSqlConfigured } from './src/db/index.ts';
import {
  createTeacherUserInSql,
  deleteUserFromSql,
  getOrCreateUser,
  getUserByUidFromSql,
  getUserCredentialsByEmailFromSql,
  getUsersFromSql,
  registerAccountInSql,
  updateUserAvatarInSql,
  updateUserPasswordInSql,
  updateUserTimezoneInSql,
} from './src/db/users.ts';
import {
  addCommunityPostCommentInSql,
  createAttendanceInSql,
  createAuthSessionInSql,
  createBlogPostInSql,
  createChatMessageInSql,
  createCommunityPostInSql,
  createCourseInSql,
  createEventInSql,
  createModerationLogInSql,
  createSubmissionInSql,
  createUploadedAssetInSql,
  deleteAuthSessionFromSql,
  deleteCourseInSql,
  deleteEventInSql,
  deleteRecordingInSql,
  enrollStudentInSql,
  ensureInitialSqlBootstrap,
  findOrCreateStudentByEmailInSql,
  getAuthSessionFromSql,
  getCourseByIdFromSql,
  getRawRecordingFromSql,
  getSettingsFromSql,
  getUploadedAssetFromSql,
  getUserSqlSummary,
  gradeSubmissionInSql,
  isStudentEnrolledInSql,
  listAllSubmissionsFromSql,
  listBlogPostsFromSql,
  listChatMessagesFromSql,
  listCommunityPostsFromSql,
  listCourseAttendanceFromSql,
  listCoursesFromSql,
  listEventsFromSql,
  listModerationLogsFromSql,
  listAttendanceByStudentAllFromSql,
  listStudentAttendanceFromSql,
  listStudentCourseSubmissionsFromSql,
  listStudentSubmissionsAllFromSql,
  markModerationReviewedInSql,
  toggleCommunityPostLikeInSql,
  updateCourseInSql,
  updateEventInSql,
  updateRecordingInSql,
  updateSettingsInSql,
  upsertRecordingInSql,
  verifyRecordingAccessInSql,
} from './src/db/repository.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

const SAMPLE_MP4_PATH = path.join(__dirname, 'src', 'assets', 'media', 'sample_lecture.mp4');

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#071120"/>
  <rect x="25" y="25" width="50" height="50" fill="none" stroke="#00F2FE" stroke-width="6" rx="6"/>
  <rect x="25" y="25" width="50" height="50" fill="none" stroke="#10B981" stroke-width="6" rx="6" transform="rotate(45 50 50)"/>
  <circle cx="50" cy="50" r="8" fill="#00F2FE"/>
</svg>`;

app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(200);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(FAVICON_SVG);
});

// Initialize GoogleGenAI SDK on server side with telemetry header
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Gemini SDK init warning:', err);
  }
}

// Data Directory and Persistent Storage
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const SECRET_ADMIN_KEY = 'DHA-ADMIN-MUSTAQEEM-SECRET-KEY-786-99';
const CHANCELLOR_EMAIL = 'mustaqeemshaikh004@gmail.com';
const activeAdminTokens = new Set<string>();
const memorySessions = new Map<string, { user: User; expiresAt: number }>();

try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const rawSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    if (Array.isArray(rawSessions)) {
      const now = Date.now();
      for (const entry of rawSessions) {
        if (entry?.token && entry?.user && entry?.expiresAt > now) {
          memorySessions.set(entry.token, { user: entry.user, expiresAt: entry.expiresAt });
          if (entry.user.role === 'admin') activeAdminTokens.add(entry.token);
        }
      }
    }
  }
} catch {
  // Ignore malformed fallback session file
}

function saveMemorySessions() {
  try {
    const now = Date.now();
    const list: Array<{ token: string; user: User; expiresAt: number }> = [];
    for (const [token, val] of memorySessions.entries()) {
      if (val.expiresAt > now) {
        list.push({ token, user: val.user, expiresAt: val.expiresAt });
      } else {
        memorySessions.delete(token);
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list), 'utf-8');
  } catch (e) {
    console.warn('Session disk sync warning:', e);
  }
}

// Default Database Structure with Clean Initial Administrative Slate
interface DatabaseSchema {
  users: User[];
  courses: Course[];
  attendance: AttendanceRecord[];
  submissions: StudentSubmission[];
  communityPosts: CommunityPost[];
  chatMessages: ChatMessage[];
  moderationLogs: ModerationLog[];
  blogPosts: BlogPost[];
  calendarEvents: CalendarEvent[];
  settings: PlatformSettings;
}

const initialDb: DatabaseSchema = {
  users: [
    {
      id: 'admin-mustaqeem',
      firstName: 'Mustaqeem',
      lastName: 'Shaikh',
      email: 'mustaqeemshaikh004@gmail.com',
      role: 'admin',
      gender: 'male',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    },
    {
      id: 'student-tester',
      firstName: 'Zayd',
      lastName: 'Farooq',
      email: 'zayd.farooq@deenhijrahacademia.edu',
      role: 'student',
      gender: 'male',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    }
  ],
  // Empty initial courses array as requested: "clean administrative slate for fresh course creation and resource uploads"
  courses: [],
  attendance: [],
  submissions: [],
  communityPosts: [
    {
      id: 'post-1',
      authorId: 'admin-mustaqeem',
      authorName: 'Mustaqeem Shaikh',
      authorRole: 'admin',
      authorGender: 'male',
      content: 'Bismillah! Welcome to Deen Hijrah Academia. The academy platform is initialized with Seerahverse aesthetics, automated Zoom cloud recording synchronization, and real-time international timezone clocking. We invite students and seekers of knowledge to join our sacred academic journey.',
      category: 'announcement',
      pinned: true,
      createdAt: new Date().toISOString(),
      likes: 1,
      likedByUserIds: ['admin-mustaqeem'],
      comments: [],
      flagged: false,
    }
  ],
  chatMessages: [],
  moderationLogs: [],
  blogPosts: [
    {
      id: 'blog-1',
      title: 'The Sacred Convergence: Classical Tradition Meets Frontier Technology',
      excerpt: 'How Deen Hijrah Academia bridges timeless scholastic lineage with modern educational architecture.',
      content: `In the tradition of profound scholarship, pedagogy requires clarity, discipline, and communal presence. Deen Hijrah Academia establishes an academic standard where live digital halls eliminate geographical distances. Through automated timezone alignment, automated lecture archives, and strict moderation ethics, we cultivate an intellectual sanctuary for global seekers.`,
      authorName: 'Administrator Mustaqeem',
      authorBadge: 'Founding Chancellor',
      readTime: '4 min read',
      bannerUrl: 'fallback://blog',
      publishedAt: new Date().toISOString(),
      tags: ['Academics', 'Foundational Vision', 'Scholarship']
    }
  ],
  calendarEvents: [],
  settings: {
    heroMode: 'video',
    heroVideoUrl: '',
    heroPosterUrl: 'fallback://hero',
    heroImageUrl: 'fallback://hero',
    heroHeadline: 'Pursue Sacred Knowledge with Rigor & Elegance',
    heroSubheadline: 'A sanctuary of classical Islamic scholarship engineered with immersive real-time classrooms, automated Zoom lecture archives, and global timezone intelligence.',
    customLogoUrl: '',
    customNavItems: [
      { id: 'nav-home', label: 'Home', key: 'home', isSystem: true },
      { id: 'nav-courses', label: 'Courses', key: 'courses', isSystem: true },
      { id: 'nav-preregister', label: 'Pre-Register', key: 'pre-register', isSystem: true },
      { id: 'nav-faculty', label: 'Faculty', key: 'faculty', isSystem: true },
      { id: 'nav-blogs', label: 'Articles', key: 'blogs', isSystem: true },
      { id: 'nav-counseling', label: 'Counseling', key: 'counseling', isSystem: true },
      { id: 'nav-about', label: 'About', key: 'about', isSystem: true },
      { id: 'nav-contact', label: 'Contact', key: 'contact', isSystem: true },
    ]
  }
};

function sanitizeLegacyVideoUrl(url: string | undefined, fallback = ''): string {
  const clean = (url || '').trim();
  if (
    !clean ||
    clean.includes('assets.mixkit.co') ||
    clean.includes('commondatastorage.googleapis.com/gtv-videos-bucket/sample')
  ) {
    return fallback;
  }
  return clean;
}

function loadDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const rawSettings = parsed.settings || {};
      const cleanedUsers = Array.isArray(parsed.users)
        ? parsed.users.filter((u: User) => u.id !== 'teacher-umar' && u.id !== 'teacher-fatima')
        : initialDb.users;
      const cleanedCourses = Array.isArray(parsed.courses)
        ? parsed.courses.map((c: Course) => ({
            ...c,
            instructorId: c.instructorId === 'teacher-umar' ? 'admin-mustaqeem' : c.instructorId,
            instructorName:
              c.instructorName?.includes('Umar') || c.instructorName?.includes('Fatima')
                ? 'Mustaqeem Shaikh'
                : c.instructorName,
            videoArchives: Array.isArray(c.videoArchives)
              ? c.videoArchives.map((v) => ({
                  ...v,
                  videoUrl: sanitizeLegacyVideoUrl(v.videoUrl, '/api/streams/sample/lecture'),
                }))
              : [],
          }))
        : initialDb.courses;

      const rawNav = Array.isArray(rawSettings.customNavItems) ? rawSettings.customNavItems : [];
      const legacyNavKeys = ['home', 'courses', 'blogs', 'faculty', 'about', 'contact'];
      const isLegacyNav =
        rawNav.length === 6 && rawNav.every((n: any, idx: number) => n?.key === legacyNavKeys[idx]);

      return {
        ...initialDb,
        ...parsed,
        users: cleanedUsers,
        courses: cleanedCourses,
        settings: {
          ...initialDb.settings,
          ...rawSettings,
          heroVideoUrl: sanitizeLegacyVideoUrl(rawSettings.heroVideoUrl, ''),
          customNavItems:
            rawNav.length > 0 && !isLegacyNav ? rawNav : initialDb.settings.customNavItems
        }
      };
    }
  } catch (e) {
    console.error('Error reading db.json, returning default:', e);
  }
  saveDb(initialDb);
  return initialDb;
}

function saveDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving db.json:', e);
  }
}

let db = loadDb();

// Safety & Moderation Filter
const PROHIBITED_KEYWORDS = [
  'scam', 'crypto hack', 'spam link', 'viagra', 'offensive_slur',
  'hate_speech', 'vulgar_word', 'buy followers', 'telegram cheat', 'bot spam'
];

function checkContentSafety(text: string): { safe: boolean; flaggedKeyword?: string } {
  const lower = text.toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS) {
    if (lower.includes(kw)) {
      return { safe: false, flaggedKeyword: kw };
    }
  }
  // Check for suspicious external spam links
  if (/http[s]?:\/\/(bit\.ly|tinyurl\.com|t\.me\/|free-crypto)/i.test(lower)) {
    return { safe: false, flaggedKeyword: 'suspicious_external_link' };
  }
  return { safe: true };
}

const SESSION_COOKIE_NAME = 'dha_session';

function parseSessionCookie(cookieHeader?: string): string {
  if (!cookieHeader) return '';
  const pairs = cookieHeader.split(';');
  for (const rawPair of pairs) {
    const eqIdx = rawPair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = rawPair.slice(0, eqIdx).trim();
    if (key === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(rawPair.slice(eqIdx + 1).trim());
      } catch {
        return rawPair.slice(eqIdx + 1).trim();
      }
    }
  }
  return '';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  if (!token) return;
  const isHttps =
    req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase().includes('https');
  const cookieAttrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=2592000',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase().includes('https');
  const cookieAttrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

function extractSessionToken(req: Request): string {
  const xSess = String(req.headers['x-session-token'] || '').trim();
  if (xSess) return xSess;
  const xAdmin = String(req.headers['x-admin-session'] || '').trim();
  if (xAdmin) return xAdmin;
  const qSt = typeof req.query?.st === 'string' ? req.query.st.trim() : '';
  if (qSt) return qSt;
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.startsWith('Bearer dha_')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookieTok = parseSessionCookie(req.headers.cookie);
  if (cookieTok) return cookieTok;
  return '';
}

async function issueSessionToken(user: User): Promise<string> {
  const token = `dha_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  memorySessions.set(token, { user, expiresAt: expiresAt.getTime() });
  if (user.role === 'admin' || user.email.toLowerCase() === CHANCELLOR_EMAIL) {
    activeAdminTokens.add(token);
  }
  saveMemorySessions();
  if (isCloudSqlConfigured()) {
    try {
      await createAuthSessionInSql({
        token,
        userUid: user.id,
        email: user.email,
        role: user.role,
        expiresAt,
      });
    } catch (err) {
      console.warn('SQL session persistence warning:', err);
    }
  }
  return token;
}

async function resolveRequestActor(
  req: Request
): Promise<{ user: User; isAdmin: boolean; isStaff: boolean } | null> {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer dha_')) {
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const email = (decoded.email || '').toLowerCase();
        const isChancellor = email === CHANCELLOR_EMAIL && decoded.email_verified === true;
        if (isCloudSqlConfigured()) {
          const existing = await getUserByUidFromSql(decoded.uid);
          if (existing) {
            const isAdmin = existing.role === 'admin' || isChancellor;
            return {
              user: existing,
              isAdmin,
              isStaff: isAdmin || existing.role === 'teacher',
            };
          }
          const parts = (decoded.name || 'Scholar User').split(' ');
          const created = await getOrCreateUser(decoded.uid, email || `${decoded.uid}@deenhijrahacademia.edu`, {
            firstName: parts[0] || 'Scholar',
            lastName: parts.slice(1).join(' ') || 'User',
            avatarUrl: decoded.picture || undefined,
          });
          const isAdmin = created.role === 'admin' || isChancellor;
          return {
            user: created,
            isAdmin,
            isStaff: isAdmin || created.role === 'teacher',
          };
        }
        const matched = db.users.find(
          (u) => u.id === decoded.uid || (email && u.email.toLowerCase() === email)
        );
        if (matched) {
          const isAdmin = matched.role === 'admin' || isChancellor;
          return {
            user: matched,
            isAdmin,
            isStaff: isAdmin || matched.role === 'teacher',
          };
        }
      } catch {
        // Ignore invalid/expired Firebase token and try session token
      }
    }
  }

  const sessionToken = extractSessionToken(req);
  if (!sessionToken) return null;

  if (isCloudSqlConfigured()) {
    try {
      const sqlSess = await getAuthSessionFromSql(sessionToken);
      if (sqlSess) {
        const isAdmin =
          sqlSess.role === 'admin' ||
          sqlSess.user.role === 'admin' ||
          sqlSess.user.email.toLowerCase() === CHANCELLOR_EMAIL;
        return {
          user: sqlSess.user,
          isAdmin,
          isStaff: isAdmin || sqlSess.role === 'teacher' || sqlSess.user.role === 'teacher',
        };
      }
    } catch {
      // Fallback to in-memory session lookup
    }
  }

  const memSess = memorySessions.get(sessionToken);
  if (memSess) {
    if (memSess.expiresAt > Date.now()) {
      const isAdmin =
        memSess.user.role === 'admin' ||
        memSess.user.email.toLowerCase() === CHANCELLOR_EMAIL;
      return {
        user: memSess.user,
        isAdmin,
        isStaff: isAdmin || memSess.user.role === 'teacher',
      };
    }
    memorySessions.delete(sessionToken);
  }

  if (activeAdminTokens.has(sessionToken)) {
    const adminUser =
      db.users.find((u) => u.role === 'admin') ||
      initialDb.users[0];
    return { user: adminUser, isAdmin: true, isStaff: true };
  }

  return null;
}

async function requireAdminActor(
  req: Request,
  res: Response
): Promise<{ user: User; isAdmin: boolean; isStaff: boolean } | null> {
  const actor = await resolveRequestActor(req);
  if (!actor) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return null;
  }
  if (!actor.isAdmin) {
    res.status(403).json({ error: 'Administrator Mustaqeem authorization required.' });
    return null;
  }
  return actor;
}

async function requireStaffActor(
  req: Request,
  res: Response
): Promise<{ user: User; isAdmin: boolean; isStaff: boolean } | null> {
  const actor = await resolveRequestActor(req);
  if (!actor) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return null;
  }
  if (!actor.isStaff && !actor.isAdmin) {
    res.status(403).json({ error: 'Instructor or Administrator authorization required.' });
    return null;
  }
  return actor;
}

function formatBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ================= CLOUD SQL + FIREBASE AUTH PROTECTED ROUTES =================

app.post('/api/sql/auth/session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudSqlConfigured()) {
      return res.status(503).json({ error: 'Cloud SQL database is not configured.' });
    }
    const uid = req.user!.uid;
    const email = (req.user!.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Verified email is required.' });
    }
    const isChancellor = email === CHANCELLOR_EMAIL && req.user!.email_verified === true;
    const displayParts = (req.user!.name || '').split(' ');
    const user = await getOrCreateUser(uid, email, {
      firstName: req.body?.firstName || displayParts[0] || 'Scholar',
      lastName: req.body?.lastName || displayParts.slice(1).join(' ') || 'User',
      gender: req.body?.gender === 'female' ? 'female' : 'male',
      avatarUrl: req.body?.avatarUrl || req.user!.picture || undefined,
      avatarStoragePath: req.body?.avatarStoragePath || undefined,
      role: isChancellor ? 'admin' : 'student',
    });
    const sessionToken = await issueSessionToken(user);
    setSessionCookie(req, res, sessionToken);
    res.json({
      user,
      sessionToken,
      ...(user.role === 'admin' ? { adminSessionToken: sessionToken } : {}),
    });
  } catch (error: any) {
    console.error('SQL auth session sync error:', error);
    res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

app.get('/api/sql/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudSqlConfigured()) {
      return res.status(503).json({ error: 'Cloud SQL database is not configured.' });
    }
    const uid = req.user!.uid;
    const email = req.user!.email || '';
    const user = await getOrCreateUser(uid, email);
    const summary = await getUserSqlSummary(uid);
    res.json({
      user,
      enrolledCourseIds: summary.enrolledCourseIds,
      attendanceRecords: summary.attendanceRecords,
    });
  } catch (error: any) {
    console.error('Failed to fetch SQL profile summary:', error);
    res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

app.get('/api/sql/enrollments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudSqlConfigured()) {
      return res.status(503).json({ error: 'Cloud SQL database is not configured.' });
    }
    const uid = req.user!.uid;
    const summary = await getUserSqlSummary(uid);
    res.json({ enrolledCourseIds: summary.enrolledCourseIds });
  } catch (error: any) {
    console.error('Failed to fetch user enrollments:', error);
    res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

app.post('/api/sql/courses/:id/enroll', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudSqlConfigured()) {
      return res.status(503).json({ error: 'Cloud SQL database is not configured.' });
    }
    const uid = req.user!.uid;
    const email = req.user!.email || '';
    const course = await getCourseByIdFromSql(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    await getOrCreateUser(uid, email);
    await enrollStudentInSql(course.id, uid, email);
    const updatedCourse = await getCourseByIdFromSql(course.id);
    res.json({ success: true, course: updatedCourse });
  } catch (error: any) {
    console.error('SQL enrollment error:', error);
    res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

app.get('/api/sql/courses/:id/recordings/:recId/access', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudSqlConfigured()) {
      return res.status(503).json({ error: 'Cloud SQL database is not configured.' });
    }
    const uid = req.user!.uid;
    const email = req.user!.email || '';
    const result = await verifyRecordingAccessInSql(req.params.id, req.params.recId, uid, email);
    if (!result.found) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    if (!result.authorized) {
      return res.status(403).json({
        error: 'Enrollment required to stream private course lectures.',
        authorized: false,
      });
    }
    res.json(result);
  } catch (error: any) {
    console.error('SQL recording access error:', error);
    res.status(500).json({ error: error.message || 'Database query failed. Please try again later.' });
  }
});

// ================= API ROUTES =================

// Auth / User Management
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const {
      firstName,
      lastName,
      gender,
      accountType,
      type,
      email: rawEmail,
      password: rawPassword,
      phoneWhatsApp,
      country,
      city,
      timezone,
      qualifications,
      expertise,
      preferredLanguage,
    } = body;

    if (!firstName || !lastName || !gender) {
      return res.status(400).json({ error: 'First Name, Last Name, and Gender are required.' });
    }

    const rawType = String(accountType || type || 'student').trim().toLowerCase();
    const resolvedRole: 'student' | 'teacher' =
      rawType === 'instructor' || rawType === 'teacher' ? 'teacher' : 'student';

    const trimmedCustomEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const trimmedPassword = typeof rawPassword === 'string' ? rawPassword.trim() : '';

    if (trimmedCustomEmail === CHANCELLOR_EMAIL) {
      return res.status(403).json({
        error: 'This email is reserved for the Founding Chancellor account. Please use Sign In.',
      });
    }

    if (trimmedCustomEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedCustomEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (resolvedRole === 'teacher' && (!trimmedCustomEmail || trimmedPassword.length < 6)) {
      return res.status(400).json({
        error: 'Instructor sign-up requires a valid email address and a password of at least 6 characters.',
      });
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.',
      });
    }

    const cleanFirst =
      String(firstName).trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'scholar';
    const cleanLast =
      String(lastName).trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
    const finalEmail = trimmedCustomEmail || `${cleanFirst}.${cleanLast}@deenhijrahacademia.edu`;
    const normalizedGender = gender === 'female' ? 'female' : 'male';
    const encodedPassword = trimmedPassword ? hashAccessPassword(trimmedPassword) : null;
    const isCustomSignup = Boolean(trimmedCustomEmail || trimmedPassword || resolvedRole === 'teacher');

    let user: User;
    if (isCloudSqlConfigured()) {
      user = await registerAccountInSql({
        email: finalEmail,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        role: resolvedRole,
        gender: normalizedGender,
        accessCode: encodedPassword,
        timezone: typeof timezone === 'string' ? timezone.trim() || null : null,
        failIfEmailExists: isCustomSignup,
      });
    } else {
      const existing = db.users.find((u) => u.email.toLowerCase() === finalEmail);
      if (existing) {
        if (isCustomSignup) {
          return res.status(409).json({
            error: 'An account with this email already exists. Please sign in instead.',
          });
        }
        user = existing;
      } else {
        const prefix = resolvedRole === 'teacher' ? 'tch' : 'std';
        const newUserRecord: any = {
          id: `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: finalEmail,
          role: resolvedRole,
          gender: normalizedGender,
          timezone: typeof timezone === 'string' ? timezone.trim() || undefined : undefined,
          hasCustomPassword: Boolean(encodedPassword),
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
        };
        if (encodedPassword) {
          newUserRecord.accessCode = encodedPassword;
        }
        db.users.push(newUserRecord);
        saveDb(db);
        const { accessCode: _ac, ...safeUser } = newUserRecord;
        user = safeUser;
      }
    }

    if (phoneWhatsApp || country || city || qualifications || expertise) {
      await persistJsonIntakeRecord(`signup_${user.id}`, `${resolvedRole}_application`, {
        userId: user.id,
        role: resolvedRole,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: user.gender,
        phoneWhatsApp: String(phoneWhatsApp || '').trim(),
        country: String(country || '').trim(),
        city: String(city || '').trim(),
        timezone: String(timezone || user.timezone || '').trim(),
        qualifications: String(qualifications || '').trim(),
        expertise: String(expertise || '').trim(),
        preferredLanguage: String(preferredLanguage || 'English').trim(),
        submittedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Signup metadata save warning:', err));
    }

    const userWithTheme = await attachPreferredTheme(user);
    const sessionToken = await issueSessionToken(userWithTheme);
    setSessionCookie(req, res, sessionToken);
    return res.json({
      user: userWithTheme,
      sessionToken,
      message:
        resolvedRole === 'teacher'
          ? 'Instructor portal account registered successfully.'
          : isCustomSignup
          ? 'Student account created successfully.'
          : 'Institutional account generated successfully.',
      ...(!encodedPassword && resolvedRole === 'student' ? { defaultPassword: '6789' } : {}),
    });
  } catch (error: any) {
    console.error('Signup failed:', error);
    const status = error?.statusCode === 409 ? 409 : 500;
    res.status(status).json({ error: error.message || 'Signup failed. Please try again later.' });
  }
});

app.post('/api/auth/verify-secret-admin', async (req: Request, res: Response) => {
  try {
    const { secretKey } = req.body;
    if (secretKey === SECRET_ADMIN_KEY) {
      if (isCloudSqlConfigured()) {
        await ensureInitialSqlBootstrap();
        const sqlUsers = await getUsersFromSql();
        const adminUser = sqlUsers.find(u => u.role === 'admin') || sqlUsers[0];
        const sessionToken = await issueSessionToken(adminUser);
        setSessionCookie(req, res, sessionToken);
        return res.json({
          valid: true,
          user: adminUser,
          token: sessionToken,
          sessionToken,
        });
      }
      const adminUser = db.users.find(u => u.role === 'admin') || db.users[0];
      const sessionToken = await issueSessionToken(adminUser);
      setSessionCookie(req, res, sessionToken);
      return res.json({
        valid: true,
        user: adminUser,
        token: sessionToken,
        sessionToken,
      });
    }
    return res.status(401).json({ valid: false, error: 'Invalid Administrator Security Token' });
  } catch (error: any) {
    console.error('Admin verification failed:', error);
    res.status(500).json({ error: error.message || 'Verification failed. Please try again later.' });
  }
});

function hashAccessPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyStoredAccessPassword(
  submitted: string,
  stored: string | null | undefined
): boolean {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    if (!salt || !hexHash) return false;
    const derived = crypto.scryptSync(submitted, salt, 64);
    const expectedBuf = Buffer.from(hexHash, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  }
  return submitted === stored;
}

function syncMemorySessionsUserPatch(userId: string, patch: Partial<User>): void {
  let changed = false;
  for (const [tok, sess] of memorySessions.entries()) {
    if (sess.user.id === userId) {
      memorySessions.set(tok, {
        ...sess,
        user: { ...sess.user, ...patch },
      });
      changed = true;
    }
  }
  if (changed) saveMemorySessions();
}

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const submittedPassword = String(password || '');

    if (!cleanEmail || !submittedPassword) {
      return res.status(400).json({ error: 'Please enter both email address and password.' });
    }

    const expectedAdminPassword = process.env.ADMIN_SECRET_PASSWORD || SECRET_ADMIN_KEY;
    const isAdminEmail = cleanEmail === CHANCELLOR_EMAIL;

    let matchedUser: User | undefined;
    let storedAccessCode: string | null = null;

    if (isCloudSqlConfigured()) {
      await ensureInitialSqlBootstrap();
      const cred = await getUserCredentialsByEmailFromSql(cleanEmail);
      if (cred) {
        matchedUser = cred.user;
        storedAccessCode = cred.accessCode;
      } else if (isAdminEmail) {
        const sqlUsers = await getUsersFromSql();
        matchedUser = sqlUsers.find((u) => u.role === 'admin');
      }
    } else {
      const localMatch = db.users.find((u) => u.email.toLowerCase() === cleanEmail) as
        | (User & { accessCode?: string })
        | undefined;
      if (localMatch) {
        const { accessCode, ...safeUser } = localMatch;
        matchedUser = safeUser;
        storedAccessCode = accessCode || null;
      }
    }

    if (isAdminEmail || matchedUser?.role === 'admin') {
      const validAdminPass = storedAccessCode
        ? verifyStoredAccessPassword(submittedPassword, storedAccessCode)
        : submittedPassword === expectedAdminPassword;
      if (!validAdminPass) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (!matchedUser) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const userWithFlag = await attachPreferredTheme({
        ...matchedUser,
        hasCustomPassword: Boolean(storedAccessCode),
      });
      const sessionToken = await issueSessionToken(userWithFlag);
      setSessionCookie(req, res, sessionToken);
      return res.json({ user: userWithFlag, sessionToken, adminSessionToken: sessionToken });
    }

    if (!matchedUser) {
      return res.status(401).json({
        error: 'Account not found. Please verify your email or create an institutional account.',
      });
    }

    const validUserPass = storedAccessCode
      ? verifyStoredAccessPassword(submittedPassword, storedAccessCode)
      : submittedPassword === '6789';
    if (!validUserPass) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userWithFlag = await attachPreferredTheme({
      ...matchedUser,
      hasCustomPassword: Boolean(storedAccessCode),
    });
    const sessionToken = await issueSessionToken(userWithFlag);
    setSessionCookie(req, res, sessionToken);
    return res.json({ user: userWithFlag, sessionToken });
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(500).json({ error: error.message || 'Sign in failed. Please try again later.' });
  }
});

app.post('/api/auth/change-password', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to update your password.' });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '').trim();
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ error: 'New password is too long.' });
    }

    const expectedAdminPassword = process.env.ADMIN_SECRET_PASSWORD || SECRET_ADMIN_KEY;
    const isAdminActor = actor.user.role === 'admin' || actor.user.email.toLowerCase() === CHANCELLOR_EMAIL;

    let targetUid = actor.user.id;
    let storedAccessCode: string | null = null;

    if (isCloudSqlConfigured()) {
      await ensureInitialSqlBootstrap();
      const cred = await getUserCredentialsByEmailFromSql(actor.user.email);
      if (cred) {
        targetUid = cred.user.id;
        storedAccessCode = cred.accessCode;
      }
    } else {
      const localMatch = db.users.find(
        (u) => u.id === actor.user.id || u.email.toLowerCase() === actor.user.email.toLowerCase()
      ) as (User & { accessCode?: string }) | undefined;
      if (localMatch) {
        targetUid = localMatch.id;
        storedAccessCode = localMatch.accessCode || null;
      }
    }

    const authHeader = String(req.headers.authorization || '').trim();
    const hasFirebaseBearer = authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer dha_');

    if (isAdminActor) {
      const matchesCurrent = storedAccessCode
        ? verifyStoredAccessPassword(currentPassword, storedAccessCode)
        : currentPassword === expectedAdminPassword;
      if (!currentPassword || !matchesCurrent) {
        return res.status(401).json({ error: 'Your current administrator password did not match.' });
      }
    } else if (storedAccessCode) {
      if (!currentPassword || !verifyStoredAccessPassword(currentPassword, storedAccessCode)) {
        return res.status(401).json({ error: 'Your current password is incorrect.' });
      }
    } else if (currentPassword) {
      if (currentPassword !== '6789') {
        return res.status(401).json({
          error: 'Current password incorrect. Newly onboarded student accounts start with default key 6789.',
        });
      }
    } else if (!hasFirebaseBearer) {
      return res.status(400).json({
        error: 'Please enter your current password (default key is 6789 if unchanged).',
      });
    }

    const hashed = hashAccessPassword(newPassword);
    let updatedUser: User | null = null;
    if (isCloudSqlConfigured()) {
      updatedUser = await updateUserPasswordInSql(targetUid, hashed);
    } else {
      const idx = db.users.findIndex(
        (u) => u.id === targetUid || u.email.toLowerCase() === actor.user.email.toLowerCase()
      );
      if (idx >= 0) {
        (db.users[idx] as User & { accessCode?: string }).accessCode = hashed;
        (db.users[idx] as User).lastActive = new Date().toISOString();
        saveDb(db);
        const { accessCode: _ac, ...safe } = db.users[idx] as User & { accessCode?: string };
        updatedUser = { ...safe, hasCustomPassword: true };
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ error: 'User account record not found.' });
    }

    syncMemorySessionsUserPatch(updatedUser.id, { hasCustomPassword: true });

    return res.json({
      success: true,
      user: { ...updatedUser, hasCustomPassword: true },
      message: 'Your new password has been saved. Use it on future sign-ins.',
    });
  } catch (error: any) {
    console.error('Change password failed:', error);
    res.status(500).json({ error: error.message || 'Unable to update password right now.' });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!cleanEmail || !currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Please enter your email address, existing password, and new password.',
      });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({
        error: 'Please choose a new password that differs from your existing password.',
      });
    }

    const expectedAdminPassword = process.env.ADMIN_SECRET_PASSWORD || SECRET_ADMIN_KEY;
    const isAdminEmail = cleanEmail === CHANCELLOR_EMAIL;

    let matchedUser: User | undefined;
    let storedAccessCode: string | null = null;

    if (isCloudSqlConfigured()) {
      await ensureInitialSqlBootstrap();
      const cred = await getUserCredentialsByEmailFromSql(cleanEmail);
      if (cred) {
        matchedUser = cred.user;
        storedAccessCode = cred.accessCode;
      } else if (isAdminEmail) {
        const sqlUsers = await getUsersFromSql();
        matchedUser = sqlUsers.find((u) => u.role === 'admin');
      }
    } else {
      const localMatch = db.users.find((u) => u.email.toLowerCase() === cleanEmail) as
        | (User & { accessCode?: string })
        | undefined;
      if (localMatch) {
        const { accessCode, ...safeUser } = localMatch;
        matchedUser = safeUser;
        storedAccessCode = accessCode || null;
      }
    }

    if (!matchedUser) {
      return res.status(404).json({
        error: 'No institutional account found for that email address.',
      });
    }

    const isAdminAccount = isAdminEmail || matchedUser.role === 'admin';
    const isExistingValid = isAdminAccount
      ? storedAccessCode
        ? verifyStoredAccessPassword(currentPassword, storedAccessCode)
        : currentPassword === expectedAdminPassword
      : storedAccessCode
      ? verifyStoredAccessPassword(currentPassword, storedAccessCode)
      : currentPassword === '6789';

    if (!isExistingValid) {
      return res.status(401).json({
        error: 'The existing password you entered is incorrect. (New student accounts start with 6789.)',
      });
    }

    const hashed = hashAccessPassword(newPassword);
    if (isCloudSqlConfigured()) {
      await updateUserPasswordInSql(matchedUser.id, hashed);
    } else {
      const idx = db.users.findIndex((u) => u.id === matchedUser!.id);
      if (idx >= 0) {
        (db.users[idx] as User & { accessCode?: string }).accessCode = hashed;
        (db.users[idx] as User).lastActive = new Date().toISOString();
        saveDb(db);
      }
    }

    syncMemorySessionsUserPatch(matchedUser.id, { hasCustomPassword: true });

    return res.json({
      success: true,
      message: 'Your new password has been set. You can now sign in with your updated credentials.',
    });
  } catch (error: any) {
    console.error('Reset password failed:', error);
    res.status(500).json({ error: error.message || 'Unable to reset password right now.' });
  }
});

app.get('/api/auth/session', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.json({ authenticated: false, user: null });
    }
    const token = extractSessionToken(req);
    const enrichedUser = await attachPreferredTheme(actor.user);
    res.json({
      authenticated: true,
      user: enrichedUser,
      isAdmin: actor.isAdmin,
      ...(token ? { sessionToken: token } : {}),
      ...(actor.isAdmin && token ? { adminSessionToken: token } : {}),
    });
  } catch (error: any) {
    console.error('Session restore failed:', error);
    res.status(500).json({ error: error.message || 'Session restore failed' });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const token = extractSessionToken(req);
    if (token) {
      activeAdminTokens.delete(token);
      memorySessions.delete(token);
      saveMemorySessions();
      if (isCloudSqlConfigured()) {
        await deleteAuthSessionFromSql(token).catch(() => {});
      }
    }
    clearSessionCookie(req, res);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message || 'Logout failed' });
  }
});

app.get('/api/admin/credentials', async (req: Request, res: Response) => {
  const actor = await resolveRequestActor(req);
  if (!actor?.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized: Administrator verification required.' });
  }

  return res.json({
    email: CHANCELLOR_EMAIL,
    secretKey: process.env.ADMIN_SECRET_PASSWORD || SECRET_ADMIN_KEY,
  });
});

app.post('/api/auth/google-callback', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const verifiedUid = req.user!.uid;
    const verifiedEmail = (req.user!.email || '').trim().toLowerCase();

    if (!verifiedEmail) {
      return res.status(400).json({ error: 'Verified email is required for Google authentication.' });
    }

    const isChancellor =
      verifiedEmail === CHANCELLOR_EMAIL && req.user!.email_verified === true;
    const { firstName, lastName, avatarUrl, avatarStoragePath, requestedRole } = req.body || {};
    const desiredNonAdminRole =
      requestedRole === 'teacher' || requestedRole === 'instructor' ? 'teacher' : 'student';
    const derivedRole = isChancellor ? 'admin' : desiredNonAdminRole;

    if (isCloudSqlConfigured()) {
      const user = await getOrCreateUser(verifiedUid, verifiedEmail, {
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        avatarUrl: avatarUrl || req.user?.picture || undefined,
        avatarStoragePath: avatarStoragePath || undefined,
        role: derivedRole,
      });
      const enrichedSqlUser = await attachPreferredTheme(user);
      const sessionToken = await issueSessionToken(enrichedSqlUser);
      setSessionCookie(req, res, sessionToken);
      return res.json({
        user: enrichedSqlUser,
        sessionToken,
        ...(isChancellor ? { adminSessionToken: sessionToken } : {}),
        message: 'Authenticated successfully with Google via Firebase.',
      });
    }

    let user = db.users.find(
      u => u.id === verifiedUid || u.email.toLowerCase() === verifiedEmail
    );

    if (!user) {
      user = {
        id: verifiedUid,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        email: verifiedEmail,
        role: derivedRole,
        gender: 'male',
        avatarUrl: avatarUrl || req.user?.picture || undefined,
        avatarStoragePath: avatarStoragePath || undefined,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      db.users.push(user);
      saveDb(db);
    } else {
      user.lastActive = new Date().toISOString();
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      if (avatarStoragePath) {
        user.avatarStoragePath = avatarStoragePath;
      }
      if (isChancellor) {
        user.role = 'admin';
      }
      saveDb(db);
    }

    const enrichedUser = await attachPreferredTheme(user);
    const sessionToken = await issueSessionToken(enrichedUser);
    setSessionCookie(req, res, sessionToken);
    res.json({
      user: enrichedUser,
      sessionToken,
      ...(isChancellor ? { adminSessionToken: sessionToken } : {}),
      message: 'Authenticated successfully with Google via Firebase.',
    });
  } catch (error: any) {
    console.error('Google callback failed:', error);
    res.status(500).json({ error: error.message || 'Authentication failed. Please try again later.' });
  }
});

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      await ensureInitialSqlBootstrap();
      const sqlUsers = await getUsersFromSql();
      return res.json(sqlUsers);
    }
    res.json(db.users.map((u: any) => {
      const { accessCode: _ac, ...safe } = u;
      return safe;
    }));
  } catch (error: any) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

app.get('/api/teachers', async (_req: Request, res: Response) => {
  try {
    const allUsers = isCloudSqlConfigured()
      ? (await ensureInitialSqlBootstrap(), await getUsersFromSql())
      : db.users;
    const instructors = allUsers
      .filter((u) => u.role === 'teacher' || u.role === 'admin')
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        gender: u.gender,
      }));
    res.json(instructors);
  } catch (error: any) {
    console.error('Failed to fetch teachers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch teachers' });
  }
});

app.post('/api/admin/teachers', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    const { firstName, lastName, email, password, gender } = req.body || {};
    const cleanFirst = String(firstName || '').trim();
    const cleanLast = String(lastName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const normalizedGender = gender === 'female' ? 'female' : 'male';

    if (!cleanFirst || !cleanLast || !cleanEmail || cleanPassword.length < 4) {
      return res.status(400).json({
        error: 'First name, last name, valid email, and password (min 4 characters) are required.',
      });
    }
    if (cleanEmail === CHANCELLOR_EMAIL) {
      return res.status(400).json({ error: 'Cannot overwrite administrator account.' });
    }

    const uid = `tchr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (isCloudSqlConfigured()) {
      const existingCred = await getUserCredentialsByEmailFromSql(cleanEmail);
      const targetUid = existingCred?.user.id || uid;
      const teacherUser = await createTeacherUserInSql({
        uid: targetUid,
        email: cleanEmail,
        firstName: cleanFirst,
        lastName: cleanLast,
        gender: normalizedGender,
        accessCode: cleanPassword,
      });
      return res.status(201).json(teacherUser);
    }

    const existingIdx = db.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    const teacherRecord: User & { accessCode?: string } = {
      id: existingIdx >= 0 ? db.users[existingIdx].id : uid,
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      role: 'teacher',
      gender: normalizedGender,
      accessCode: cleanPassword,
      createdAt: existingIdx >= 0 ? db.users[existingIdx].createdAt : new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      db.users[existingIdx] = teacherRecord;
    } else {
      db.users.push(teacherRecord);
    }
    saveDb(db);
    const { accessCode: _ac, ...safeTeacher } = teacherRecord;
    res.status(201).json(safeTeacher);
  } catch (error: any) {
    console.error('Failed to create teacher account:', error);
    res.status(500).json({ error: error.message || 'Failed to create teacher account.' });
  }
});

app.patch('/api/users/:id/avatar', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Sign in required to update profile photo.' });
    }

    const { avatarUrl, avatarStoragePath, email } = req.body || {};
    const targetEmail = String(email || '').trim().toLowerCase();
    const isSelf =
      actor.user.id === req.params.id ||
      (targetEmail && actor.user.email.toLowerCase() === targetEmail);
    if (!actor.isAdmin && !isSelf) {
      return res.status(403).json({ error: 'You can only update your own profile picture.' });
    }

    if (typeof avatarUrl !== 'string' || avatarUrl.length > 2048) {
      return res.status(400).json({ error: 'Invalid avatar URL payload.' });
    }

    if (isCloudSqlConfigured()) {
      let updated = await updateUserAvatarInSql(req.params.id, avatarUrl, avatarStoragePath);
      if (!updated && actor.user.id && actor.user.id !== req.params.id) {
        updated = await updateUserAvatarInSql(actor.user.id, avatarUrl, avatarStoragePath);
      }
      if (!updated && email) {
        const allUsers = await getUsersFromSql();
        const byEmail = allUsers.find(
          u => u.email.toLowerCase() === targetEmail
        );
        if (byEmail) {
          updated = await updateUserAvatarInSql(byEmail.id, avatarUrl, avatarStoragePath);
        }
      }
      if (!updated) return res.status(404).json({ error: 'User not found' });
      return res.json(updated);
    }

    const user = db.users.find(
      u => u.id === req.params.id || (targetEmail && u.email.toLowerCase() === targetEmail)
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.avatarUrl = avatarUrl;
    if (avatarStoragePath !== undefined) {
      user.avatarStoragePath = avatarStoragePath;
    }
    saveDb(db);
    res.json(user);
  } catch (error: any) {
    console.error('Failed to update avatar:', error);
    res.status(500).json({ error: error.message || 'Failed to update avatar' });
  }
});

app.patch('/api/users/:id/timezone', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Sign in required to save your timezone.' });
    }

    const { timezone, email } = req.body || {};
    const targetEmail = String(email || '').trim().toLowerCase();
    const isSelf =
      actor.user.id === req.params.id ||
      (targetEmail && actor.user.email.toLowerCase() === targetEmail);
    if (!actor.isAdmin && !isSelf) {
      return res.status(403).json({ error: 'You can only update your own timezone preference.' });
    }

    const cleanTz = typeof timezone === 'string' ? timezone.trim() : '';
    if (cleanTz) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: cleanTz });
      } catch {
        return res.status(400).json({ error: `Invalid IANA timezone: "${cleanTz}".` });
      }
    }

    const nextTimezone = cleanTz || null;
    if (isCloudSqlConfigured()) {
      let updated = await updateUserTimezoneInSql(req.params.id, nextTimezone);
      if (!updated && actor.user.id && actor.user.id !== req.params.id) {
        updated = await updateUserTimezoneInSql(actor.user.id, nextTimezone);
      }
      if (!updated && (targetEmail || actor.user.email)) {
        const allUsers = await getUsersFromSql();
        const byEmail = allUsers.find(
          (u) => u.email.toLowerCase() === (targetEmail || actor.user.email.toLowerCase())
        );
        if (byEmail) {
          updated = await updateUserTimezoneInSql(byEmail.id, nextTimezone);
        }
      }
      if (!updated) return res.status(404).json({ error: 'User not found' });
      syncMemorySessionsUserPatch(updated.id, { timezone: updated.timezone });
      return res.json(updated);
    }

    const user = db.users.find(
      (u) =>
        u.id === req.params.id ||
        u.id === actor.user.id ||
        (targetEmail && u.email.toLowerCase() === targetEmail)
    ) as (User & { accessCode?: string }) | undefined;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (nextTimezone) {
      user.timezone = nextTimezone;
    } else {
      delete user.timezone;
    }
    user.lastActive = new Date().toISOString();
    saveDb(db);
    const { accessCode: _ac, ...safeUser } = user;
    syncMemorySessionsUserPatch(safeUser.id, { timezone: safeUser.timezone });
    return res.json(safeUser);
  } catch (error: any) {
    console.error('Failed to update timezone:', error);
    res.status(500).json({ error: error.message || 'Failed to save timezone preference' });
  }
});

app.patch('/api/users/:id/theme', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Sign in required to save your theme preference.' });
    }

    const { theme, email } = req.body || {};
    const targetEmail = String(email || '').trim().toLowerCase();
    const isSelf =
      actor.user.id === req.params.id ||
      (targetEmail && actor.user.email.toLowerCase() === targetEmail);
    if (!actor.isAdmin && !isSelf) {
      return res.status(403).json({ error: 'You can only update your own theme preference.' });
    }

    if (theme !== 'dark' && theme !== 'light') {
      return res.status(400).json({ error: 'Theme preference must be "dark" or "light".' });
    }

    const targetUid = actor.isAdmin ? req.params.id : actor.user.id;
    await saveStoredThemePreference(targetUid, theme);

    if (!isCloudSqlConfigured()) {
      const localUser = db.users.find(
        (u) =>
          u.id === targetUid ||
          u.id === req.params.id ||
          (targetEmail && u.email.toLowerCase() === targetEmail)
      );
      if (localUser) {
        localUser.preferredTheme = theme;
        localUser.lastActive = new Date().toISOString();
        saveDb(db);
      }
    }

    syncMemorySessionsUserPatch(targetUid, { preferredTheme: theme });
    const updatedUser: User = {
      ...(actor.user.id === targetUid ? actor.user : { ...actor.user, id: targetUid }),
      preferredTheme: theme,
    };
    return res.json(updatedUser);
  } catch (error: any) {
    console.error('Failed to update theme preference:', error);
    res.status(500).json({ error: error.message || 'Failed to save theme preference' });
  }
});

app.patch('/api/users/:id/notifications/read', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Sign in required to save notification read state.' });
    }

    const { readNotificationIds, email } = req.body || {};
    const targetEmail = String(email || '').trim().toLowerCase();
    const isSelf =
      actor.user.id === req.params.id ||
      (targetEmail && actor.user.email.toLowerCase() === targetEmail);
    if (!actor.isAdmin && !isSelf) {
      return res.status(403).json({ error: 'You can only update your own notification status.' });
    }

    if (!Array.isArray(readNotificationIds)) {
      return res.status(400).json({ error: 'readNotificationIds must be an array.' });
    }

    const cleanIds: string[] = [];
    const seen = new Set<string>();
    for (const raw of readNotificationIds) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim().slice(0, 256);
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      cleanIds.push(trimmed);
    }
    const boundedIds = cleanIds.slice(-100);

    const targetUid = actor.isAdmin ? req.params.id : actor.user.id;
    await saveStoredReadNotificationIds(targetUid, boundedIds);

    if (!isCloudSqlConfigured()) {
      const localUser = db.users.find(
        (u) =>
          u.id === targetUid ||
          u.id === req.params.id ||
          (targetEmail && u.email.toLowerCase() === targetEmail)
      );
      if (localUser) {
        localUser.readNotificationIds = boundedIds;
        localUser.lastActive = new Date().toISOString();
        saveDb(db);
      }
    }

    syncMemorySessionsUserPatch(targetUid, { readNotificationIds: boundedIds });
    const updatedUser: User = {
      ...(actor.user.id === targetUid ? actor.user : { ...actor.user, id: targetUid }),
      readNotificationIds: boundedIds,
    };
    return res.json(updatedUser);
  } catch (error: any) {
    console.error('Failed to update read notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to save notification state' });
  }
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const deleted = await deleteUserFromSql(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'User not found' });
      return res.json({ success: true, message: 'User deleted successfully' });
    }

    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin' && user.id === 'admin-mustaqeem') {
      return res.status(403).json({ error: 'Cannot delete Founding Administrator Mustaqeem.' });
    }
    db.users = db.users.filter(u => u.id !== req.params.id);
    db.courses.forEach(c => {
      c.enrolledStudentIds = c.enrolledStudentIds.filter(id => id !== req.params.id);
    });
    db.attendance = db.attendance.filter(a => a.studentId !== req.params.id);
    db.submissions = db.submissions.filter(s => s.studentId !== req.params.id);
    saveDb(db);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('Founding Administrator')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Settings & Logo Configuration
app.get('/api/settings', async (_req: Request, res: Response) => {
  try {
    if (isCloudSqlConfigured()) {
      const settings = await getSettingsFromSql();
      return res.json(settings);
    }
    res.json(db.settings);
  } catch (error: any) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: error.message || 'Failed to load settings' });
  }
});

app.patch('/api/settings', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const updated = await updateSettingsInSql(req.body);
      return res.json(updated);
    }
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json(db.settings);
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

app.patch('/api/settings/nav-items', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    const { navItems } = req.body;
    if (isCloudSqlConfigured()) {
      if (Array.isArray(navItems)) {
        const updated = await updateSettingsInSql({ customNavItems: navItems });
        return res.json(updated.customNavItems);
      }
      const current = await getSettingsFromSql();
      return res.json(current.customNavItems);
    }

    if (Array.isArray(navItems)) {
      db.settings.customNavItems = navItems;
      saveDb(db);
    }
    res.json(db.settings.customNavItems);
  } catch (error: any) {
    console.error('Failed to update nav items:', error);
    res.status(500).json({ error: error.message || 'Failed to update navigation items' });
  }
});

// ================= DURABLE ASSET & PROTECTED MP4 VIDEO STORAGE =================

const VALID_ASSET_KINDS = new Set([
  'course_thumbnail',
  'recording_thumbnail',
  'event_poster',
  'hero_poster',
  'hero_image',
  'custom_logo',
  'avatar',
]);

const VALID_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const VALID_AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_DOC_KINDS = new Set([
  'supplementary_pdf',
  'assessment_attachment',
  'course_material',
  'student_submission',
]);
const VALID_DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const VALID_STUDENT_DOC_EXT_RE = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|md|csv|zip|png|jpe?g|webp)$/i;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

app.post('/api/uploads/asset', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to upload media assets.' });
    }

    const { kind, mimeType, fileName, dataBase64 } = req.body || {};
    if (!VALID_ASSET_KINDS.has(String(kind))) {
      return res.status(400).json({ error: 'Invalid asset kind specified.' });
    }
    if (
      kind === 'course_thumbnail' ||
      kind === 'recording_thumbnail' ||
      kind === 'event_poster'
    ) {
      if (!actor.isStaff && !actor.isAdmin) {
        return res.status(403).json({ error: 'Instructor or Administrator authorization required.' });
      }
    } else if (kind !== 'avatar' && !actor.isAdmin) {
      return res.status(403).json({ error: 'Administrator authorization required for platform media uploads.' });
    }

    const mime = String(mimeType || '').toLowerCase();
    const allowedMimes = kind === 'avatar' ? VALID_AVATAR_MIMES : VALID_IMAGE_MIMES;
    if (!allowedMimes.has(mime)) {
      return res.status(400).json({ error: 'Unsupported image MIME type.' });
    }

    const rawBase64 = String(dataBase64 || '').trim();
    const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',').pop() || '' : rawBase64;
    if (!cleanedBase64) {
      return res.status(400).json({ error: 'Image data payload is required.' });
    }

    const decoded = Buffer.from(cleanedBase64, 'base64');
    const maxBytes = kind === 'avatar' ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
    if (decoded.length <= 0 || decoded.length > maxBytes) {
      return res.status(400).json({ error: `Image exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit.` });
    }

    const assetId = `ast_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const safeName = String(fileName || 'asset').slice(0, 120);
    const assetPayload = {
      id: assetId,
      kind: String(kind),
      mimeType: mime,
      fileName: safeName,
      sizeBytes: decoded.length,
      dataBase64: decoded.toString('base64'),
    };

    if (isCloudSqlConfigured()) {
      await createUploadedAssetInSql(assetPayload);
    } else {
      await fs.promises.writeFile(
        path.join(UPLOADS_DIR, `asset_${assetId}.json`),
        JSON.stringify(assetPayload),
        'utf-8'
      );
    }

    res.status(201).json({
      id: assetId,
      url: `/api/assets/${assetId}`,
    });
  } catch (error: any) {
    console.error('Asset upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to store image asset.' });
  }
});

app.get('/api/assets/:id', async (req: Request, res: Response) => {
  try {
    const assetId = req.params.id;
    if (!SAFE_ID_RE.test(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID.' });
    }

    let asset = isCloudSqlConfigured() ? await getUploadedAssetFromSql(assetId) : null;
    if (!asset) {
      const diskPath = path.join(UPLOADS_DIR, `asset_${assetId}.json`);
      if (fs.existsSync(diskPath)) {
        asset = JSON.parse(await fs.promises.readFile(diskPath, 'utf-8'));
      }
    }

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const buf = Buffer.from(asset.dataBase64, 'base64');
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buf);
  } catch (error: any) {
    console.error('Asset serve error:', error);
    res.status(500).json({ error: error.message || 'Failed to serve asset.' });
  }
});

app.post('/api/uploads/pdf', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to upload documents.' });
    }

    const { kind, mimeType, fileName, dataBase64 } = req.body || {};
    const docKind = VALID_DOC_KINDS.has(String(kind)) ? String(kind) : 'supplementary_pdf';

    if (docKind !== 'student_submission' && !actor.isStaff && !actor.isAdmin) {
      return res.status(403).json({ error: 'Instructor or Administrator authorization required.' });
    }

    const cleanFileName = String(fileName || 'supplementary_material.pdf').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120);
    const inferredMime =
      String(mimeType || '').toLowerCase() ||
      (cleanFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

    const isSupportedStudentExt =
      docKind === 'student_submission' && VALID_STUDENT_DOC_EXT_RE.test(cleanFileName);
    if (
      !VALID_DOC_MIMES.has(inferredMime) &&
      !cleanFileName.toLowerCase().endsWith('.pdf') &&
      !isSupportedStudentExt
    ) {
      return res.status(400).json({
        error: 'Unsupported document format. Please upload PDF, Word, PowerPoint, Excel, TXT/MD, ZIP, or image.',
      });
    }

    const rawBase64 = String(dataBase64 || '').trim();
    const cleanedBase64 = rawBase64.includes(',') ? rawBase64.split(',').pop() || '' : rawBase64;
    if (!cleanedBase64) {
      return res.status(400).json({ error: 'Document payload is required.' });
    }

    const decoded = Buffer.from(cleanedBase64, 'base64');
    const maxBytes = 20 * 1024 * 1024;
    if (decoded.length <= 0 || decoded.length > maxBytes) {
      return res.status(400).json({ error: 'Document exceeds 20 MB limit.' });
    }

    const docId = `doc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const docPayload = {
      id: docId,
      kind: docKind,
      mimeType: inferredMime,
      fileName: cleanFileName,
      sizeBytes: decoded.length,
      dataBase64: decoded.toString('base64'),
    };

    if (isCloudSqlConfigured()) {
      await createUploadedAssetInSql(docPayload);
    } else {
      await fs.promises.writeFile(
        path.join(UPLOADS_DIR, `doc_${docId}.json`),
        JSON.stringify(docPayload),
        'utf-8'
      );
    }

    res.status(201).json({
      id: docId,
      url: `/api/docs/${docId}`,
      fileName: cleanFileName,
      sizeBytes: decoded.length,
    });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document.' });
  }
});

app.get('/api/docs/:id', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    if (!SAFE_ID_RE.test(docId)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    let docAsset = isCloudSqlConfigured() ? await getUploadedAssetFromSql(docId) : null;
    if (!docAsset) {
      const diskPath = path.join(UPLOADS_DIR, `doc_${docId}.json`);
      if (fs.existsSync(diskPath)) {
        docAsset = JSON.parse(await fs.promises.readFile(diskPath, 'utf-8'));
      }
    }

    if (!docAsset) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const buf = Buffer.from(docAsset.dataBase64, 'base64');
    const safeName = (docAsset.fileName || 'material.pdf').replace(/"/g, '');
    const forceDownload = req.query.download === '1';
    res.setHeader('Content-Type', docAsset.mimeType || 'application/pdf');
    res.setHeader('Content-Length', buf.length);
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${safeName}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buf);
  } catch (error: any) {
    console.error('Document serve error:', error);
    res.status(500).json({ error: error.message || 'Failed to serve document.' });
  }
});

function resolveVideoDiskPath(fid: string): { diskPath: string; contentType: string } | null {
  const mp4Path = path.join(UPLOADS_DIR, `${fid}.mp4`);
  if (fs.existsSync(mp4Path)) return { diskPath: mp4Path, contentType: 'video/mp4' };
  const webmPath = path.join(UPLOADS_DIR, `${fid}.webm`);
  if (fs.existsSync(webmPath)) return { diskPath: webmPath, contentType: 'video/webm' };
  return null;
}

function streamMp4File(filePath: string, req: Request, res: Response, contentType = 'video/mp4') {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Protected video stream file not found.' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;
    if (isNaN(start) || isNaN(end) || start < 0 || start >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
}

app.post(
  '/api/uploads/video',
  express.raw({ type: ['video/mp4', 'video/webm', 'application/octet-stream'], limit: '500mb' }),
  async (req: Request, res: Response) => {
    try {
      const actor = await requireStaffActor(req, res);
      if (!actor) return;

      const kind = String(req.query.kind || 'course_recording');
      if (
        kind !== 'course_recording' &&
        kind !== 'course_teaser' &&
        kind !== 'hero_video' &&
        kind !== 'live_recording'
      ) {
        return res.status(400).json({ error: 'Invalid video upload kind.' });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length <= 0) {
        return res.status(400).json({ error: 'Non-empty binary video file payload is required.' });
      }
      if (req.body.length > 500 * 1024 * 1024) {
        return res.status(400).json({ error: 'Video file exceeds 500 MB limit.' });
      }

      const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
      const recId = typeof req.query.recId === 'string' ? req.query.recId.trim() : '';
      if (
        (kind === 'course_recording' || kind === 'course_teaser' || kind === 'live_recording') &&
        (!SAFE_ID_RE.test(courseId) || !SAFE_ID_RE.test(recId))
      ) {
        return res.status(400).json({ error: 'Valid courseId and recId query parameters required for recording upload.' });
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      const filenameHint = String(req.query.filename || '').toLowerCase();
      const ext = contentType.includes('webm') || filenameHint.endsWith('.webm') ? 'webm' : 'mp4';

      const fileId = `vid_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const diskPath = path.join(UPLOADS_DIR, `${fileId}.${ext}`);
      await fs.promises.writeFile(diskPath, req.body);

      const streamUrl =
        kind === 'hero_video'
          ? `/api/streams/hero/${fileId}`
          : kind === 'course_teaser'
          ? `/api/courses/${courseId}/recordings/${recId}/teaser-stream?fid=${fileId}`
          : `/api/courses/${courseId}/recordings/${recId}/stream?fid=${fileId}`;

      res.status(201).json({
        fileId,
        streamUrl,
        fileSize: formatBytesLabel(req.body.length),
      });
    } catch (error: any) {
      console.error('Video upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload video file.' });
    }
  }
);

app.get('/api/streams/hero/:fileId', (req: Request, res: Response) => {
  const fileId = req.params.fileId;
  if (!SAFE_ID_RE.test(fileId)) {
    return res.status(400).json({ error: 'Invalid hero video ID.' });
  }
  const resolved = resolveVideoDiskPath(fileId);
  if (!resolved) return res.status(404).json({ error: 'Hero video not found.' });
  streamMp4File(resolved.diskPath, req, res, resolved.contentType);
});

app.get('/api/streams/sample/:slug', (req: Request, res: Response) => {
  streamMp4File(SAMPLE_MP4_PATH, req, res);
});

app.get('/api/courses/:id/recordings/:recId/stream', async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const recId = req.params.recId;
    const fid = String(req.query.fid || '').trim();
    if (!SAFE_ID_RE.test(courseId) || !SAFE_ID_RE.test(recId) || !SAFE_ID_RE.test(fid)) {
      return res.status(400).json({ error: 'Invalid stream parameters.' });
    }

    let rec: any = null;
    let localCourse: Course | undefined;
    if (isCloudSqlConfigured()) {
      rec = await getRawRecordingFromSql(courseId, recId);
    } else {
      localCourse = db.courses.find(c => c.id === courseId);
      rec = localCourse?.videoArchives.find(r => r.id === recId) || null;
    }

    if (!rec) {
      return res.status(404).json({ error: 'Recording not found.' });
    }

    if (!String(rec.videoUrl || '').includes(`fid=${fid}`)) {
      return res.status(403).json({ error: 'Stream signature mismatch.' });
    }

    if (!rec.isOrientation) {
      const actor = await resolveRequestActor(req);
      if (!actor) {
        return res.status(403).json({ error: 'Sign in and enroll for free to stream private cohort lectures.' });
      }
      if (!actor.isAdmin && !actor.isStaff) {
        const enrolled = isCloudSqlConfigured()
          ? await isStudentEnrolledInSql(courseId, actor.user.id)
          : Boolean(localCourse?.enrolledStudentIds.includes(actor.user.id));
        if (!enrolled) {
          return res.status(403).json({ error: 'Course enrollment required to access private cohort streams.' });
        }
      }
    }

    const resolved = resolveVideoDiskPath(fid);
    if (!resolved) {
      return res.status(404).json({ error: 'Stream file not found on storage.' });
    }
    streamMp4File(resolved.diskPath, req, res, resolved.contentType);
  } catch (error: any) {
    console.error('Protected stream error:', error);
    res.status(500).json({ error: error.message || 'Unable to stream protected recording.' });
  }
});

app.get('/api/courses/:id/recordings/:recId/teaser-stream', async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const recId = req.params.recId;
    const fid = String(req.query.fid || '').trim();
    if (!SAFE_ID_RE.test(courseId) || !SAFE_ID_RE.test(recId) || !SAFE_ID_RE.test(fid)) {
      return res.status(400).json({ error: 'Invalid teaser stream parameters.' });
    }

    let rec: any = null;
    let localCourse: Course | undefined;
    if (isCloudSqlConfigured()) {
      rec = await getRawRecordingFromSql(courseId, recId);
    } else {
      localCourse = db.courses.find(c => c.id === courseId);
      rec = localCourse?.videoArchives.find(r => r.id === recId) || null;
    }

    if (!rec) {
      return res.status(404).json({ error: 'Recording not found.' });
    }

    if (rec.teaserUrl && !String(rec.teaserUrl).includes(`fid=${fid}`)) {
      return res.status(403).json({ error: 'Teaser stream signature mismatch.' });
    }

    // Enforce orientation-only public access even for teasers on locked class recordings
    if (!rec.isOrientation) {
      const actor = await resolveRequestActor(req);
      if (!actor) {
        return res.status(403).json({ error: 'Sign in and enroll for free to access class recordings.' });
      }
      if (!actor.isAdmin && !actor.isStaff) {
        const enrolled = isCloudSqlConfigured()
          ? await isStudentEnrolledInSql(courseId, actor.user.id)
          : Boolean(localCourse?.enrolledStudentIds.includes(actor.user.id));
        if (!enrolled) {
          return res.status(403).json({ error: 'Course enrollment required to access private cohort streams.' });
        }
      }
    }

    const resolved = resolveVideoDiskPath(fid);
    if (!resolved) {
      return res.status(404).json({ error: 'Teaser video file not found.' });
    }
    streamMp4File(resolved.diskPath, req, res, resolved.contentType);
  } catch (error: any) {
    console.error('Teaser stream error:', error);
    res.status(500).json({ error: error.message || 'Unable to stream teaser video.' });
  }
});

// Recordings Management for Course
app.post('/api/courses/:id/recordings', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const {
      id,
      title,
      videoUrl,
      storagePath,
      teaserUrl,
      teaserStoragePath,
      thumbnailUrl,
      thumbnailStoragePath,
      supplementaryPdfUrl,
      supplementaryPdfName,
      supplementaryPdfStoragePath,
      duration,
      isOrientation,
      syncedFromZoomWebhook,
      fileSize
    } = req.body;

    const cleanedVideoUrl = String(videoUrl || '').trim();
    const cleanedStoragePath = String(storagePath || '').trim();
    const cleanedTeaserUrl = String(teaserUrl || '').trim();
    const cleanedTeaserStoragePath = String(teaserStoragePath || '').trim();
    const cleanedPdfUrl = String(supplementaryPdfUrl || '').trim();
    const cleanedPdfName = String(supplementaryPdfName || '').trim();
    const cleanedPdfStoragePath = String(supplementaryPdfStoragePath || '').trim();

    if (!cleanedVideoUrl && !cleanedStoragePath && !cleanedTeaserUrl) {
      return res.status(400).json({ error: 'An uploaded video file or valid videoUrl is required.' });
    }

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const newRec = {
        id: id || `rec-${Date.now()}`,
        title: title || `Lecture ${course.videoArchives.length + 1}`,
        videoUrl: cleanedVideoUrl,
        storagePath: cleanedStoragePath,
        teaserUrl: cleanedTeaserUrl,
        teaserStoragePath: cleanedTeaserStoragePath,
        thumbnailUrl: thumbnailUrl || '',
        thumbnailStoragePath: thumbnailStoragePath || '',
        supplementaryPdfUrl: cleanedPdfUrl || undefined,
        supplementaryPdfName: cleanedPdfName || undefined,
        supplementaryPdfStoragePath: cleanedPdfStoragePath || undefined,
        mimeType: 'video/mp4' as const,
        nonDownloadable: true,
        nonShareable: true,
        duration: duration || '45 min',
        recordedAt: new Date().toISOString(),
        isOrientation: isOrientation ?? (course.videoArchives.length === 0),
        syncedFromZoomWebhook: Boolean(syncedFromZoomWebhook),
        fileSize: fileSize || '180 MB',
      };
      await upsertRecordingInSql(course.id, newRec);
      return res.status(201).json(newRec);
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const newRec = {
      id: id || `rec-${Date.now()}`,
      title: title || `Lecture ${course.videoArchives.length + 1}`,
      videoUrl: cleanedVideoUrl,
      storagePath: cleanedStoragePath,
      teaserUrl: cleanedTeaserUrl,
      teaserStoragePath: cleanedTeaserStoragePath,
      thumbnailUrl: thumbnailUrl || '',
      thumbnailStoragePath: thumbnailStoragePath || '',
      supplementaryPdfUrl: cleanedPdfUrl || undefined,
      supplementaryPdfName: cleanedPdfName || undefined,
      supplementaryPdfStoragePath: cleanedPdfStoragePath || undefined,
      mimeType: 'video/mp4' as const,
      nonDownloadable: true,
      nonShareable: true,
      duration: duration || '45 min',
      recordedAt: new Date().toISOString(),
      isOrientation: isOrientation ?? (course.videoArchives.length === 0),
      syncedFromZoomWebhook: Boolean(syncedFromZoomWebhook),
      fileSize: fileSize || '180 MB',
    };
    course.videoArchives.push(newRec);
    saveDb(db);
    res.status(201).json(newRec);
  } catch (error: any) {
    console.error('Failed to add recording:', error);
    res.status(500).json({ error: error.message || 'Failed to add recording' });
  }
});

app.patch('/api/courses/:id/recordings/:recId', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const {
      title,
      duration,
      thumbnailUrl,
      thumbnailStoragePath,
      teaserUrl,
      teaserStoragePath,
      supplementaryPdfUrl,
      supplementaryPdfName,
      supplementaryPdfStoragePath,
      isOrientation,
      videoUrl,
      storagePath,
      fileSize
    } = req.body || {};
    const patch = {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(duration !== undefined ? { duration: String(duration) } : {}),
      ...(thumbnailUrl !== undefined ? { thumbnailUrl: String(thumbnailUrl) } : {}),
      ...(thumbnailStoragePath !== undefined ? { thumbnailStoragePath: String(thumbnailStoragePath) } : {}),
      ...(teaserUrl !== undefined ? { teaserUrl: String(teaserUrl) } : {}),
      ...(teaserStoragePath !== undefined ? { teaserStoragePath: String(teaserStoragePath) } : {}),
      ...(supplementaryPdfUrl !== undefined ? { supplementaryPdfUrl: String(supplementaryPdfUrl) } : {}),
      ...(supplementaryPdfName !== undefined ? { supplementaryPdfName: String(supplementaryPdfName) } : {}),
      ...(supplementaryPdfStoragePath !== undefined
        ? { supplementaryPdfStoragePath: String(supplementaryPdfStoragePath) }
        : {}),
      ...(isOrientation !== undefined ? { isOrientation: Boolean(isOrientation) } : {}),
      ...(videoUrl !== undefined ? { videoUrl: String(videoUrl) } : {}),
      ...(storagePath !== undefined ? { storagePath: String(storagePath) } : {}),
      ...(fileSize !== undefined ? { fileSize: String(fileSize) } : {}),
    };

    if (isCloudSqlConfigured()) {
      const updated = await updateRecordingInSql(req.params.id, req.params.recId, patch);
      if (!updated) return res.status(404).json({ error: 'Recording not found' });
      return res.json(updated);
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const rec = course.videoArchives.find(r => r.id === req.params.recId);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    Object.assign(rec, patch);
    saveDb(db);
    res.json(rec);
  } catch (error: any) {
    console.error('Failed to update recording:', error);
    res.status(500).json({ error: error.message || 'Failed to update recording' });
  }
});

app.delete('/api/courses/:id/recordings/:recId', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const unlinkUploadedVideoIfLocal = async (videoUrl?: string) => {
      if (!videoUrl) return;
      const match = videoUrl.match(/fid=([a-zA-Z0-9_-]+)/);
      if (match && SAFE_ID_RE.test(match[1])) {
        await fs.promises.unlink(path.join(UPLOADS_DIR, `${match[1]}.mp4`)).catch(() => {});
        await fs.promises.unlink(path.join(UPLOADS_DIR, `${match[1]}.webm`)).catch(() => {});
      }
    };

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const rec = await getRawRecordingFromSql(course.id, req.params.recId);
      await deleteRecordingInSql(course.id, req.params.recId);
      await unlinkUploadedVideoIfLocal(rec?.videoUrl);
      return res.json({ success: true });
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const rec = course.videoArchives.find(r => r.id === req.params.recId);
    course.videoArchives = course.videoArchives.filter(r => r.id !== req.params.recId);
    saveDb(db);
    await unlinkUploadedVideoIfLocal(rec?.videoUrl);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete recording:', error);
    res.status(500).json({ error: error.message || 'Failed to delete recording' });
  }
});

function sanitizeCourseForActor(
  course: Course,
  actor: { user: User; isAdmin: boolean; isStaff: boolean } | null
): Course {
  const isAuthorizedForCourse = Boolean(
    actor &&
      (actor.isAdmin ||
        actor.isStaff ||
        course.enrolledStudentIds.includes(actor.user.id))
  );

  return {
    ...course,
    videoArchives: (course.videoArchives || []).map((rec) => {
      const unlocked = Boolean(rec.isOrientation || isAuthorizedForCourse);
      if (unlocked) {
        return { ...rec, locked: false };
      }
      return {
        id: rec.id,
        title: rec.title,
        duration: rec.duration,
        recordedAt: rec.recordedAt,
        videoUrl: '',
        thumbnailUrl: rec.thumbnailUrl,
        supplementaryPdfName: rec.supplementaryPdfName,
        mimeType: 'video/mp4',
        nonDownloadable: true,
        nonShareable: true,
        isOrientation: false,
        locked: true,
        syncedFromZoomWebhook: rec.syncedFromZoomWebhook,
        fileSize: rec.fileSize,
      };
    }),
  };
}

// Courses Management
app.get('/api/courses', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    const rawCourses = isCloudSqlConfigured() ? await listCoursesFromSql() : db.courses;
    res.json(rawCourses.map((c) => sanitizeCourseForActor(c, actor)));
  } catch (error: any) {
    console.error('Failed to list courses:', error);
    res.status(500).json({ error: error.message || 'Failed to list courses' });
  }
});

app.get('/api/courses/:id', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    const course = isCloudSqlConfigured()
      ? await getCourseByIdFromSql(req.params.id)
      : db.courses.find((c) => c.id === req.params.id) || null;
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(sanitizeCourseForActor(course, actor));
  } catch (error: any) {
    console.error('Failed to get course:', error);
    res.status(500).json({ error: error.message || 'Failed to get course' });
  }
});

app.post('/api/courses', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const courseData = req.body;
    const generatedId = courseData.id || `course-${Date.now()}`;
    const newCourse: Course = {
      id: generatedId,
      code: courseData.code || `DHA-${Math.floor(100 + Math.random() * 900)}`,
      title: courseData.title,
      description: courseData.description,
      instructorId: courseData.instructorId || actor.user.id || 'admin-mustaqeem',
      instructorName:
        courseData.instructorName ||
        `${actor.user.firstName} ${actor.user.lastName}` ||
        'Mustaqeem Shaikh',
      status: courseData.status || 'Open for Enrollment',
      level: courseData.level || 'Beginner',
      thumbnail: courseData.thumbnail || 'fallback://course',
      modules: courseData.modules || [],
      schedules: courseData.schedules || [],
      videoArchives: [],
      materials: courseData.materials || [],
      assignments: (courseData.assignments || []).map((a: AcademicAssessment) => ({
        ...a,
        courseId: a.courseId || generatedId,
      })),
      enrolledStudentIds: [],
      totalLectures: courseData.totalLectures || 12,
      maxSpots: Math.max(1, Number(courseData.maxSpots) || 50),
      durationLabel: String(courseData.durationLabel || '12 Weeks').trim(),
      enrollmentDeadlineUtc: String(courseData.enrollmentDeadlineUtc || '').trim(),
    };

    if (isCloudSqlConfigured()) {
      const created = await createCourseInSql(newCourse);
      return res.status(201).json(created);
    }

    db.courses.unshift(newCourse);
    saveDb(db);
    res.status(201).json(newCourse);
  } catch (error: any) {
    console.error('Failed to create course:', error);
    res.status(500).json({ error: error.message || 'Failed to create course' });
  }
});

app.put('/api/courses/:id', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const patch: Partial<Course> = { ...req.body };
    if (patch.maxSpots !== undefined) {
      patch.maxSpots = Math.max(1, Number(patch.maxSpots) || 50);
    }
    if (patch.durationLabel !== undefined) {
      patch.durationLabel = String(patch.durationLabel || '12 Weeks').trim() || '12 Weeks';
    }
    if (patch.enrollmentDeadlineUtc !== undefined) {
      patch.enrollmentDeadlineUtc = String(patch.enrollmentDeadlineUtc || '').trim();
    }
    if (patch.totalLectures !== undefined) {
      patch.totalLectures = Math.max(1, Number(patch.totalLectures) || 12);
    }

    if (isCloudSqlConfigured()) {
      const updated = await updateCourseInSql(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: 'Course not found' });
      return res.json(updated);
    }
    const idx = db.courses.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Course not found' });
    db.courses[idx] = { ...db.courses[idx], ...patch };
    saveDb(db);
    res.json(db.courses[idx]);
  } catch (error: any) {
    console.error('Failed to update course:', error);
    res.status(500).json({ error: error.message || 'Failed to update course' });
  }
});

app.delete('/api/courses/:id', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      await deleteCourseInSql(req.params.id);
      return res.json({ success: true });
    }
    db.courses = db.courses.filter(c => c.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete course:', error);
    res.status(500).json({ error: error.message || 'Failed to delete course' });
  }
});

app.get('/api/courses/:id/materials/:matId/download', async (req: Request, res: Response) => {
  try {
    const course = isCloudSqlConfigured()
      ? await getCourseByIdFromSql(req.params.id)
      : db.courses.find(c => c.id === req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const material = (course.materials || []).find(m => m.id === req.params.matId);
    if (!material) {
      return res.status(404).json({ error: 'Course reading material not found' });
    }

    const safeFileName =
      material.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'study_material';

    const modulesSummary = (course.modules || [])
      .map(
        (m, idx) =>
          `\nModule ${idx + 1}: ${m.title}\n` +
          `Description: ${m.description}\n` +
          `Objectives:\n${(m.learningObjectives || []).map(o => `  - ${o}`).join('\n')}\n` +
          `Instructor Notes: ${m.instructorNotes}\n`
      )
      .join('\n------------------------------------------------------------\n');

    const packet = [
      'DEEN HIJRAH ACADEMIA — SCHOLASTIC STUDY PACKET',
      '============================================================',
      `Document Title : ${material.title}`,
      `Course Code    : ${course.code}`,
      `Course Title   : ${course.title}`,
      `Instructor     : ${course.instructorName}`,
      `Resource Type  : ${material.fileType.toUpperCase()}`,
      `Uploaded       : ${new Date(material.uploadDate || Date.now()).toUTCString()}`,
      '============================================================',
      '',
      'COURSE OVERVIEW',
      course.description,
      '',
      'CURRICULUM MODULES & INSTRUCTOR STUDY NOTES',
      modulesSummary || 'Module overview prepared by Instructor Mustaqeem Shaikh.',
      '',
      'End of Institutional Document — Deen Hijrah Academia',
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.txt"`);
    res.send(packet);
  } catch (error: any) {
    console.error('Failed to download course material:', error);
    res.status(500).json({ error: error.message || 'Failed to download course material' });
  }
});

async function persistJsonIntakeRecord(id: string, kind: string, payload: unknown): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  if (isCloudSqlConfigured()) {
    await createUploadedAssetInSql({
      id,
      kind,
      mimeType: 'application/json',
      fileName: `${id}.json`,
      sizeBytes: Buffer.byteLength(encoded),
      dataBase64: encoded,
    });
  } else {
    await fs.promises.writeFile(
      path.join(UPLOADS_DIR, `${kind}_${id}.json`),
      JSON.stringify(payload, null, 2),
      'utf-8'
    );
  }
}

async function getStoredThemePreference(userId: string): Promise<'dark' | 'light' | undefined> {
  const safeId = `theme_pref_${String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  try {
    if (isCloudSqlConfigured()) {
      const asset = await getUploadedAssetFromSql(safeId);
      if (!asset?.dataBase64) return undefined;
      const parsed = JSON.parse(Buffer.from(asset.dataBase64, 'base64').toString('utf-8'));
      return parsed?.theme === 'light' || parsed?.theme === 'dark' ? parsed.theme : undefined;
    }
    const localUser = db.users.find((u) => u.id === userId);
    if (localUser?.preferredTheme === 'light' || localUser?.preferredTheme === 'dark') {
      return localUser.preferredTheme;
    }
    const prefFile = path.join(UPLOADS_DIR, `${safeId}.json`);
    if (fs.existsSync(prefFile)) {
      const parsed = JSON.parse(await fs.promises.readFile(prefFile, 'utf-8'));
      return parsed?.theme === 'light' || parsed?.theme === 'dark' ? parsed.theme : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function saveStoredThemePreference(userId: string, theme: 'dark' | 'light'): Promise<void> {
  const safeId = `theme_pref_${String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const payload = { userId, theme, updatedAt: new Date().toISOString() };
  if (isCloudSqlConfigured()) {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    await createUploadedAssetInSql({
      id: safeId,
      kind: 'user_theme_preference',
      mimeType: 'application/json',
      fileName: `${safeId}.json`,
      sizeBytes: Buffer.byteLength(encoded),
      dataBase64: encoded,
    });
    return;
  }
  await fs.promises.writeFile(
    path.join(UPLOADS_DIR, `${safeId}.json`),
    JSON.stringify(payload, null, 2),
    'utf-8'
  );
}

async function getStoredReadNotificationIds(userId: string): Promise<string[] | undefined> {
  const safeId = `notif_reads_${String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  try {
    if (isCloudSqlConfigured()) {
      const asset = await getUploadedAssetFromSql(safeId);
      if (!asset?.dataBase64) return undefined;
      const parsed = JSON.parse(Buffer.from(asset.dataBase64, 'base64').toString('utf-8'));
      if (Array.isArray(parsed?.readNotificationIds)) {
        return parsed.readNotificationIds
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(-100);
      }
      return undefined;
    }
    const localUser = db.users.find((u) => u.id === userId);
    if (Array.isArray(localUser?.readNotificationIds)) {
      return localUser.readNotificationIds.slice(-100);
    }
    const readFile = path.join(UPLOADS_DIR, `${safeId}.json`);
    if (fs.existsSync(readFile)) {
      const parsed = JSON.parse(await fs.promises.readFile(readFile, 'utf-8'));
      if (Array.isArray(parsed?.readNotificationIds)) {
        return parsed.readNotificationIds
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(-100);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function saveStoredReadNotificationIds(userId: string, readIds: string[]): Promise<void> {
  const safeId = `notif_reads_${String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const payload = { userId, readNotificationIds: readIds.slice(-100), updatedAt: new Date().toISOString() };
  if (isCloudSqlConfigured()) {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    await createUploadedAssetInSql({
      id: safeId,
      kind: 'user_notification_reads',
      mimeType: 'application/json',
      fileName: `${safeId}.json`,
      sizeBytes: Buffer.byteLength(encoded),
      dataBase64: encoded,
    });
    return;
  }
  await fs.promises.writeFile(
    path.join(UPLOADS_DIR, `${safeId}.json`),
    JSON.stringify(payload, null, 2),
    'utf-8'
  );
}

async function attachPreferredTheme(user: User): Promise<User> {
  const [savedTheme, savedReadIds] = await Promise.all([
    getStoredThemePreference(user.id),
    getStoredReadNotificationIds(user.id),
  ]);
  return {
    ...user,
    ...(savedTheme ? { preferredTheme: savedTheme } : {}),
    ...(savedReadIds ? { readNotificationIds: savedReadIds } : {}),
  };
}

function sanitizeReviewIdPart(raw: string): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
  return cleaned || `id-${Date.now()}`;
}

async function readStoredJsonList<T>(assetId: string): Promise<T[]> {
  try {
    if (isCloudSqlConfigured()) {
      const asset = await getUploadedAssetFromSql(assetId);
      if (!asset?.dataBase64) return [];
      const parsed = JSON.parse(Buffer.from(asset.dataBase64, 'base64').toString('utf-8'));
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    }
    const localFile = path.join(UPLOADS_DIR, `${assetId}.json`);
    if (fs.existsSync(localFile)) {
      const parsed = JSON.parse(await fs.promises.readFile(localFile, 'utf-8'));
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    }
  } catch (err) {
    console.warn(`Failed reading ${assetId}:`, err);
  }
  return [];
}

async function writeStoredJsonList<T>(assetId: string, kind: string, items: T[]): Promise<void> {
  if (isCloudSqlConfigured()) {
    const encoded = Buffer.from(JSON.stringify(items), 'utf-8').toString('base64');
    await createUploadedAssetInSql({
      id: assetId,
      kind,
      mimeType: 'application/json',
      fileName: `${assetId}.json`,
      sizeBytes: Buffer.byteLength(encoded),
      dataBase64: encoded,
    });
    return;
  }
  await fs.promises.writeFile(
    path.join(UPLOADS_DIR, `${assetId}.json`),
    JSON.stringify(items, null, 2),
    'utf-8'
  );
}

const COURSE_REVIEWS_ASSET_ID = 'dha_course_reviews_index';
const INSTRUCTOR_REVIEWS_ASSET_ID = 'dha_instructor_reviews_index';

app.get('/api/faculty', async (_req: Request, res: Response) => {
  try {
    const [allUsers, allCourses, instructorReviews] = await Promise.all([
      isCloudSqlConfigured()
        ? (await ensureInitialSqlBootstrap(), await getUsersFromSql())
        : Promise.resolve(db.users),
      isCloudSqlConfigured() ? listCoursesFromSql() : Promise.resolve(db.courses),
      readStoredJsonList<InstructorReview>(INSTRUCTOR_REVIEWS_ASSET_ID),
    ]);

    const byId = new Map<string, FacultyProfile>();
    const directorUser = allUsers.find(
      (u) => u.role === 'admin' || u.email.toLowerCase() === CHANCELLOR_EMAIL
    );
    const directorId = directorUser?.id || 'admin-mustaqeem';

    byId.set(directorId, {
      id: directorId,
      firstName: directorUser?.firstName || 'Mustaqeem',
      lastName: directorUser?.lastName || 'Shaikh',
      fullName: directorUser
        ? `${directorUser.firstName} ${directorUser.lastName}`.trim()
        : 'Mustaqeem Shaikh',
      title: 'Founding Director',
      roleLabel: 'Founding Director & Lead Academic Steward',
      specialty: 'Institutional Architecture, Seerah & Scholastic Oversight',
      bio: 'Leading curriculum governance, academic admissions, live scholarly instruction, and digital classroom infrastructure for Deen Hijrah Academia. Oversees cohort design, classical text pedagogy, and assessment standards across all academy tracks.',
      qualifications: [
        'Founding Director & Academic Chancellor — Deen Hijrah Academia',
        'Curriculum Architect for Seerah & Classical Studies',
        'Verified Lead Scholarly Instructor',
      ],
      email: 'faculty.director@deenhijrahacademia.edu',
      gender: directorUser?.gender === 'female' ? 'female' : 'male',
      avatarUrl: directorUser?.avatarUrl,
      isVerifiedDirector: true,
      coursesTaughtCount: 0,
      averageRating: 0,
      reviewCount: 0,
    });

    for (const u of allUsers) {
      if (u.role !== 'teacher' && u.role !== 'admin') continue;
      if (byId.has(u.id)) continue;
      const fullName = `${u.firstName} ${u.lastName}`.trim() || 'Academy Instructor';
      const taughtCourses = allCourses.filter(
        (c) =>
          c.instructorId === u.id ||
          c.instructorName.trim().toLowerCase() === fullName.toLowerCase()
      );
      const specialtyList = taughtCourses.map((c) => c.title).slice(0, 2);
      byId.set(u.id, {
        id: u.id,
        firstName: u.firstName || fullName.split(' ')[0] || 'Scholar',
        lastName: u.lastName || fullName.split(' ').slice(1).join(' ') || '',
        fullName,
        title: u.role === 'admin' ? 'Academic Steward' : 'Faculty Scholar',
        roleLabel: u.role === 'admin' ? 'Academic Director & Instructor' : 'Cohort Instructor & Mentor',
        specialty:
          specialtyList.length > 0
            ? specialtyList.join(' · ')
            : 'Classical Islamic Sciences & Guided Cohort Instruction',
        bio: `Dedicated academy educator mentoring students in structured live seminars, primary text analysis, and personalized weekly Q&A at Deen Hijrah Academia.`,
        qualifications: [
          'Certified Faculty Instructor — Deen Hijrah Academia',
          'Live Seminar Moderation & Student Assessment Review',
        ],
        email: u.email,
        gender: u.gender === 'female' ? 'female' : 'male',
        avatarUrl: u.avatarUrl,
        isVerifiedDirector: u.role === 'admin',
        coursesTaughtCount: taughtCourses.length,
        averageRating: 0,
        reviewCount: 0,
      });
    }

    for (const c of allCourses) {
      const instrId = (c.instructorId || '').trim();
      const instrName = (c.instructorName || '').trim();
      if (!instrName) continue;
      const matched = Array.from(byId.values()).find(
        (f) =>
          (instrId && f.id === instrId) ||
          f.fullName.toLowerCase() === instrName.toLowerCase()
      );
      if (!matched) {
        const key = instrId || `faculty-${sanitizeReviewIdPart(instrName.toLowerCase())}`;
        const parts = instrName.split(/\s+/);
        byId.set(key, {
          id: key,
          firstName: parts[0] || instrName,
          lastName: parts.slice(1).join(' '),
          fullName: instrName,
          title: 'Course Instructor',
          roleLabel: 'Visiting / Program Instructor',
          specialty: c.title,
          bio: `Course instructor leading structured lessons, weekly study materials, and student cohort discussions for ${c.title}.`,
          qualifications: [
            `Lead Instructor — ${c.code || 'Academy Track'}`,
            'Cohort Assessment & Curriculum Guidance',
          ],
          gender: 'male',
          isVerifiedDirector: false,
          coursesTaughtCount: 0,
          averageRating: 0,
          reviewCount: 0,
        });
      }
    }

    const enriched = Array.from(byId.values()).map((prof) => {
      const taughtCount = allCourses.filter(
        (c) =>
          c.instructorId === prof.id ||
          c.instructorName.trim().toLowerCase() === prof.fullName.toLowerCase()
      ).length;
      const matchingReviews = instructorReviews.filter(
        (r) =>
          r.isPublished !== false &&
          (r.instructorId === prof.id ||
            r.instructorName.trim().toLowerCase() === prof.fullName.toLowerCase())
      );
      const avg =
        matchingReviews.length > 0
          ? Number(
              (
                matchingReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) /
                matchingReviews.length
              ).toFixed(1)
            )
          : 0;
      return {
        ...prof,
        coursesTaughtCount: taughtCount,
        averageRating: avg,
        reviewCount: matchingReviews.length,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch faculty profiles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch faculty profiles.' });
  }
});

app.get('/api/reviews/courses', async (req: Request, res: Response) => {
  try {
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
    const all = await readStoredJsonList<CourseReview>(COURSE_REVIEWS_ASSET_ID);
    const visible = all
      .filter((r) => r.isPublished !== false && (!courseId || r.courseId === courseId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(visible);
  } catch (error: any) {
    console.error('Failed to fetch course reviews:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch course reviews.' });
  }
});

app.post('/api/courses/:id/reviews', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to submit a course review.' });
    }

    const courseId = String(req.params.id || '').trim();
    const course = isCloudSqlConfigured()
      ? await getCourseByIdFromSql(courseId)
      : db.courses.find((c) => c.id === courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const rawRating = Number(req.body?.rating);
    const rating = Math.round(rawRating);
    const comment = String(req.body?.comment || '').trim();
    if (!Number.isFinite(rawRating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Please select a star rating between 1 and 5.' });
    }
    if (!comment || comment.length > 1500) {
      return res.status(400).json({
        error: 'Review comment must be between 1 and 1,500 characters.',
      });
    }

    const reviewId = `${sanitizeReviewIdPart(course.id)}_${sanitizeReviewIdPart(actor.user.id)}`;
    const isVerifiedEnrollment =
      actor.isStaff ||
      (Array.isArray(course.enrolledStudentIds) &&
        course.enrolledStudentIds.includes(actor.user.id));
    const nowIso = new Date().toISOString();

    const existingList = await readStoredJsonList<CourseReview>(COURSE_REVIEWS_ASSET_ID);
    const existingIdx = existingList.findIndex((r) => r.id === reviewId);
    const nextReview: CourseReview = {
      id: reviewId,
      courseId: course.id,
      authorId: actor.user.id,
      authorName: `${actor.user.firstName} ${actor.user.lastName}`.trim() || actor.user.email,
      authorGender: actor.user.gender === 'female' ? 'female' : 'male',
      ...(actor.user.avatarUrl ? { authorAvatar: actor.user.avatarUrl } : {}),
      rating,
      comment,
      isVerifiedEnrollment,
      isPublished: true,
      createdAt: existingIdx >= 0 ? existingList[existingIdx].createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      existingList[existingIdx] = nextReview;
    } else {
      existingList.unshift(nextReview);
    }
    await writeStoredJsonList(COURSE_REVIEWS_ASSET_ID, 'course_reviews_index', existingList);
    res.status(201).json(nextReview);
  } catch (error: any) {
    console.error('Failed to save course review:', error);
    res.status(500).json({ error: error.message || 'Failed to save course review.' });
  }
});

app.delete('/api/courses/:id/reviews/:reviewId', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const existingList = await readStoredJsonList<CourseReview>(COURSE_REVIEWS_ASSET_ID);
    const target = existingList.find((r) => r.id === req.params.reviewId && r.courseId === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    if (target.authorId !== actor.user.id && !actor.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own review.' });
    }
    const nextList = existingList.filter((r) => r.id !== target.id);
    await writeStoredJsonList(COURSE_REVIEWS_ASSET_ID, 'course_reviews_index', nextList);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete course review:', error);
    res.status(500).json({ error: error.message || 'Failed to delete course review.' });
  }
});

app.get('/api/reviews/instructors', async (req: Request, res: Response) => {
  try {
    const instructorId =
      typeof req.query.instructorId === 'string' ? req.query.instructorId.trim() : '';
    const all = await readStoredJsonList<InstructorReview>(INSTRUCTOR_REVIEWS_ASSET_ID);
    const visible = all
      .filter((r) => r.isPublished !== false && (!instructorId || r.instructorId === instructorId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(visible);
  } catch (error: any) {
    console.error('Failed to fetch instructor reviews:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch instructor reviews.' });
  }
});

app.post('/api/instructors/:id/reviews', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to submit an instructor review.' });
    }

    const instructorId = String(req.params.id || '').trim();
    if (!instructorId) {
      return res.status(400).json({ error: 'Instructor identifier is required.' });
    }

    const rawRating = Number(req.body?.rating);
    const rating = Math.round(rawRating);
    const comment = String(req.body?.comment || '').trim();
    const instructorName = String(req.body?.instructorName || '').trim() || 'Academy Instructor';
    const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId.trim() : '';
    const courseTitle =
      typeof req.body?.courseTitle === 'string' ? req.body.courseTitle.trim() : '';

    if (!Number.isFinite(rawRating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Please select a star rating between 1 and 5.' });
    }
    if (!comment || comment.length > 1500) {
      return res.status(400).json({
        error: 'Instructor review must be between 1 and 1,500 characters.',
      });
    }

    const allCourses = isCloudSqlConfigured()
      ? await listCoursesFromSql()
      : db.courses;
    const isVerifiedStudent =
      actor.isStaff ||
      allCourses.some(
        (c) =>
          (c.instructorId === instructorId ||
            c.instructorName.trim().toLowerCase() === instructorName.toLowerCase()) &&
          Array.isArray(c.enrolledStudentIds) &&
          c.enrolledStudentIds.includes(actor.user.id)
      );

    const reviewId = `${sanitizeReviewIdPart(instructorId)}_${sanitizeReviewIdPart(actor.user.id)}`;
    const nowIso = new Date().toISOString();

    const existingList = await readStoredJsonList<InstructorReview>(INSTRUCTOR_REVIEWS_ASSET_ID);
    const existingIdx = existingList.findIndex((r) => r.id === reviewId);
    const nextReview: InstructorReview = {
      id: reviewId,
      instructorId,
      instructorName,
      authorId: actor.user.id,
      authorName: `${actor.user.firstName} ${actor.user.lastName}`.trim() || actor.user.email,
      authorGender: actor.user.gender === 'female' ? 'female' : 'male',
      ...(actor.user.avatarUrl ? { authorAvatar: actor.user.avatarUrl } : {}),
      ...(courseId ? { courseId } : {}),
      ...(courseTitle ? { courseTitle } : {}),
      rating,
      comment,
      isVerifiedStudent,
      isPublished: true,
      createdAt: existingIdx >= 0 ? existingList[existingIdx].createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      existingList[existingIdx] = nextReview;
    } else {
      existingList.unshift(nextReview);
    }
    await writeStoredJsonList(
      INSTRUCTOR_REVIEWS_ASSET_ID,
      'instructor_reviews_index',
      existingList
    );
    res.status(201).json(nextReview);
  } catch (error: any) {
    console.error('Failed to save instructor review:', error);
    res.status(500).json({ error: error.message || 'Failed to save instructor review.' });
  }
});

app.delete('/api/instructors/:id/reviews/:reviewId', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const existingList = await readStoredJsonList<InstructorReview>(INSTRUCTOR_REVIEWS_ASSET_ID);
    const target = existingList.find(
      (r) => r.id === req.params.reviewId && r.instructorId === req.params.id
    );
    if (!target) {
      return res.status(404).json({ error: 'Instructor review not found.' });
    }
    if (target.authorId !== actor.user.id && !actor.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own review.' });
    }
    const nextList = existingList.filter((r) => r.id !== target.id);
    await writeStoredJsonList(INSTRUCTOR_REVIEWS_ASSET_ID, 'instructor_reviews_index', nextList);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete instructor review:', error);
    res.status(500).json({ error: error.message || 'Failed to delete instructor review.' });
  }
});

app.post('/api/courses/:id/enroll', async (req: Request, res: Response) => {
  try {
    let actor = await resolveRequestActor(req);
    let issuedSessionToken: string | undefined;

    const body = req.body || {};
    const requestedStudentId =
      typeof body.studentId === 'string' ? body.studentId.trim() : '';

    // Support direct SeerahVerse structured enrollment intake for new students
    if (!actor) {
      const rawFullName = String(body.fullName || '').trim();
      const rawEmail = String(body.email || '').trim().toLowerCase();
      const rawGender = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
      if (!rawFullName || !rawEmail || !rawGender) {
        return res.status(401).json({
          error: 'Please sign in or complete your Full Name, Email, and Gender in the enrollment form.',
        });
      }
      if (rawEmail === CHANCELLOR_EMAIL) {
        return res.status(401).json({
          error: 'Administrator account must sign in before enrolling.',
        });
      }

      const nameParts = rawFullName.split(/\s+/);
      const firstName = nameParts[0] || 'Scholar';
      const lastName = nameParts.slice(1).join(' ') || 'Student';

      let studentUser: User;
      if (isCloudSqlConfigured()) {
        studentUser = await findOrCreateStudentByEmailInSql({
          firstName,
          lastName,
          gender: rawGender,
          email: rawEmail,
        });
      } else {
        let existing = db.users.find((u) => u.email.toLowerCase() === rawEmail);
        if (!existing) {
          existing = {
            id: `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            firstName,
            lastName,
            email: rawEmail,
            role: 'student',
            gender: rawGender,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
          };
          db.users.push(existing);
          saveDb(db);
        }
        studentUser = existing;
      }

      issuedSessionToken = await issueSessionToken(studentUser);
      setSessionCookie(req, res, issuedSessionToken);
      actor = {
        user: studentUser,
        isAdmin: false,
        isStaff: false,
      };
    }

    const effectiveStudentId =
      actor.isAdmin && requestedStudentId ? requestedStudentId : actor.user.id;

    // Persist optional structured SeerahVerse enrollment intake metadata
    if (body.fullName || body.phoneWhatsApp || body.country || body.preferredLanguage) {
      const intakeId = `intake_${req.params.id}_${effectiveStudentId}`;
      await persistJsonIntakeRecord(intakeId, 'enrollment_intake', {
        courseId: req.params.id,
        studentId: effectiveStudentId,
        fullName: String(body.fullName || `${actor.user.firstName} ${actor.user.lastName}`).trim(),
        email: String(body.email || actor.user.email).trim().toLowerCase(),
        phoneWhatsApp: String(body.phoneWhatsApp || '').trim(),
        age: String(body.age || '').trim(),
        gender: body.gender === 'female' ? 'female' : actor.user.gender,
        country: String(body.country || '').trim(),
        city: String(body.city || '').trim(),
        educationBackground: String(body.educationBackground || '').trim(),
        preferredLanguage: String(body.preferredLanguage || 'English').trim(),
        motivation: String(body.motivation || '').trim(),
        submittedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Intake metadata save warning:', err));
    }

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const deadlineMs = course.enrollmentDeadlineUtc ? Date.parse(course.enrollmentDeadlineUtc) : NaN;
      if (
        !course.enrolledStudentIds.includes(effectiveStudentId) &&
        !actor.isAdmin &&
        !actor.isStaff &&
        !Number.isNaN(deadlineMs) &&
        Date.now() > deadlineMs
      ) {
        return res.status(409).json({
          error: 'The enrollment time limit for this cohort has passed. Please pre-register for the next intake.',
        });
      }
      const maxSpots = Math.max(1, Number(course.maxSpots) || 50);
      if (
        !course.enrolledStudentIds.includes(effectiveStudentId) &&
        !actor.isAdmin &&
        !actor.isStaff &&
        course.enrolledStudentIds.length >= maxSpots
      ) {
        return res.status(409).json({
          error: 'This cohort has reached full capacity (0 spots remaining). Please pre-register for the next cohort.',
        });
      }
      await enrollStudentInSql(course.id, effectiveStudentId, actor.user.email || undefined);
      const updated = await getCourseByIdFromSql(course.id);
      return res.json({
        success: true,
        course: updated ? sanitizeCourseForActor(updated, actor) : updated,
        ...(issuedSessionToken ? { user: actor.user, sessionToken: issuedSessionToken } : {}),
      });
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const deadlineMs = course.enrollmentDeadlineUtc ? Date.parse(course.enrollmentDeadlineUtc) : NaN;
    if (
      !course.enrolledStudentIds.includes(effectiveStudentId) &&
      !actor.isAdmin &&
      !actor.isStaff &&
      !Number.isNaN(deadlineMs) &&
      Date.now() > deadlineMs
    ) {
      return res.status(409).json({
        error: 'The enrollment time limit for this cohort has passed. Please pre-register for the next intake.',
      });
    }
    const maxSpots = Math.max(1, Number(course.maxSpots) || 50);
    if (
      !course.enrolledStudentIds.includes(effectiveStudentId) &&
      !actor.isAdmin &&
      !actor.isStaff &&
      course.enrolledStudentIds.length >= maxSpots
    ) {
      return res.status(409).json({
        error: 'This cohort has reached full capacity (0 spots remaining). Please pre-register for the next cohort.',
      });
    }
    if (!course.enrolledStudentIds.includes(effectiveStudentId)) {
      course.enrolledStudentIds.push(effectiveStudentId);
      saveDb(db);
    }
    res.json({
      success: true,
      course: sanitizeCourseForActor(course, actor),
      ...(issuedSessionToken ? { user: actor.user, sessionToken: issuedSessionToken } : {}),
    });
  } catch (error: any) {
    console.error('Failed to enroll student:', error);
    res.status(500).json({ error: error.message || 'Failed to enroll student' });
  }
});

// Pre-Registration & Academic Counseling Intake
app.post('/api/preregister', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!fullName || !email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid Full Name and Email Address are required.' });
    }
    const kind = body.kind === 'counseling' ? 'counseling' : 'preregister';
    const record = {
      id: `prereg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      kind,
      fullName,
      email,
      phoneWhatsApp: String(body.phoneWhatsApp || '').trim(),
      country: String(body.country || '').trim(),
      track: String(body.track || '').trim(),
      preferredLanguage: String(body.preferredLanguage || 'English').trim(),
      notes: String(body.notes || '').trim(),
      submittedAt: new Date().toISOString(),
    };
    await persistJsonIntakeRecord(record.id, 'preregistration', record);
    res.status(201).json({ success: true, record });
  } catch (error: any) {
    console.error('Pre-registration submission error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit registration request.' });
  }
});

// One-click demo seeder for testing (Admin convenience)
app.post('/api/courses/seed-sample', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;
    const sampleCourse: Course = {
      id: `course-seerah-101`,
      code: 'DHA-SRH101',
      title: 'Prophetic Biography (Seerah): The Makkan Dawn',
      description: 'An immersive scholastic journey through the early life, divine revelation, and moral constitution of the Prophet Muhammad ﷺ in Mecca.',
      instructorId: 'admin-mustaqeem',
      instructorName: 'Mustaqeem Shaikh',
      status: 'Open for Enrollment',
      level: 'Beginner',
      thumbnail: 'fallback://course',
      totalLectures: 12,
      maxSpots: 50,
      durationLabel: '12 Weeks · 90 min/wk',
      enrollmentDeadlineUtc: '',
      enrolledStudentIds: ['student-tester'],
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1: Arabia Before Prophethood',
          description: 'Geopolitical landscape, moral condition of Quraysh, and the ancestry of Hashim.',
          learningObjectives: [
            'Examine the lineage of Ishmael (AS) in Hijaz',
            'Analyze the socio-religious conditions of pre-Islamic Mecca',
            'Understand the Year of the Elephant and divine protection of the Ka’bah'
          ],
          instructorNotes: 'Required reading: The Sealed Nectar, Chapters 1-4. Focus on the treaty of Hilf al-Fudul.',
          lecturesCount: 3
        },
        {
          id: 'mod-2',
          title: 'Module 2: The Cave of Hira & First Revelation',
          description: 'The period of solitude, the descent of Jibril (AS), and the support of Khadijah (RA).',
          learningObjectives: [
            'Deconstruct Surah Al-Alaq 1-5 in historical context',
            'Reflect on spiritual preparedness and contemplation in Hira',
            'The counsel of Waraqah ibn Nawfal'
          ],
          instructorNotes: 'Memorize the initial 5 ayahs with classical tafsir reflections.',
          lecturesCount: 4
        },
        {
          id: 'mod-3',
          title: 'Module 3: The Secret & Public Calling',
          description: 'From Dar al-Arqam to the Mount of Safa: strategies of early community resilience.',
          learningObjectives: [
            'The early pioneers (As-Sabiqun al-Awwalun)',
            'Public proclamation from Mount Safa and response of Abu Lahab',
            'Boycott in Shi’b Abi Talib and Year of Sorrow'
          ],
          instructorNotes: 'Pay close attention to ethical steadfastness under economic boycott.',
          lecturesCount: 5
        }
      ],
      schedules: [
        {
          id: 'sch-1',
          title: 'Weekly Live Cohort & Q&A',
          dayOfWeek: 'Saturday',
          timeUtc: '14:00',
          durationMinutes: 90,
          zoomMeetingId: '982 7411 0294',
          zoomPasscode: '78699',
          zoomJoinUrl: 'https://zoom.us/j/98274110294?pwd=dhaSamplePasscode786',
          zoomStartUrl: 'https://zoom.us/s/98274110294',
          isLiveNow: true,
          recordingStatus: 'synced',
        }
      ],
      videoArchives: [
        {
          id: 'vid-1',
          title: 'Orientation Lecture: Prophetic Biography & Cohort Roadmap',
          duration: '1 hr 18 min',
          recordedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          videoUrl: '/api/streams/sample/orientation',
          thumbnailUrl: 'fallback://course',
          mimeType: 'video/mp4',
          nonDownloadable: true,
          nonShareable: true,
          isOrientation: true,
          syncedFromZoomWebhook: true,
          fileSize: '412 MB'
        },
        {
          id: 'vid-2',
          title: 'Lecture 2: The Lineage of Ishmael (AS) & Sanctuaries of Hijaz',
          duration: '1 hr 32 min',
          recordedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          videoUrl: '/api/streams/sample/lecture-2',
          thumbnailUrl: 'fallback://hero',
          mimeType: 'video/mp4',
          nonDownloadable: true,
          nonShareable: true,
          isOrientation: false,
          syncedFromZoomWebhook: true,
          fileSize: '480 MB'
        },
        {
          id: 'vid-3',
          title: 'Lecture 3: Moral Steadfastness & The Year of the Elephant',
          duration: '1 hr 10 min',
          recordedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          videoUrl: '/api/streams/sample/lecture-3',
          thumbnailUrl: 'fallback://blog',
          mimeType: 'video/mp4',
          nonDownloadable: true,
          nonShareable: true,
          isOrientation: false,
          syncedFromZoomWebhook: true,
          fileSize: '390 MB'
        }
      ],
      materials: [
        {
          id: 'mat-1',
          title: 'Syllabus & Academic Orientation Guide (Study Packet)',
          fileType: 'pdf',
          fileUrl: '/api/courses/course-seerah-101/materials/mat-1/download',
          uploadDate: new Date().toISOString(),
          size: '1.8 MB'
        },
        {
          id: 'mat-2',
          title: 'Genealogy of Quraysh & Map of Classical Hijaz',
          fileType: 'slides',
          fileUrl: '/api/courses/course-seerah-101/materials/mat-2/download',
          uploadDate: new Date().toISOString(),
          size: '3.4 MB'
        }
      ],
      assignments: [
        {
          id: 'ass-1',
          courseId: 'course-seerah-101',
          title: 'Weekly Homework 1: Reflections on Hilf al-Fudul',
          description: 'Submit a 500-word essay reflecting on the principles of social justice established in the Pact of the Virtuous and their application today.',
          type: 'homework',
          dueDateUtc: new Date(Date.now() + 86400000 * 4).toISOString(),
          points: 50,
          attachments: [{ name: 'Hilf_Al_Fudul_Readings.pdf', url: '#' }]
        },
        {
          id: 'ass-2',
          courseId: 'course-seerah-101',
          title: 'Pop Quiz 1: Chronology of Early Revelations',
          description: 'Interactive timed pop quiz testing key names, dates, and historical sequence.',
          type: 'pop_quiz',
          dueDateUtc: new Date(Date.now() + 86400000 * 2).toISOString(),
          points: 30,
          quizQuestions: [
            {
              id: 'q1',
              question: 'Which cave did the Prophet ﷺ retreat to for solitude and worship?',
              options: ['Cave of Thawr', 'Cave of Hira', 'Cave of Uhud', 'Cave of Quba'],
              correctIndex: 1,
              explanation: 'Mount Nur houses the Cave of Hira where the first revelation occurred.'
            },
            {
              id: 'q2',
              question: 'Who was the Christian scholar Khadijah (RA) took the Prophet ﷺ to see?',
              options: ['Bahira', 'Waraqah ibn Nawfal', 'Salman al-Farsi', 'Najashi'],
              correctIndex: 1,
              explanation: 'Waraqah ibn Nawfal confirmed the coming of the Divine Messenger (Namus).'
            },
            {
              id: 'q3',
              question: 'What were the first words revealed to the Prophet Muhammad ﷺ?',
              options: ['Alhamdulillah', 'Bismillah', 'Iqra (Read/Recite)', 'Qum fa-andhir'],
              correctIndex: 2,
              explanation: 'Surah Al-Alaq begins with the commanding imperative "Iqra" (Read).'
            }
          ]
        },
        {
          id: 'ass-3',
          courseId: 'course-seerah-101',
          title: 'Standard Assignment: Historical Source Analysis',
          description: 'Compare two historical narrations regarding the sanctuary status of Mecca.',
          type: 'standard_assignment',
          dueDateUtc: new Date(Date.now() + 86400000 * 7).toISOString(),
          points: 100,
        },
        {
          id: 'ass-4',
          courseId: 'course-seerah-101',
          title: 'Major Project: Interactive Map of Early Prophetic Milestones',
          description: 'Collaborative milestone project mapping the journey, treaties, and settlements of early Islamic history.',
          type: 'major_project',
          dueDateUtc: new Date(Date.now() + 86400000 * 14).toISOString(),
          points: 200,
          projectMilestones: [
            'Milestone 1: Topic selection & primary bibliography submission (Week 2)',
            'Milestone 2: Geospatial draft coordinates & annotated points of interest (Week 4)',
            'Milestone 3: Final multimedia submission and peer presentation (Week 6)'
          ],
          rubric: [
            'Historical Authenticity (40%)',
            'Depth of Scholarly Commentary (30%)',
            'Cartographic Clarity & Design (30%)'
          ]
        }
      ]
    };

    if (isCloudSqlConfigured()) {
      await createCourseInSql(sampleCourse);
      const created = await getCourseByIdFromSql(sampleCourse.id);
      return res.json({ message: 'Sample course created successfully.', course: created || sampleCourse });
    }

    db.courses.unshift(sampleCourse);
    saveDb(db);
    res.json({ message: 'Sample course created successfully.', course: sampleCourse });
  } catch (error: any) {
    console.error('Failed to seed sample course:', error);
    res.status(500).json({ error: error.message || 'Failed to seed sample course' });
  }
});

// Live Zoom & Built-In Classroom Automation + Webhook Integration
app.post('/api/zoom/create-meeting', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const { topic, courseId, startTimeUtc, dateStr, dayOfWeek, instructorId, instructorName } = req.body;
    const rawCode = `${Math.floor(100 + Math.random() * 900)}${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}`;
    const meetingId = `${rawCode.slice(0, 3)} ${rawCode.slice(3, 7)} ${rawCode.slice(7, 11)}`;
    const passcode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const joinUrl = `/?tab=classroom&room=${rawCode}&pwd=${passcode}`;
    const startUrl = `/?tab=classroom&room=${rawCode}&host=1`;

    const resolvedInstructorId = instructorId || actor.user.id;
    const resolvedInstructorName =
      instructorName || `${actor.user.firstName} ${actor.user.lastName}`;
    const resolvedIso = startTimeUtc || new Date().toISOString();
    const derivedDay =
      dayOfWeek ||
      new Date(resolvedIso).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

    const newSchedule = {
      id: `sch-${Date.now()}`,
      title: topic || 'Live Academic Session',
      dateStr: dateStr || resolvedIso.slice(0, 10),
      dayOfWeek: derivedDay,
      timeUtc: resolvedIso,
      durationMinutes: 90,
      instructorId: resolvedInstructorId,
      instructorName: resolvedInstructorName,
      zoomMeetingId: meetingId,
      zoomPasscode: passcode,
      zoomJoinUrl: joinUrl,
      zoomStartUrl: startUrl,
      isLiveNow: true,
      recordingStatus: 'recording' as const,
    };

    if (courseId) {
      if (isCloudSqlConfigured()) {
        const course = await getCourseByIdFromSql(courseId);
        if (course) {
          await updateCourseInSql(course.id, {
            schedules: [...(course.schedules || []), newSchedule],
          });
        }
      } else {
        const course = db.courses.find(c => c.id === courseId);
        if (course) {
          course.schedules.push(newSchedule);
          saveDb(db);
        }
      }
    }

    res.json({
      meetingId,
      passcode,
      joinUrl,
      startUrl,
      schedule: newSchedule,
      autoRecording: 'cloud',
      message: 'Live classroom link & host room provisioned with recording ready.',
    });
  } catch (error: any) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: error.message || 'Failed to provision live meeting' });
  }
});

app.post('/api/zoom/start-meeting', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const { courseId, scheduleId, eventId } = req.body;
    let matchedSchedule: any = null;

    if (courseId && scheduleId) {
      if (isCloudSqlConfigured()) {
        const course = await getCourseByIdFromSql(courseId);
        if (course) {
          const updatedSchedules = course.schedules.map(s => {
            if (s.id === scheduleId) {
              matchedSchedule = { ...s, isLiveNow: true, recordingStatus: 'recording' as const };
              return matchedSchedule;
            }
            return s;
          });
          await updateCourseInSql(course.id, { schedules: updatedSchedules });
        }
      } else {
        const course = db.courses.find(c => c.id === courseId);
        const schedule = course?.schedules.find(s => s.id === scheduleId);
        if (schedule) {
          schedule.isLiveNow = true;
          schedule.recordingStatus = 'recording';
          matchedSchedule = schedule;
          saveDb(db);
        }
      }
    }

    if (eventId) {
      if (isCloudSqlConfigured()) {
        await updateEventInSql(eventId, { isLiveNow: true });
      } else {
        const ev = db.calendarEvents.find(e => e.id === eventId);
        if (ev) {
          ev.isLiveNow = true;
          saveDb(db);
        }
      }
    }

    return res.json({ success: true, schedule: matchedSchedule });
  } catch (error: any) {
    console.error('Start meeting error:', error);
    res.status(500).json({ error: error.message || 'Failed to start meeting' });
  }
});

app.post('/api/meetings/end', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const { courseId, scheduleId, eventId } = req.body || {};

    if (courseId && scheduleId) {
      if (isCloudSqlConfigured()) {
        const course = await getCourseByIdFromSql(courseId);
        if (course) {
          const updatedSchedules = course.schedules.map(s =>
            s.id === scheduleId ? { ...s, isLiveNow: false, recordingStatus: 'synced' as const } : s
          );
          await updateCourseInSql(course.id, { schedules: updatedSchedules });
        }
      } else {
        const course = db.courses.find(c => c.id === courseId);
        const schedule = course?.schedules.find(s => s.id === scheduleId);
        if (schedule) {
          schedule.isLiveNow = false;
          schedule.recordingStatus = 'synced';
          saveDb(db);
        }
      }
    }

    if (eventId) {
      if (isCloudSqlConfigured()) {
        await updateEventInSql(eventId, { isLiveNow: false });
      } else {
        const ev = db.calendarEvents.find(e => e.id === eventId);
        if (ev) {
          ev.isLiveNow = false;
          saveDb(db);
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('End meeting error:', error);
    res.status(500).json({ error: error.message || 'Failed to end live meeting' });
  }
});

// Automated Zoom Cloud Archive Hook (`MEETING_RECORDING_COMPLETED`)
app.post('/api/zoom/webhook/recording-completed', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const { courseId, meetingId, downloadUrl, duration, topic } = req.body;
    const newArchive = {
      id: `archive-${Date.now()}`,
      title: topic || `Live Class Archive (${new Date().toLocaleDateString()})`,
      duration: duration || '1 hr 12 min',
      recordedAt: new Date().toISOString(),
      videoUrl: downloadUrl || '/api/streams/sample/zoom-archive',
      mimeType: 'video/mp4' as const,
      nonDownloadable: true,
      nonShareable: true,
      isOrientation: false,
      syncedFromZoomWebhook: true,
      fileSize: `${Math.floor(250 + Math.random() * 300)} MB`
    };

    if (isCloudSqlConfigured()) {
      const allCourses = await listCoursesFromSql();
      const course = allCourses.find(c => c.id === courseId) || allCourses[0];
      if (!course) return res.status(404).json({ error: 'No course found for webhook archive.' });

      await upsertRecordingInSql(course.id, newArchive);
      if (meetingId) {
        const updatedSchedules = course.schedules.map(s =>
          s.zoomMeetingId === meetingId
            ? { ...s, recordingStatus: 'synced' as const, isLiveNow: false }
            : s
        );
        await updateCourseInSql(course.id, { schedules: updatedSchedules });
      }
      return res.json({
        success: true,
        message: 'Automated Cloud Archive Hook triggered. Video added to course video archive.',
        archive: newArchive
      });
    }

    const course = db.courses.find(c => c.id === courseId) || db.courses[0];
    if (!course) return res.status(404).json({ error: 'No course found for webhook archive.' });

    course.videoArchives.unshift(newArchive);
    const schedule = course.schedules.find(s => s.zoomMeetingId === meetingId);
    if (schedule) {
      schedule.recordingStatus = 'synced';
      schedule.isLiveNow = false;
    }

    saveDb(db);
    res.json({
      success: true,
      message: 'Automated Cloud Archive Hook triggered. Video added to course video archive.',
      archive: newArchive
    });
  } catch (error: any) {
    console.error('Zoom webhook error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync recording webhook' });
  }
});

// Automated Portal Join Attendance Tracking
app.post('/api/attendance/join', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to record attendance.' });
    }

    const { courseId, scheduleId, studentId, studentName, timezoneDetected } = req.body || {};
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required to mark attendance.' });
    }

    const effectiveStudentId =
      actor.isAdmin && typeof studentId === 'string' && studentId.trim()
        ? studentId.trim()
        : actor.user.id;
    const effectiveStudentName =
      actor.isAdmin && typeof studentName === 'string' && studentName.trim()
        ? studentName.trim()
        : `${actor.user.firstName} ${actor.user.lastName}`;

    const record: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      scheduleId: scheduleId || 'general-live',
      studentId: effectiveStudentId,
      studentName: effectiveStudentName || 'Student',
      timestamp: new Date().toISOString(),
      status: 'Present',
      timezoneDetected: timezoneDetected || Intl.DateTimeFormat().resolvedOptions().timeZone,
      verifiedByTeacher: true
    };

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      await createAttendanceInSql(record);
      const schedule = course.schedules.find(s => s.id === scheduleId) || course.schedules[0];
      return res.json({
        success: true,
        attendanceRecord: record,
        zoomJoinUrl: schedule?.zoomJoinUrl || 'https://zoom.us/j/98274110294'
      });
    }

    const course = db.courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    db.attendance.push(record);
    saveDb(db);

    const schedule = course.schedules.find(s => s.id === scheduleId) || course.schedules[0];
    res.json({
      success: true,
      attendanceRecord: record,
      zoomJoinUrl: schedule?.zoomJoinUrl || 'https://zoom.us/j/98274110294'
    });
  } catch (error: any) {
    console.error('Attendance logging error:', error);
    res.status(500).json({ error: error.message || 'Failed to record attendance' });
  }
});

app.get('/api/attendance/me', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to view attendance logs.' });
    }
    const requestedStudentId =
      typeof req.query?.studentId === 'string' ? req.query.studentId.trim() : '';
    const targetStudentId =
      actor.isAdmin && requestedStudentId ? requestedStudentId : actor.user.id;

    if (isCloudSqlConfigured()) {
      const records = await listAttendanceByStudentAllFromSql(targetStudentId);
      return res.json(records);
    }
    const records = db.attendance
      .filter(a => a.studentId === targetStudentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(records);
  } catch (error: any) {
    console.error('Failed to fetch personal attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch attendance logs' });
  }
});

app.get('/api/attendance/course/:courseId', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const records = await listCourseAttendanceFromSql(req.params.courseId);
      return res.json(records);
    }
    const records = db.attendance.filter(a => a.courseId === req.params.courseId);
    res.json(records);
  } catch (error: any) {
    console.error('Failed to fetch attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch attendance' });
  }
});

// Academic Assessments & Submissions
app.post('/api/courses/:id/assessments', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const payloadAssessment = (courseId: string): AcademicAssessment => ({
      id: req.body.id || `ass-${Date.now()}`,
      courseId,
      moduleId: typeof req.body.moduleId === 'string' && req.body.moduleId.trim() ? req.body.moduleId.trim() : undefined,
      moduleTitle: typeof req.body.moduleTitle === 'string' && req.body.moduleTitle.trim() ? req.body.moduleTitle.trim() : undefined,
      title: String(req.body.title || 'Untitled Assessment').trim(),
      description: String(req.body.description || '').trim(),
      type: req.body.type || 'homework',
      assignedDateUtc: req.body.assignedDateUtc || new Date().toISOString(),
      dueDateUtc: req.body.dueDateUtc || new Date(Date.now() + 86400000 * 5).toISOString(),
      points: Number(req.body.points) || 100,
      durationMinutes: req.body.durationMinutes ? Number(req.body.durationMinutes) : undefined,
      passingScorePercent: req.body.passingScorePercent ? Number(req.body.passingScorePercent) : undefined,
      allowFileUpload: req.body.allowFileUpload !== false,
      createdBy: `${actor.user.firstName} ${actor.user.lastName}`,
      rubric: Array.isArray(req.body.rubric) ? req.body.rubric : [],
      quizQuestions: Array.isArray(req.body.quizQuestions) ? req.body.quizQuestions : [],
      projectMilestones: Array.isArray(req.body.projectMilestones) ? req.body.projectMilestones : [],
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    });

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const assessment = payloadAssessment(course.id);
      await updateCourseInSql(course.id, {
        assignments: [...(course.assignments || []), assessment],
      });
      return res.status(201).json(assessment);
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const assessment = payloadAssessment(course.id);
    course.assignments.push(assessment);
    saveDb(db);
    res.status(201).json(assessment);
  } catch (error: any) {
    console.error('Failed to add assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to create assessment' });
  }
});

app.delete('/api/courses/:id/assessments/:assId', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const course = await getCourseByIdFromSql(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const nextAssignments = (course.assignments || []).filter(a => a.id !== req.params.assId);
      await updateCourseInSql(course.id, { assignments: nextAssignments });
      return res.json({ success: true });
    }

    const course = db.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    course.assignments = course.assignments.filter(a => a.id !== req.params.assId);
    saveDb(db);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete assessment' });
  }
});

app.get('/api/submissions', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : undefined;

    if (isCloudSqlConfigured()) {
      const rows = await listAllSubmissionsFromSql(courseId);
      return res.json(rows);
    }
    const rows = (
      courseId ? db.submissions.filter(s => s.courseId === courseId) : [...db.submissions]
    ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    res.json(rows);
  } catch (error: any) {
    console.error('Failed to fetch submissions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch submissions' });
  }
});

app.get('/api/submissions/me', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to fetch your submissions.' });
    }
    if (isCloudSqlConfigured()) {
      const rows = await listStudentSubmissionsAllFromSql(actor.user.id);
      return res.json(rows);
    }
    const rows = db.submissions
      .filter(s => s.studentId === actor.user.id)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    res.json(rows);
  } catch (error: any) {
    console.error('Failed to fetch student submissions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch your submissions' });
  }
});

app.post('/api/assessments/:id/submit', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to submit assessments.' });
    }

    const {
      courseId,
      studentId,
      studentName,
      type,
      content,
      fileUrl,
      fileName,
      linkUrl,
      linkLabel,
      quizAnswers,
    } = req.body || {};

    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ error: 'Target courseId is required.' });
    }

    const effectiveStudentId =
      actor.isAdmin && typeof studentId === 'string' && studentId.trim()
        ? studentId.trim()
        : actor.user.id;
    const effectiveStudentName =
      actor.isAdmin && typeof studentName === 'string' && studentName.trim()
        ? studentName.trim()
        : `${actor.user.firstName} ${actor.user.lastName}`;

    const course = isCloudSqlConfigured()
      ? await getCourseByIdFromSql(courseId)
      : db.courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const isEnrolled = isCloudSqlConfigured()
      ? await isStudentEnrolledInSql(courseId, effectiveStudentId)
      : course.enrolledStudentIds.includes(effectiveStudentId);
    if (!actor.isAdmin && !actor.isStaff && !isEnrolled) {
      return res.status(403).json({
        error: 'Please enroll in this course (free) before submitting assignments for instructor review.',
      });
    }

    const isGeneralCoursework = req.params.id === 'general-coursework';
    const matchedAssessment = isGeneralCoursework
      ? null
      : resolveCourseAssessmentById(course, req.params.id);
    if (!matchedAssessment && !isGeneralCoursework) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment: AcademicAssessment = matchedAssessment || {
      id: 'general-coursework',
      courseId: course.id,
      title: 'Coursework / General Review',
      description: 'Student submitted coursework file or link for instructor review.',
      type: 'homework',
      dueDateUtc: new Date().toISOString(),
      points: 100,
    };

    const rawFileUrl = typeof fileUrl === 'string' ? fileUrl.trim() : '';
    if (
      rawFileUrl &&
      !rawFileUrl.startsWith('/api/docs/') &&
      !rawFileUrl.startsWith('https://') &&
      !rawFileUrl.startsWith('http://')
    ) {
      return res.status(400).json({ error: 'Invalid assignment file URL.' });
    }

    const rawLinkUrl = typeof linkUrl === 'string' ? linkUrl.trim() : '';
    if (rawLinkUrl && !rawLinkUrl.startsWith('https://') && !rawLinkUrl.startsWith('http://')) {
      return res.status(400).json({
        error: 'Submission links must start with https:// or http://.',
      });
    }

    let finalFileUrl: string | undefined = rawFileUrl || undefined;
    let finalFileName: string | undefined =
      typeof fileName === 'string' && fileName.trim() ? fileName.trim() : undefined;
    let finalContent: string | undefined =
      typeof content === 'string' && content.trim() ? content.trim() : undefined;

    if (rawLinkUrl) {
      const cleanLabel = typeof linkLabel === 'string' ? linkLabel.trim() : '';
      let hostLabel = rawLinkUrl;
      try {
        hostLabel = new URL(rawLinkUrl).hostname;
      } catch {
        // Fallback to raw URL
      }
      if (!finalFileUrl) {
        finalFileUrl = rawLinkUrl;
        finalFileName = cleanLabel || `Submitted Link (${hostLabel})`;
      } else {
        const linkNote = cleanLabel
          ? `Reference Link (${cleanLabel}): ${rawLinkUrl}`
          : `Reference Link: ${rawLinkUrl}`;
        finalContent = finalContent ? `${finalContent}\n\n${linkNote}` : linkNote;
      }
    }

    const hasQuizAnswers = Array.isArray(quizAnswers) && quizAnswers.length > 0;
    if (!finalContent && !finalFileUrl && !rawLinkUrl && !hasQuizAnswers) {
      return res.status(400).json({
        error: 'Please write a response, upload an assignment file, or provide an external link.',
      });
    }

    let quizScore: number | undefined;
    let grade: number | undefined;
    let status: 'submitted' | 'graded' = 'submitted';
    let correctCount: number | undefined;
    let totalQuestions: number | undefined;
    let percentage: number | undefined;
    let passed: boolean | undefined;
    const passingScorePercent = matchedAssessment?.passingScorePercent ?? 70;

    const effectiveType = type || assessment.type;
    if (
      (effectiveType === 'pop_quiz' || effectiveType === 'exam') &&
      Array.isArray(quizAnswers) &&
      matchedAssessment?.quizQuestions &&
      matchedAssessment.quizQuestions.length > 0
    ) {
      const totalQ = Math.max(1, matchedAssessment.quizQuestions.length);
      let hits = 0;
      matchedAssessment.quizQuestions.forEach((q, idx) => {
        if (quizAnswers[idx] === q.correctIndex) {
          hits++;
        }
      });
      correctCount = hits;
      totalQuestions = totalQ;
      percentage = Math.round((hits / totalQ) * 100);
      passed = percentage >= passingScorePercent;
      quizScore = Math.round((hits / totalQ) * assessment.points);
      if (effectiveType === 'pop_quiz' || (!finalContent && !finalFileUrl)) {
        grade = quizScore;
        status = 'graded';
      }
    }

    const autoFeedback =
      status === 'graded' && typeof correctCount === 'number' && typeof totalQuestions === 'number'
        ? `Auto-graded: ${correctCount}/${totalQuestions} correct (${percentage}%). ${
            passed
              ? `Passed (>= ${passingScorePercent}% required).`
              : `Below ${passingScorePercent}% passing threshold.`
          }${assessment.moduleTitle ? ` Module: ${assessment.moduleTitle}.` : ''}`
        : status === 'graded'
        ? 'Automatically assessed by Deen Hijrah Academia Engine.'
        : undefined;

    const submission: StudentSubmission = {
      id: `sub-${Date.now()}`,
      assessmentId: assessment.id,
      courseId: course.id,
      moduleId: assessment.moduleId,
      moduleTitle: assessment.moduleTitle,
      studentId: effectiveStudentId,
      studentName: effectiveStudentName || 'Student',
      submittedAt: new Date().toISOString(),
      type: effectiveType,
      content: finalContent,
      fileUrl: finalFileUrl,
      fileName: finalFileName,
      linkUrl: rawLinkUrl || undefined,
      quizAnswers,
      quizScore,
      correctCount,
      totalQuestions,
      passed,
      grade,
      maxPoints: assessment.points,
      feedback: autoFeedback,
      status
    };

    if (isCloudSqlConfigured()) {
      await createSubmissionInSql(submission);
      return res.json({
        success: true,
        submission,
        correctCount,
        totalQuestions,
        percentage,
        passed,
        passingScorePercent,
      });
    }

    db.submissions.push(submission);
    saveDb(db);
    res.json({
      success: true,
      submission,
      correctCount,
      totalQuestions,
      percentage,
      passed,
      passingScorePercent,
    });
  } catch (error: any) {
    console.error('Failed to submit assessment:', error);
    res.status(500).json({ error: error.message || 'Failed to submit assessment' });
  }
});

app.patch('/api/submissions/:id/grade', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const updated = await gradeSubmissionInSql(
        req.params.id,
        Number(req.body.grade),
        req.body.feedback || ''
      );
      if (!updated) return res.status(404).json({ error: 'Submission not found' });
      return res.json(updated);
    }

    const sub = db.submissions.find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    sub.grade = Number(req.body.grade);
    sub.feedback = req.body.feedback || '';
    sub.status = 'graded';
    saveDb(db);
    res.json(sub);
  } catch (error: any) {
    console.error('Failed to grade submission:', error);
    res.status(500).json({ error: error.message || 'Failed to grade submission' });
  }
});

// Student Portal Viewer for Admin / Teacher Roster
app.get('/api/student-viewer/:courseId/:studentId', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    const { courseId, studentId } = req.params;
    const course = isCloudSqlConfigured()
      ? await getCourseByIdFromSql(courseId)
      : db.courses.find(c => c.id === courseId);
    const student = isCloudSqlConfigured()
      ? await getUserByUidFromSql(studentId)
      : db.users.find(u => u.id === studentId);

    if (!course || !student) {
      return res.status(404).json({ error: 'Course or student not found' });
    }

    const attendanceHistory = isCloudSqlConfigured()
      ? await listStudentAttendanceFromSql(courseId, studentId)
      : db.attendance.filter(a => a.courseId === courseId && a.studentId === studentId);
    const submissions = isCloudSqlConfigured()
      ? await listStudentCourseSubmissionsFromSql(courseId, studentId)
      : db.submissions.filter(s => s.courseId === courseId && s.studentId === studentId);

    const quizScores = submissions
      .filter(s => s.type === 'pop_quiz' && s.quizScore !== undefined)
      .map(s => {
        const ass = course.assignments.find(a => a.id === s.assessmentId);
        return {
          quizTitle: ass?.title || 'Pop Quiz',
          score: s.quizScore || 0,
          max: s.maxPoints,
          date: s.submittedAt
        };
      });

    let totalPointsEarned = 0;
    let totalMaxPoints = 0;
    submissions.forEach(s => {
      if (s.grade !== undefined) {
        totalPointsEarned += s.grade;
        totalMaxPoints += s.maxPoints;
      }
    });

    const overallGradePercent = totalMaxPoints > 0 ? Math.round((totalPointsEarned / totalMaxPoints) * 100) : 95;
    const attendancePercentage = course.schedules.length > 0
      ? Math.min(100, Math.round((attendanceHistory.length / Math.max(1, course.schedules.length * 3)) * 100))
      : (attendanceHistory.length > 0 ? 100 : 0);

    const studentData: StudentSubjectProgress = {
      courseId: course.id,
      courseTitle: course.title,
      enrolled: course.enrolledStudentIds.includes(studentId),
      completedLectures: course.videoArchives.length,
      totalLectures: course.totalLectures,
      attendanceCount: attendanceHistory.length,
      totalAttendanceSessions: Math.max(course.schedules.length, attendanceHistory.length),
      attendancePercentage,
      attendanceHistory,
      submissions,
      quizScores,
      overallGradePercent
    };

    res.json({
      student,
      progress: studentData
    });
  } catch (error: any) {
    console.error('Failed to fetch student viewer data:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch student portal inspection view' });
  }
});

// Community Feed & Messaging with Moderation Engine
app.get('/api/community/posts', async (_req: Request, res: Response) => {
  try {
    if (isCloudSqlConfigured()) {
      const posts = await listCommunityPostsFromSql();
      return res.json(posts);
    }
    res.json(db.communityPosts);
  } catch (error: any) {
    console.error('Failed to fetch community posts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch community posts' });
  }
});

app.post('/api/community/posts', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to publish community posts.' });
    }

    const { content, mediaUrl, category, pinned } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Post content required' });
    }

    const cleanContent = String(content).trim();
    const authorId = actor.user.id;
    const authorName = `${actor.user.firstName} ${actor.user.lastName}`;
    const authorRole = actor.user.role;
    const authorGender = actor.user.gender;

    const safety = checkContentSafety(cleanContent);
    if (!safety.safe) {
      const log: ModerationLog = {
        id: `mod-${Date.now()}`,
        source: 'community_post',
        authorId,
        authorName,
        content: cleanContent,
        flaggedKeyword: safety.flaggedKeyword || 'prohibited_content',
        action: 'blocked',
        timestamp: new Date().toISOString(),
        reviewedByMustaqeem: false,
      };
      if (isCloudSqlConfigured()) {
        await createModerationLogInSql(log);
      } else {
        db.moderationLogs.unshift(log);
        saveDb(db);
      }
      return res.status(403).json({
        error: 'Message blocked by Deen Hijrah Academia Safety Filter. Flagged incident logged for Mustaqeem.',
        moderationLog: log
      });
    }

    const post: CommunityPost = {
      id: `post-${Date.now()}`,
      authorId,
      authorName,
      authorRole,
      authorGender,
      authorAvatar: actor.user.avatarUrl,
      content: cleanContent,
      mediaUrl: typeof mediaUrl === 'string' && mediaUrl.trim() ? mediaUrl.trim() : undefined,
      category: actor.isAdmin && category === 'announcement' ? 'announcement' : 'community',
      pinned: actor.isAdmin ? Boolean(pinned) : false,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByUserIds: [],
      comments: [],
      flagged: false,
    };

    if (isCloudSqlConfigured()) {
      await createCommunityPostInSql(post);
      return res.status(201).json(post);
    }

    db.communityPosts.unshift(post);
    saveDb(db);
    res.status(201).json(post);
  } catch (error: any) {
    console.error('Failed to create community post:', error);
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

app.post('/api/community/posts/:id/like', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to like community posts.' });
    }
    const effectiveUserId = actor.user.id;

    if (isCloudSqlConfigured()) {
      const updated = await toggleCommunityPostLikeInSql(req.params.id, effectiveUserId);
      if (!updated) return res.status(404).json({ error: 'Post not found' });
      return res.json(updated);
    }

    const post = db.communityPosts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const idx = post.likedByUserIds.indexOf(effectiveUserId);
    if (idx > -1) {
      post.likedByUserIds.splice(idx, 1);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedByUserIds.push(effectiveUserId);
      post.likes++;
    }
    saveDb(db);
    res.json(post);
  } catch (error: any) {
    console.error('Failed to toggle like:', error);
    res.status(500).json({ error: error.message || 'Failed to update like' });
  }
});

app.post('/api/community/posts/:id/comments', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to reply to community posts.' });
    }

    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Comment content required' });
    }

    const cleanContent = String(content).trim();
    const authorId = actor.user.id;
    const authorName = `${actor.user.firstName} ${actor.user.lastName}`;
    const authorRole = actor.user.role;
    const authorGender = actor.user.gender;

    const safety = checkContentSafety(cleanContent);
    if (!safety.safe) {
      const log: ModerationLog = {
        id: `mod-${Date.now()}`,
        source: 'community_post',
        authorId,
        authorName,
        content: cleanContent,
        flaggedKeyword: safety.flaggedKeyword || 'prohibited_content',
        action: 'blocked',
        timestamp: new Date().toISOString(),
        reviewedByMustaqeem: false,
      };
      if (isCloudSqlConfigured()) {
        await createModerationLogInSql(log);
      } else {
        db.moderationLogs.unshift(log);
        saveDb(db);
      }
      return res.status(403).json({ error: 'Comment blocked by safety filter.' });
    }

    const comment = {
      id: `c-${Date.now()}`,
      postId: req.params.id,
      authorId,
      authorName,
      authorRole,
      authorGender,
      authorAvatar: actor.user.avatarUrl,
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };

    if (isCloudSqlConfigured()) {
      const saved = await addCommunityPostCommentInSql(req.params.id, comment);
      if (!saved) return res.status(404).json({ error: 'Post not found' });
      return res.status(201).json(saved);
    }

    const post = db.communityPosts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.comments.push(comment);
    saveDb(db);
    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Failed to add comment:', error);
    res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
});

// Chat Messages (WhatsApp-style)
app.get('/api/chat/messages', async (req: Request, res: Response) => {
  try {
    const { courseId, channelId } = req.query;
    if (isCloudSqlConfigured()) {
      const msgs = await listChatMessagesFromSql({
        courseId: typeof courseId === 'string' ? courseId : undefined,
        channelId: typeof channelId === 'string' ? channelId : undefined,
      });
      return res.json(msgs);
    }
    let msgs = db.chatMessages;
    if (courseId) {
      msgs = msgs.filter(m => m.courseId === courseId);
    } else if (channelId) {
      msgs = msgs.filter(m => m.channelId === channelId);
    }
    res.json(msgs);
  } catch (error: any) {
    console.error('Failed to list chat messages:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
});

app.post('/api/chat/messages', async (req: Request, res: Response) => {
  try {
    const actor = await resolveRequestActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Please sign in to send chat messages.' });
    }

    const { courseId, channelId, content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Content required' });
    }

    const cleanContent = String(content).trim();
    const senderId = actor.user.id;
    const senderName = `${actor.user.firstName} ${actor.user.lastName}`;
    const senderRole = actor.user.role;
    const senderGender = actor.user.gender;

    const safety = checkContentSafety(cleanContent);
    if (!safety.safe) {
      const log: ModerationLog = {
        id: `mod-${Date.now()}`,
        source: 'chat_message',
        authorId: senderId,
        authorName: senderName,
        content: cleanContent,
        flaggedKeyword: safety.flaggedKeyword || 'prohibited_chat',
        action: 'blocked',
        timestamp: new Date().toISOString(),
        reviewedByMustaqeem: false,
      };
      if (isCloudSqlConfigured()) {
        await createModerationLogInSql(log);
      } else {
        db.moderationLogs.unshift(log);
        saveDb(db);
      }
      return res.status(403).json({ error: 'Chat message blocked due to inappropriate language or link spam.' });
    }

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      courseId: typeof courseId === 'string' && courseId.trim() ? courseId.trim() : undefined,
      channelId: typeof channelId === 'string' && channelId.trim() ? channelId.trim() : 'general',
      senderId,
      senderName,
      senderRole,
      senderGender,
      senderAvatar: actor.user.avatarUrl,
      content: cleanContent,
      timestamp: new Date().toISOString(),
      flagged: false,
    };

    if (isCloudSqlConfigured()) {
      await createChatMessageInSql(msg);
      return res.status(201).json(msg);
    }

    db.chatMessages.push(msg);
    saveDb(db);
    res.status(201).json(msg);
  } catch (error: any) {
    console.error('Failed to send chat message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Moderation Logs (For Mustaqeem)
app.get('/api/admin/moderation-logs', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const logs = await listModerationLogsFromSql();
      return res.json(logs);
    }
    res.json(db.moderationLogs);
  } catch (error: any) {
    console.error('Failed to fetch moderation logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch moderation logs' });
  }
});

app.patch('/api/admin/moderation-logs/:id/review', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      await markModerationReviewedInSql(req.params.id);
      return res.json({ success: true });
    }
    const log = db.moderationLogs.find(l => l.id === req.params.id);
    if (log) {
      log.reviewedByMustaqeem = true;
      saveDb(db);
    }
    res.json({ success: true, log });
  } catch (error: any) {
    console.error('Failed to mark moderation log reviewed:', error);
    res.status(500).json({ error: error.message || 'Failed to update moderation log' });
  }
});

// Blogs & Articles
app.get('/api/blogs', async (_req: Request, res: Response) => {
  try {
    if (isCloudSqlConfigured()) {
      const posts = await listBlogPostsFromSql();
      return res.json(posts);
    }
    res.json(db.blogPosts);
  } catch (error: any) {
    console.error('Failed to load blog posts:', error);
    res.status(500).json({ error: error.message || 'Failed to load blog posts' });
  }
});

app.post('/api/blogs', async (req: Request, res: Response) => {
  try {
    const actor = await requireAdminActor(req, res);
    if (!actor) return;

    const title = String(req.body?.title || '').trim();
    const excerpt = String(req.body?.excerpt || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: 'Blog title, excerpt, and content are required.' });
    }

    const newPost: BlogPost = {
      id: `blog-${Date.now()}`,
      title,
      excerpt,
      content,
      authorName: req.body.authorName || 'Administrator Mustaqeem',
      authorBadge: req.body.authorBadge || 'Faculty',
      readTime: req.body.readTime || '3 min read',
      bannerUrl: req.body.bannerUrl || 'fallback://blog',
      publishedAt: new Date().toISOString(),
      tags: Array.isArray(req.body.tags) && req.body.tags.length > 0 ? req.body.tags : ['Academics']
    };
    if (isCloudSqlConfigured()) {
      await createBlogPostInSql(newPost);
      return res.status(201).json(newPost);
    }
    db.blogPosts.unshift(newPost);
    saveDb(db);
    res.status(201).json(newPost);
  } catch (error: any) {
    console.error('Failed to create blog post:', error);
    res.status(500).json({ error: error.message || 'Failed to publish blog post' });
  }
});

// Calendar Events & Pinned Poster Board CRUD
app.get('/api/calendar/events', async (_req: Request, res: Response) => {
  try {
    const customEvents = isCloudSqlConfigured()
      ? await listEventsFromSql()
      : [...db.calendarEvents].map((ev) => ({ ...ev, isDerived: false }));

    const activeCourses = isCloudSqlConfigured()
      ? await listCoursesFromSql()
      : db.courses;

    const events: CalendarEvent[] = [...customEvents];
    activeCourses.forEach(c => {
      c.schedules.forEach(s => {
        events.push({
          id: `ev-sch-${s.id}`,
          title: `Live Class: ${s.title || c.title}`,
          courseId: c.id,
          courseTitle: c.title,
          startUtc: s.timeUtc,
          endUtc: s.timeUtc,
          dateStr: s.dateStr || (s.timeUtc.includes('T') ? s.timeUtc.slice(0, 10) : ''),
          dayOfWeek: s.dayOfWeek,
          timeUtc: s.timeUtc,
          instructorId: s.instructorId || c.instructorId,
          instructorName: s.instructorName || c.instructorName,
          meetingId: s.zoomMeetingId,
          meetingPasscode: s.zoomPasscode,
          joinUrl: s.zoomJoinUrl,
          hostStartUrl: s.zoomStartUrl,
          isLiveNow: s.isLiveNow,
          type: 'lecture',
          pinnedToBoard: false,
          isDerived: true,
        });
      });
      c.assignments.forEach(a => {
        events.push({
          id: `ev-ass-${a.id}`,
          title: `Due: ${a.title}`,
          courseId: c.id,
          courseTitle: c.title,
          startUtc: a.dueDateUtc,
          endUtc: a.dueDateUtc,
          type:
            a.type === 'pop_quiz' || a.type === 'exam'
              ? 'quiz'
              : a.type === 'homework'
              ? 'homework'
              : 'project',
          pinnedToBoard: false,
          isDerived: true,
        });
      });
    });
    res.json(events);
  } catch (error: any) {
    console.error('Failed to load calendar events:', error);
    res.status(500).json({ error: error.message || 'Failed to load calendar events' });
  }
});

app.post('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const {
      id,
      title,
      description,
      posterUrl,
      courseId,
      courseTitle,
      startUtc,
      endUtc,
      dateStr,
      dayOfWeek,
      timeUtc,
      instructorId,
      instructorName,
      type,
      pinnedToBoard,
      pinColor,
      locationOrLabel,
      autoRecord,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Event title is required.' });
    }

    const validPinColors = new Set(['aqua', 'emerald', 'crimson', 'amber']);
    const validTypes = new Set(['lecture', 'quiz', 'homework', 'project', 'academic_date', 'event']);

    // Build startUtc from explicit dateStr + timeUtc if provided
    let resolvedStartUtc = String(startUtc || '').trim();
    const cleanDateStr = String(dateStr || '').trim();
    const cleanTimeStr = String(timeUtc || '').trim();
    if (!resolvedStartUtc && cleanDateStr) {
      const hhmm = /^\d{2}:\d{2}/.test(cleanTimeStr) ? cleanTimeStr.slice(0, 5) : '18:00';
      const parsed = new Date(`${cleanDateStr}T${hhmm}:00Z`);
      resolvedStartUtc = !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : new Date().toISOString();
    }
    if (!resolvedStartUtc) {
      resolvedStartUtc = new Date().toISOString();
    }

    const resolvedDateStr = cleanDateStr || resolvedStartUtc.slice(0, 10);
    const resolvedDay =
      String(dayOfWeek || '').trim() ||
      new Date(resolvedStartUtc).toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'UTC',
      });
    const resolvedTime = cleanTimeStr || resolvedStartUtc;

    // Auto-generate Built-In Classroom + Zoom-compatible meeting link
    const rawCode = `${Math.floor(100 + Math.random() * 900)}${Math.floor(
      1000 + Math.random() * 9000
    )}${Math.floor(1000 + Math.random() * 9000)}`;
    const meetingId = `${rawCode.slice(0, 3)} ${rawCode.slice(3, 7)} ${rawCode.slice(7, 11)}`;
    const meetingPasscode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const joinUrl = `/?tab=classroom&room=${rawCode}&pwd=${meetingPasscode}`;
    const hostStartUrl = `/?tab=classroom&room=${rawCode}&host=1`;

    const resolvedInstructorId = String(instructorId || actor.user.id).trim();
    const resolvedInstructorName = String(
      instructorName || `${actor.user.firstName} ${actor.user.lastName}`
    ).trim();

    const cleanCourseId = courseId ? String(courseId).trim() : undefined;
    let resolvedCourseTitle = courseTitle ? String(courseTitle).trim() : undefined;

    if (cleanCourseId) {
      const targetCourse = isCloudSqlConfigured()
        ? await getCourseByIdFromSql(cleanCourseId)
        : db.courses.find(c => c.id === cleanCourseId);
      if (targetCourse) {
        if (!resolvedCourseTitle) resolvedCourseTitle = targetCourse.title;
        const scheduleEntry = {
          id: `sch-${Date.now()}`,
          title: String(title).trim(),
          dateStr: resolvedDateStr,
          dayOfWeek: resolvedDay,
          timeUtc: resolvedStartUtc,
          durationMinutes: 90,
          instructorId: resolvedInstructorId,
          instructorName: resolvedInstructorName,
          zoomMeetingId: meetingId,
          zoomPasscode: meetingPasscode,
          zoomJoinUrl: joinUrl,
          zoomStartUrl: hostStartUrl,
          isLiveNow: false,
          recordingStatus: 'idle' as const,
        };
        if (isCloudSqlConfigured()) {
          await updateCourseInSql(targetCourse.id, {
            schedules: [...(targetCourse.schedules || []), scheduleEntry],
          });
        } else {
          targetCourse.schedules.push(scheduleEntry);
          saveDb(db);
        }
      }
    }

    const newEvent: CalendarEvent = {
      id: id && SAFE_ID_RE.test(String(id)) ? String(id) : `evt-${Date.now()}`,
      title: String(title).trim(),
      description: String(description || '').trim(),
      posterUrl: String(posterUrl || '').trim() || undefined,
      courseId: cleanCourseId,
      courseTitle: resolvedCourseTitle,
      startUtc: resolvedStartUtc,
      endUtc: String(endUtc || resolvedStartUtc),
      dateStr: resolvedDateStr,
      dayOfWeek: resolvedDay,
      timeUtc: resolvedTime,
      instructorId: resolvedInstructorId,
      instructorName: resolvedInstructorName,
      meetingId,
      meetingPasscode,
      joinUrl,
      hostStartUrl,
      isLiveNow: false,
      autoRecord: autoRecord !== false,
      type: (validTypes.has(String(type)) ? type : 'event') as CalendarEvent['type'],
      pinnedToBoard: pinnedToBoard !== false,
      pinColor: (validPinColors.has(String(pinColor)) ? pinColor : 'aqua') as CalendarEvent['pinColor'],
      locationOrLabel: String(locationOrLabel || 'Deen Hijrah Live Classroom').trim(),
      isDerived: false,
    };

    if (isCloudSqlConfigured()) {
      const saved = await createEventInSql(newEvent);
      return res.status(201).json(saved);
    }

    db.calendarEvents.unshift(newEvent);
    saveDb(db);
    res.status(201).json(newEvent);
  } catch (error: any) {
    console.error('Failed to create calendar event:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
});

app.patch('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    const patch: Partial<CalendarEvent> = { ...(req.body || {}) };
    delete (patch as any).id;
    delete (patch as any).isDerived;

    if (isCloudSqlConfigured()) {
      const updated = await updateEventInSql(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: 'Event not found' });
      return res.json(updated);
    }

    const ev = db.calendarEvents.find(e => e.id === req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    Object.assign(ev, patch);
    saveDb(db);
    res.json({ ...ev, isDerived: false });
  } catch (error: any) {
    console.error('Failed to update calendar event:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

app.delete('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const actor = await requireStaffActor(req, res);
    if (!actor) return;

    if (isCloudSqlConfigured()) {
      const deleted = await deleteEventInSql(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Event not found' });
      return res.json({ success: true });
    }

    const beforeLen = db.calendarEvents.length;
    db.calendarEvents = db.calendarEvents.filter(e => e.id !== req.params.id);
    if (db.calendarEvents.length === beforeLen) {
      return res.status(404).json({ error: 'Event not found' });
    }
    saveDb(db);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete calendar event:', error);
    res.status(500).json({ error: error.message || 'Failed to delete event' });
  }
});

// AI Navigation Assistant & Course AI Cluster Manager (Gemini 3.8 Flash)
app.post('/api/ai/navigate', async (req: Request, res: Response) => {
  const { query, userRole, currentPath } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the Deen Hijrah Academia Site Navigation Assistant. 
Platform context:
- Administrator: Mustaqeem
- Current User Role: ${userRole || 'student'}
- Active Page: ${currentPath || '/'}
- Platform Features: Courses Open for Enrollment floating grid, Interactive Animated Syllabus, Student Portal with Zoom Join Attendance, Teacher Assessment Engine (Homework, Pop Quizzes, Standard, Major Projects), WhatsApp-style real-time chats, Community Feed, Master Calendar with timezone conversion.
User question: "${query}"

Provide a concise, welcoming, direct answer guiding them to the exact section, button, or schedule. Avoid verbose disclaimers.`,
      });
      return res.json({ answer: response.text });
    } catch (e: any) {
      console.warn('Gemini navigation query failed, using built-in intelligent navigation:', e?.message);
    }
  }

  // Built-in intelligent fallback
  const q = String(query).toLowerCase();
  let fallbackAnswer = 'Welcome to Deen Hijrah Academia. You can browse all courses on the homepage, access your enrolled subjects in the Student Portal, and view live lectures in the Master Calendar.';
  if (q.includes('zoom') || q.includes('class') || q.includes('live')) {
    fallbackAnswer = 'Live lectures automatically convert to your local timezone. When a class is live, navigate to your Student Portal or Course View and click the "Join Class" button. Your attendance will be automatically logged before launching Zoom.';
  } else if (q.includes('homework') || q.includes('quiz') || q.includes('assignment')) {
    fallbackAnswer = 'You can access all Homework, Pop Quizzes, and Major Projects inside the "Assessments" tab within each course portal. Quizzes are instantly graded with immediate feedback.';
  } else if (q.includes('admin') || q.includes('mustaqeem')) {
    fallbackAnswer = 'Founding Director Mustaqeem Shaikh manages course creation, attendance logs, and community moderation. Sign in with your verified director email to open the workspace.';
  }

  res.json({ answer: fallbackAnswer });
});

app.post('/api/ai/tutor', async (req: Request, res: Response) => {
  const { courseTitle, moduleContext, query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the specialized AI Course Tutor for Deen Hijrah Academia for the course "${courseTitle}".
Course Context & Syllabus Modules:
${JSON.stringify(moduleContext || 'Classical scholastic curriculum')}

Student question: "${query}"

Respond with deep academic clarity, respectful Islamic etiquette (e.g. including honoring phrases like ﷺ where appropriate), precision, and pedagogical encouragement. Keep response structured and easy to read.`,
      });
      return res.json({ answer: response.text });
    } catch (e: any) {
      console.warn('Gemini AI tutor query failed, using built-in fallback:', e?.message);
    }
  }

  res.json({
    answer: `Regarding your inquiry on "${courseTitle}": In traditional scholarship, understanding this concept requires examining its linguistic roots, classical commentaries, and ethical applications. Review Module 1 and Module 2 notes for the foundational principles, or ask during the upcoming Saturday live cohort Q&A.`
  });
});

// Ensure unknown /api/* routes always return JSON instead of SPA HTML/text
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Setup Vite dev middleware or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.ENABLE_HMR === 'true',
          watch: process.env.ENABLE_HMR === 'true' ? {} : null,
        },
        appType: 'spa',
      })
    );

    vitePromise.catch((err) => {
      console.error('Vite middleware initialization failed:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Deen Hijrah Academia server listening on http://localhost:${PORT}`);
  });
}

startServer();
