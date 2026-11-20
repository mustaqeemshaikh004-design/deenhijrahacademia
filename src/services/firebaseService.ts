import {
  doc,
  collection,
  query,
  where,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getBlob,
  deleteObject,
} from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  db,
  auth,
  storage,
  getFirebaseIdToken,
  handleFirestoreError,
  OperationType,
  type FirestoreErrorInfo,
} from '../firebase';
import type {
  User,
  Course,
  CompletedVideoArchive,
  PlatformSettings,
  CalendarEvent,
  BlogPost,
  CommunityPost,
  PostComment,
  ChatMessage,
  CustomNavItem,
  CourseReview,
  InstructorReview,
} from '../types';

export const CHANCELLOR_EMAIL = 'mustaqeemshaikh004@gmail.com';

// Synchronized verbatim with firebase-blueprint.json schema boundaries
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  ID_MAX_LEN: 128,
  FIRST_NAME_MAX_LEN: 100,
  LAST_NAME_MAX_LEN: 100,
  EMAIL_MAX_LEN: 254,
  CODE_MAX_LEN: 32,
  TITLE_MAX_LEN: 200,
  DESCRIPTION_MAX_LEN: 3000,
  INSTRUCTOR_NAME_MAX_LEN: 120,
  URL_MAX_LEN: 2048,
  STORAGE_PATH_MAX_LEN: 512,
  META_STRING_MAX_LEN: 120,
  HEADLINE_MAX_LEN: 200,
  SUBHEADLINE_MAX_LEN: 1000,
  MAX_AVATAR_BYTES: 5 * 1024 * 1024,
  MAX_THUMBNAIL_BYTES: 10 * 1024 * 1024,
  MAX_VIDEO_BYTES: 500 * 1024 * 1024,
  MAX_BRANDING_VIDEO_BYTES: 250 * 1024 * 1024,
} as const;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, BLUEPRINT_LIMITS.ID_MAX_LEN);
  return cleaned || `id-${Date.now()}`;
}

export function assertValidBlueprintId(id: string, fieldName: string): string {
  if (!id || id.length > BLUEPRINT_LIMITS.ID_MAX_LEN || !BLUEPRINT_LIMITS.ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid ${fieldName}: must match ^[a-zA-Z0-9_\\-]+$ with length 1..${BLUEPRINT_LIMITS.ID_MAX_LEN}.`
    );
  }
  return id;
}

function clampString(value: string | undefined | null, maxLen: number, fallback = ''): string {
  const primary = (value ?? '').trim();
  const normalized = primary || fallback.trim();
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}

export const QUOTA_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';
export const QUOTA_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

export interface ParsedFirestoreError {
  userMessage: string;
  isQuotaExceeded: boolean;
  isDailyFreeReadQuota: boolean;
  firestoreInfo: FirestoreErrorInfo | null;
}

export function parseFirestoreError(err: unknown): ParsedFirestoreError {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown database error.');
  let firestoreInfo: FirestoreErrorInfo | null = null;
  let coreMessage = raw;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as FirestoreErrorInfo;
      if (parsed && typeof parsed.error === 'string' && 'operationType' in parsed) {
        firestoreInfo = parsed;
        coreMessage = parsed.error;
      }
    } catch {
      // Not a JSON FirestoreErrorInfo payload
    }
  }

  const lower = coreMessage.toLowerCase();
  const isDailyFreeReadQuota = lower.includes('free daily read units per project');
  const isQuotaExceeded =
    isDailyFreeReadQuota ||
    lower.includes('quota exceeded') ||
    lower.includes('resource-exhausted');

  let userMessage = coreMessage;
  if (isDailyFreeReadQuota) {
    userMessage =
      'Cloud Firestore free daily read quota has been exceeded. Quota resets automatically tomorrow, or you can upgrade your Firestore database in the Firebase Console.';
  } else if (isQuotaExceeded) {
    userMessage =
      'Cloud Firestore usage quota exceeded. Quota resets the next day; review Spark plan quotas under the Enterprise edition on Firebase Pricing or upgrade in Console.';
  } else if (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied')
  ) {
    const targetPath = firestoreInfo?.path ? ` (${firestoreInfo.path})` : '';
    userMessage = `Access permission declined for Firestore resource${targetPath}. Ensure you are signed in with a verified account authorized for this action.`;
  }

  return {
    userMessage,
    isQuotaExceeded,
    isDailyFreeReadQuota,
    firestoreInfo,
  };
}

export function formatFirebaseAuthError(
  err: unknown,
  fallback = 'Authentication failed. Please try again.'
): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before finishing. Click the button to try again.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and retry.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in popup was already opened. Complete that window or retry.';
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return host
        ? `Domain "${host}" is not yet in Firebase Auth Authorized Domains for project ${firebaseConfig.projectId}.`
        : 'This domain is not authorized for Firebase Google sign-in yet. Check your Firebase Auth authorized domains.';
    }
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is currently disabled in Firebase Authentication settings. Use Google Sign-In or enable Email/Password in Firebase Console.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured yet for this project. Please verify Firebase Auth setup.';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting Google authentication. Check your internet and retry.';
    case 'auth/too-many-requests':
      return 'Too many authentication attempts in a short window. Wait a moment before retrying.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in provider.';
    case 'auth/user-disabled':
      return 'This Firebase account has been disabled by an administrator.';
    default: {
      const parsed = parseFirestoreError(err);
      return parsed.userMessage || fallback;
    }
  }
}

export function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    const maybeTs = val as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      try {
        return maybeTs.toDate().toISOString();
      } catch {
        // Fallback below
      }
    }
    if (typeof maybeTs.seconds === 'number') {
      return new Date(maybeTs.seconds * 1000).toISOString();
    }
  }
  return new Date().toISOString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, '');
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export const SESSION_STORAGE_KEY = 'dha_session_token';
export const CACHED_USER_KEY = 'dha_cached_user';

export function getStoredSessionToken(): string {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredSessionToken(token: string | null | undefined): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

export function getStoredCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredCachedUser(user: User | null | undefined): void {
  try {
    if (user) {
      const safeSnapshot: User = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        avatarStoragePath: user.avatarStoragePath,
        timezone: user.timezone,
        preferredTheme: user.preferredTheme,
        readNotificationIds: Array.isArray(user.readNotificationIds)
          ? user.readNotificationIds.slice(-100)
          : undefined,
        hasCustomPassword: user.hasCustomPassword,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
      };
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(safeSnapshot));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

export function getSessionHeadersSync(): Record<string, string> {
  const token = getStoredSessionToken();
  return token ? { 'x-session-token': token, 'x-admin-session': token } : {};
}

export async function getAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...getSessionHeadersSync(),
    ...extra,
  };
  const idToken = await getFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

export function isFirebaseChancellorSignedIn(): boolean {
  return Boolean(
    auth.currentUser &&
      auth.currentUser.emailVerified &&
      auth.currentUser.email?.toLowerCase() === CHANCELLOR_EMAIL
  );
}

export interface ParsedApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  isJson: boolean;
  errorMessage: string;
}

export async function parseApiJsonResponse<T = Record<string, unknown>>(
  res: Response,
  fallbackError = 'Unable to reach the academy server.'
): Promise<ParsedApiResponse<T>> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      isJson: false,
      errorMessage: fallbackError,
    };
  }

  const trimmed = rawText.trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const looksLikeJson =
    trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('application/json');

  if (trimmed && looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed) as T & { error?: string; message?: string };
      const errMsg =
        typeof parsed?.error === 'string' && parsed.error
          ? parsed.error
          : typeof parsed?.message === 'string' && !res.ok
          ? parsed.message
          : res.ok
          ? ''
          : `${fallbackError} (HTTP ${res.status})`;
      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
        isJson: true,
        errorMessage: errMsg,
      };
    } catch {
      // Fall through to non-JSON handling
    }
  }

  const isHtmlOrNotFound =
    res.status === 404 ||
    trimmed.toLowerCase().startsWith('<!doctype') ||
    trimmed.toLowerCase().startsWith('<html') ||
    trimmed.toLowerCase().includes('page could not be found');

  return {
    ok: false,
    status: res.status,
    data: null,
    isJson: false,
    errorMessage: isHtmlOrNotFound
      ? 'The backend service route is currently unavailable on this host. You can still sign in directly with Google (Firebase) below.'
      : fallbackError,
  };
}

export function buildVerifiedUserFromFirebase(
  fbUser: FirebaseUser,
  preferredRole?: 'student' | 'teacher'
): User {
  const email = (fbUser.email || '').trim().toLowerCase();
  const isChancellor = Boolean(fbUser.emailVerified && email === CHANCELLOR_EMAIL);
  const cached = getStoredCachedUser();
  const cachedSameUser =
    cached &&
    (cached.id === fbUser.uid || (email && cached.email?.toLowerCase() === email))
      ? cached
      : null;

  const displayName = (fbUser.displayName || 'Scholar User').trim();
  const parts = displayName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || cachedSameUser?.firstName || 'Scholar';
  const lastName = parts.slice(1).join(' ') || cachedSameUser?.lastName || 'User';

  const role: User['role'] = isChancellor
    ? 'admin'
    : preferredRole === 'teacher'
    ? 'teacher'
    : cachedSameUser?.role && cachedSameUser.role !== 'admin'
    ? cachedSameUser.role
    : 'student';

  return {
    id: fbUser.uid,
    firstName,
    lastName,
    email: email || `${fbUser.uid}@deenhijrahacademia.edu`,
    role,
    gender: cachedSameUser?.gender === 'female' ? 'female' : 'male',
    avatarUrl: fbUser.photoURL || cachedSameUser?.avatarUrl,
    avatarStoragePath: cachedSameUser?.avatarStoragePath,
    timezone: cachedSameUser?.timezone,
    preferredTheme: cachedSameUser?.preferredTheme,
    readNotificationIds: cachedSameUser?.readNotificationIds,
    createdAt: cachedSameUser?.createdAt || new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
}

// ==================== FIRESTORE USER & ROLE SYNC ====================

const inFlightProfileSyncs = new Map<string, Promise<void>>();

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const targetUid = fbUser.uid;
  assertValidBlueprintId(targetUid, 'userId');

  const existingPromise = inFlightProfileSyncs.get(targetUid);
  if (existingPromise) {
    return existingPromise;
  }

  const runSync = (async () => {
    const email = clampString(fbUser.email || user.email, BLUEPRINT_LIMITS.EMAIL_MAX_LEN);
    const firstName = clampString(user.firstName, BLUEPRINT_LIMITS.FIRST_NAME_MAX_LEN, 'Scholar');
    const lastName = clampString(user.lastName, BLUEPRINT_LIMITS.LAST_NAME_MAX_LEN, 'User');
    const gender = user.gender === 'female' ? 'female' : 'male';
    const isChancellor = email.toLowerCase() === CHANCELLOR_EMAIL;

    // Bootstrap admin doc if Chancellor Mustaqeem is authenticated
    if (isChancellor) {
      const adminPath = `admins/${targetUid}`;
      try {
        const adminRef = doc(db, 'admins', targetUid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: targetUid,
            email: email.toLowerCase(),
            role: 'admin',
            grantedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, adminPath);
      }
    }

    const rootPath = `users/${targetUid}`;
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const ts = serverTimestamp();
      if (!snap.exists()) {
        await setDoc(userRef, {
          id: targetUid,
          role: isChancellor ? 'admin' : 'student',
          createdAt: ts,
          updatedAt: ts,
        });
      } else if (isChancellor && snap.data()?.role !== 'admin') {
        await updateDoc(userRef, { role: 'admin', updatedAt: ts });
      } else {
        await updateDoc(userRef, { updatedAt: ts });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, rootPath);
    }

    const publicPath = `users/${targetUid}/public/profile`;
    try {
      const publicRef = doc(db, 'users', targetUid, 'public', 'profile');
      const pubSnap = await getDoc(publicRef);
      const ts = serverTimestamp();
      const avatarUrl = clampString(user.avatarUrl, BLUEPRINT_LIMITS.URL_MAX_LEN);
      const avatarStoragePath = clampString(
        user.avatarStoragePath,
        BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN
      );
      const validStoragePath =
        avatarStoragePath && avatarStoragePath.startsWith(`avatars/${targetUid}/`)
          ? avatarStoragePath
          : '';

      if (!pubSnap.exists()) {
        await setDoc(publicRef, {
          id: targetUid,
          firstName,
          lastName,
          gender,
          avatarUrl,
          avatarStoragePath: validStoragePath,
          visibility: 'public',
          createdAt: ts,
          updatedAt: ts,
        });
      } else {
        await updateDoc(publicRef, {
          firstName,
          lastName,
          gender,
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(validStoragePath ? { avatarStoragePath: validStoragePath } : {}),
          updatedAt: ts,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, publicPath);
    }

    const privatePath = `users/${targetUid}/private/info`;
    try {
      const privateRef = doc(db, 'users', targetUid, 'private', 'info');
      const privSnap = await getDoc(privateRef);
      const ts = serverTimestamp();
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          id: targetUid,
          email,
          createdAt: ts,
          updatedAt: ts,
        });
      } else {
        await updateDoc(privateRef, { updatedAt: ts });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  })();

  inFlightProfileSyncs.set(targetUid, runSync);
  try {
    await runSync;
  } finally {
    if (inFlightProfileSyncs.get(targetUid) === runSync) {
      inFlightProfileSyncs.delete(targetUid);
    }
  }
}

export async function saveUserThemePreferenceToFirestore(
  theme: 'dark' | 'light'
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const targetUid = assertValidBlueprintId(fbUser.uid, 'userId');
  const safeTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const isChancellor = (fbUser.email || '').trim().toLowerCase() === CHANCELLOR_EMAIL;

  // Master Gate: guarantee root /users/{userId} document exists before writing subcollection
  const rootPath = `users/${targetUid}`;
  try {
    const userRef = doc(db, 'users', targetUid);
    const rootSnap = await getDoc(userRef);
    if (!rootSnap.exists()) {
      const ts = serverTimestamp();
      await setDoc(userRef, {
        id: targetUid,
        role: isChancellor ? 'admin' : 'student',
        createdAt: ts,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, rootPath);
  }

  const prefPath = `users/${targetUid}/preferences/ui`;
  try {
    const prefRef = doc(db, 'users', targetUid, 'preferences', 'ui');
    const prefSnap = await getDoc(prefRef);
    const ts = serverTimestamp();
    if (!prefSnap.exists()) {
      await setDoc(prefRef, {
        id: 'ui',
        userId: targetUid,
        theme: safeTheme,
        createdAt: ts,
        updatedAt: ts,
      });
    } else {
      await updateDoc(prefRef, {
        theme: safeTheme,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, prefPath);
  }
}

export async function getUserThemePreferenceFromFirestore(
  uid: string
): Promise<'dark' | 'light' | null> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified || fbUser.uid !== uid) return null;

  const safeUid = assertValidBlueprintId(uid, 'userId');
  const prefPath = `users/${safeUid}/preferences/ui`;
  try {
    const snap = await getDoc(doc(db, 'users', safeUid, 'preferences', 'ui'));
    if (!snap.exists()) return null;
    const rawTheme = snap.data()?.theme;
    return rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, prefPath);
  }
}

export async function saveUserThemePreferenceToServer(
  userId: string,
  theme: 'dark' | 'light',
  email?: string
): Promise<User | null> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/theme`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        theme: theme === 'light' ? 'light' : 'dark',
        ...(email ? { email } : {}),
      }),
    });
    if (!res.ok) return null;
    const updated = (await res.json()) as User;
    return updated;
  } catch {
    return null;
  }
}

export function sanitizeReadNotificationIds(rawIds: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of rawIds) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, 256);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
  }
  return clean.slice(-100);
}

export async function saveReadNotificationsToFirestore(
  readIds: string[],
  fallbackTheme: 'dark' | 'light' = 'dark'
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const targetUid = assertValidBlueprintId(fbUser.uid, 'userId');
  const safeIds = sanitizeReadNotificationIds(readIds);
  const safeTheme: 'dark' | 'light' = fallbackTheme === 'light' ? 'light' : 'dark';
  const isChancellor = (fbUser.email || '').trim().toLowerCase() === CHANCELLOR_EMAIL;

  // Master Gate: guarantee root /users/{userId} document exists before writing subcollection
  const rootPath = `users/${targetUid}`;
  try {
    const userRef = doc(db, 'users', targetUid);
    const rootSnap = await getDoc(userRef);
    if (!rootSnap.exists()) {
      const ts = serverTimestamp();
      await setDoc(userRef, {
        id: targetUid,
        role: isChancellor ? 'admin' : 'student',
        createdAt: ts,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, rootPath);
  }

  const prefPath = `users/${targetUid}/preferences/ui`;
  try {
    const prefRef = doc(db, 'users', targetUid, 'preferences', 'ui');
    const prefSnap = await getDoc(prefRef);
    const ts = serverTimestamp();
    if (!prefSnap.exists()) {
      await setDoc(prefRef, {
        id: 'ui',
        userId: targetUid,
        theme: safeTheme,
        readNotificationIds: safeIds,
        createdAt: ts,
        updatedAt: ts,
      });
    } else {
      await updateDoc(prefRef, {
        readNotificationIds: safeIds,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, prefPath);
  }
}

export async function saveReadNotificationsToServer(
  userId: string,
  readIds: string[],
  email?: string
): Promise<User | null> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const safeIds = sanitizeReadNotificationIds(readIds);
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/notifications/read`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        readNotificationIds: safeIds,
        ...(email ? { email } : {}),
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as User;
  } catch {
    return null;
  }
}

// ==================== FIREBASE STORAGE UPLOADS ====================

export async function uploadProfileAvatarToStorage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ avatarUrl: string; avatarStoragePath: string; firebaseUid: string }> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    throw new Error('GOOGLE_AUTH_REQUIRED');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG, or WebP profile images are permitted.');
  }
  if (file.size <= 0 || file.size > BLUEPRINT_LIMITS.MAX_AVATAR_BYTES) {
    throw new Error('Profile photo must be between 1 byte and 5 MB.');
  }

  const uid = assertValidBlueprintId(fbUser.uid, 'userId');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const avatarStoragePath = `avatars/${uid}/profile_${Date.now()}_${generateSecureToken().slice(0, 8)}.${ext}`;
  const storageRef = ref(storage, avatarStoragePath);

  await new Promise<void>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=3600',
      customMetadata: {
        userId: uid,
        visibility: 'public',
      },
    });

    uploadTask.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const avatarUrl = await getDownloadURL(storageRef);

  // Sync updated Storage URL/path into Firestore public profile
  const publicPath = `users/${uid}/public/profile`;
  try {
    const publicRef = doc(db, 'users', uid, 'public', 'profile');
    const pubSnap = await getDoc(publicRef);
    const ts = serverTimestamp();
    const displayParts = (fbUser.displayName || 'Scholar User').split(' ');
    const firstName = clampString(displayParts[0], BLUEPRINT_LIMITS.FIRST_NAME_MAX_LEN, 'Scholar');
    const lastName = clampString(
      displayParts.slice(1).join(' ') || 'User',
      BLUEPRINT_LIMITS.LAST_NAME_MAX_LEN,
      'User'
    );

    if (pubSnap.exists()) {
      await updateDoc(publicRef, {
        avatarUrl: clampString(avatarUrl, BLUEPRINT_LIMITS.URL_MAX_LEN),
        avatarStoragePath: clampString(avatarStoragePath, BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN),
        updatedAt: ts,
      });
    } else {
      await setDoc(publicRef, {
        id: uid,
        firstName,
        lastName,
        gender: 'male',
        avatarUrl: clampString(avatarUrl, BLUEPRINT_LIMITS.URL_MAX_LEN),
        avatarStoragePath: clampString(avatarStoragePath, BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN),
        visibility: 'public',
        createdAt: ts,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  return { avatarUrl, avatarStoragePath, firebaseUid: uid };
}

export async function uploadCourseRecordingToStorage(
  courseId: string,
  recordingId: string,
  file: File,
  isOrientation: boolean,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; fileSize: string }> {
  if (!isFirebaseChancellorSignedIn()) {
    throw new Error('CHANCELLOR_GOOGLE_AUTH_REQUIRED');
  }

  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const safeRecId = assertValidBlueprintId(recordingId, 'recordingId');

  const isMp4 =
    file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  if (!isMp4) {
    throw new Error('Course recordings must strictly be in .mp4 format (video/mp4).');
  }
  if (file.size <= 0 || file.size > BLUEPRINT_LIMITS.MAX_VIDEO_BYTES) {
    throw new Error('MP4 recording must be between 1 byte and 500 MB.');
  }

  // Unguessable path inside protected Firebase Storage bucket (no public getDownloadURL called!)
  const storagePath = `courses/${safeCourseId}/recordings/${safeRecId}_${generateSecureToken()}.mp4`;
  if (storagePath.length > BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN) {
    throw new Error('Generated Storage path exceeds maximum allowed length.');
  }

  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: 'video/mp4',
      contentDisposition: 'inline',
      cacheControl: 'private, no-store',
      customMetadata: {
        courseId: safeCourseId,
        recordingId: safeRecId,
        isOrientation: isOrientation ? 'true' : 'false',
        nonDownloadable: 'true',
        nonShareable: 'true',
      },
    });

    uploadTask.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  return {
    storagePath,
    fileSize: formatFileSize(file.size),
  };
}

export async function uploadRecordingThumbnailToStorage(
  courseId: string,
  recordingId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ thumbnailUrl: string; thumbnailStoragePath: string }> {
  if (!isFirebaseChancellorSignedIn()) {
    throw new Error('CHANCELLOR_GOOGLE_AUTH_REQUIRED');
  }

  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const safeRecId = assertValidBlueprintId(recordingId, 'recordingId');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Thumbnail must be JPG, PNG, WebP, or SVG.');
  }
  if (file.size <= 0 || file.size > BLUEPRINT_LIMITS.MAX_THUMBNAIL_BYTES) {
    throw new Error('Thumbnail must be under 10 MB.');
  }

  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
      ? 'webp'
      : file.type === 'image/svg+xml'
      ? 'svg'
      : 'jpg';
  const thumbnailStoragePath = `courses/${safeCourseId}/thumbnails/${safeRecId}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, thumbnailStoragePath);

  await new Promise<void>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=86400',
      customMetadata: {
        courseId: safeCourseId,
        visibility: 'public',
      },
    });

    uploadTask.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const thumbnailUrl = await getDownloadURL(storageRef);
  return { thumbnailUrl, thumbnailStoragePath };
}

export async function uploadBrandingAssetToStorage(
  assetKind: 'hero_video' | 'hero_poster' | 'hero_image' | 'custom_logo',
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; storagePath: string }> {
  if (!isFirebaseChancellorSignedIn()) {
    throw new Error('CHANCELLOR_GOOGLE_AUTH_REQUIRED');
  }

  if (assetKind === 'hero_video') {
    const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
    if (!isMp4) throw new Error('Hero background video must be an .mp4 file.');
    if (file.size <= 0 || file.size > BLUEPRINT_LIMITS.MAX_BRANDING_VIDEO_BYTES) {
      throw new Error('Hero video must be under 250 MB.');
    }
  } else {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedImages.includes(file.type)) {
      throw new Error('Asset must be JPG, PNG, WebP, or SVG.');
    }
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
      throw new Error('Image asset must be under 15 MB.');
    }
  }

  const ext =
    assetKind === 'hero_video'
      ? 'mp4'
      : file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
      ? 'webp'
      : file.type === 'image/svg+xml'
      ? 'svg'
      : 'jpg';
  const storagePath = `branding/${assetKind}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: assetKind === 'hero_video' ? 'video/mp4' : file.type,
      cacheControl: 'public,max-age=86400',
      customMetadata: {
        assetKind,
        visibility: 'public',
      },
    });

    uploadTask.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, storagePath };
}

// ==================== FIRESTORE COURSE, ENROLLMENT & STREAMING SYNC ====================

export async function syncCourseToFirestore(course: Course): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;

  const safeCourseId = assertValidBlueprintId(course.id, 'courseId');
  const coursePath = `courses/${safeCourseId}`;

  try {
    const courseRef = doc(db, 'courses', safeCourseId);
    const snap = await getDoc(courseRef);
    const ts = serverTimestamp();

    const payload = {
      id: safeCourseId,
      code: clampString(course.code, BLUEPRINT_LIMITS.CODE_MAX_LEN, 'DHA-101'),
      title: clampString(course.title, BLUEPRINT_LIMITS.TITLE_MAX_LEN, 'Untitled Course'),
      description: clampString(
        course.description,
        BLUEPRINT_LIMITS.DESCRIPTION_MAX_LEN,
        'Deen Hijrah Academia Curriculum'
      ),
      instructorId: sanitizeId(course.instructorId || 'admin-mustaqeem'),
      instructorName: clampString(
        course.instructorName,
        BLUEPRINT_LIMITS.INSTRUCTOR_NAME_MAX_LEN,
        'Mustaqeem Shaikh'
      ),
      status: course.status,
      level: course.level,
      thumbnail: clampString(course.thumbnail, BLUEPRINT_LIMITS.URL_MAX_LEN),
      totalLectures: Math.min(1000, Math.max(0, Number(course.totalLectures) || 0)),
      isPublished: true,
      updatedAt: ts,
    };

    if (!snap.exists()) {
      await setDoc(courseRef, { ...payload, createdAt: ts });
    } else {
      const { id: _id, ...updatable } = payload;
      await updateDoc(courseRef, updatable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, coursePath);
  }

  // Sync video archives into guarded recordingCatalog and recordings subcollections
  for (const rec of course.videoArchives || []) {
    await saveRecordingToFirestore(safeCourseId, rec, true);
  }
}

export async function deleteCourseFromFirestore(courseId: string): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;
  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const coursePath = `courses/${safeCourseId}`;
  try {
    await deleteDoc(doc(db, 'courses', safeCourseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, coursePath);
  }
}

export async function saveRecordingToFirestore(
  courseId: string,
  recording: CompletedVideoArchive,
  skipParentCheck = false
): Promise<void> {
  if (!isFirebaseChancellorSignedIn() || !auth.currentUser) return;

  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const safeRecId = assertValidBlueprintId(recording.id, 'recordingId');

  if (!skipParentCheck) {
    const parentPath = `courses/${safeCourseId}`;
    try {
      const parentSnap = await getDoc(doc(db, 'courses', safeCourseId));
      if (!parentSnap.exists()) {
        throw new Error(`Parent course ${safeCourseId} must exist in Firestore first.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, parentPath);
    }
  }

  const catalogPath = `courses/${safeCourseId}/recordingCatalog/${safeRecId}`;
  const recPath = `courses/${safeCourseId}/recordings/${safeRecId}`;
  const ts = serverTimestamp();

  const title = clampString(recording.title, BLUEPRINT_LIMITS.TITLE_MAX_LEN, 'Lecture Recording');
  const duration = clampString(recording.duration, BLUEPRINT_LIMITS.META_STRING_MAX_LEN, '45 min');
  const thumbnailUrl = clampString(recording.thumbnailUrl, BLUEPRINT_LIMITS.URL_MAX_LEN);
  const fileSize = clampString(recording.fileSize, BLUEPRINT_LIMITS.META_STRING_MAX_LEN, '150 MB');
  const recordedAt = clampString(
    recording.recordedAt || new Date().toISOString(),
    BLUEPRINT_LIMITS.META_STRING_MAX_LEN
  );
  const isOrientation = Boolean(recording.isOrientation);
  const teaserUrl = recording.teaserUrl ? clampString(recording.teaserUrl, BLUEPRINT_LIMITS.URL_MAX_LEN) : undefined;
  const teaserStoragePath = recording.teaserStoragePath ? clampString(recording.teaserStoragePath, BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN) : undefined;
  const supplementaryPdfUrl = recording.supplementaryPdfUrl
    ? clampString(recording.supplementaryPdfUrl, BLUEPRINT_LIMITS.URL_MAX_LEN)
    : undefined;
  const supplementaryPdfName = recording.supplementaryPdfName
    ? clampString(recording.supplementaryPdfName, BLUEPRINT_LIMITS.TITLE_MAX_LEN)
    : undefined;
  const supplementaryPdfStoragePath = recording.supplementaryPdfStoragePath
    ? clampString(recording.supplementaryPdfStoragePath, BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN)
    : undefined;

  try {
    const catRef = doc(db, 'courses', safeCourseId, 'recordingCatalog', safeRecId);
    const catSnap = await getDoc(catRef);
    const catData: Record<string, unknown> = {
      id: safeRecId,
      courseId: safeCourseId,
      title,
      duration,
      thumbnailUrl,
      isOrientation,
      mimeType: 'video/mp4',
      fileSize,
      recordedAt,
    };
    if (isOrientation) {
      if (teaserUrl) catData.teaserUrl = teaserUrl;
      if (teaserStoragePath) catData.teaserStoragePath = teaserStoragePath;
      if (supplementaryPdfUrl) catData.supplementaryPdfUrl = supplementaryPdfUrl;
      if (supplementaryPdfName) catData.supplementaryPdfName = supplementaryPdfName;
      if (supplementaryPdfStoragePath) catData.supplementaryPdfStoragePath = supplementaryPdfStoragePath;
    } else if (supplementaryPdfName) {
      catData.supplementaryPdfName = supplementaryPdfName;
    }

    if (!catSnap.exists()) {
      await setDoc(catRef, {
        ...catData,
        createdAt: ts,
        updatedAt: ts,
      });
    } else {
      await updateDoc(catRef, {
        title,
        duration,
        thumbnailUrl,
        ...(isOrientation && teaserUrl ? { teaserUrl } : {}),
        ...(isOrientation && teaserStoragePath ? { teaserStoragePath } : {}),
        ...(isOrientation && supplementaryPdfUrl ? { supplementaryPdfUrl } : {}),
        ...(supplementaryPdfName ? { supplementaryPdfName } : {}),
        ...(isOrientation && supplementaryPdfStoragePath ? { supplementaryPdfStoragePath } : {}),
        isOrientation,
        mimeType: 'video/mp4',
        fileSize,
        recordedAt,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, catalogPath);
  }

  try {
    const recRef = doc(db, 'courses', safeCourseId, 'recordings', safeRecId);
    const recSnap = await getDoc(recRef);
    const storagePath = clampString(recording.storagePath, BLUEPRINT_LIMITS.STORAGE_PATH_MAX_LEN);
    const videoUrl = clampString(recording.videoUrl, BLUEPRINT_LIMITS.URL_MAX_LEN);

    const recData: Record<string, unknown> = {
      id: safeRecId,
      courseId: safeCourseId,
      title,
      duration,
      thumbnailUrl,
      storagePath,
      videoUrl,
      mimeType: 'video/mp4',
      nonDownloadable: true,
      nonShareable: true,
      isOrientation,
      uploadedBy: auth.currentUser.uid,
      syncedFromZoomWebhook: Boolean(recording.syncedFromZoomWebhook),
      fileSize,
      recordedAt,
    };
    if (teaserUrl) recData.teaserUrl = teaserUrl;
    if (teaserStoragePath) recData.teaserStoragePath = teaserStoragePath;
    if (supplementaryPdfUrl) recData.supplementaryPdfUrl = supplementaryPdfUrl;
    if (supplementaryPdfName) recData.supplementaryPdfName = supplementaryPdfName;
    if (supplementaryPdfStoragePath) recData.supplementaryPdfStoragePath = supplementaryPdfStoragePath;

    if (!recSnap.exists()) {
      await setDoc(recRef, {
        ...recData,
        createdAt: ts,
        updatedAt: ts,
      });
    } else {
      await updateDoc(recRef, {
        title,
        duration,
        thumbnailUrl,
        storagePath,
        videoUrl,
        ...(teaserUrl ? { teaserUrl } : {}),
        ...(teaserStoragePath ? { teaserStoragePath } : {}),
        ...(supplementaryPdfUrl ? { supplementaryPdfUrl } : {}),
        ...(supplementaryPdfName ? { supplementaryPdfName } : {}),
        ...(supplementaryPdfStoragePath ? { supplementaryPdfStoragePath } : {}),
        mimeType: 'video/mp4',
        nonDownloadable: true,
        nonShareable: true,
        isOrientation,
        syncedFromZoomWebhook: Boolean(recording.syncedFromZoomWebhook),
        fileSize,
        recordedAt,
        updatedAt: ts,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, recPath);
  }
}

export async function deleteRecordingFromFirestore(
  courseId: string,
  recordingId: string,
  storagePath?: string
): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;

  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const safeRecId = assertValidBlueprintId(recordingId, 'recordingId');

  try {
    await deleteDoc(doc(db, 'courses', safeCourseId, 'recordingCatalog', safeRecId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `courses/${safeCourseId}/recordingCatalog/${safeRecId}`
    );
  }

  try {
    await deleteDoc(doc(db, 'courses', safeCourseId, 'recordings', safeRecId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `courses/${safeCourseId}/recordings/${safeRecId}`
    );
  }

  if (storagePath && storagePath.startsWith(`courses/${safeCourseId}/recordings/`)) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Ignore missing bucket object on cleanup
    }
  }
}

export async function enrollStudentInFirestore(course: Course): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safeCourseId = assertValidBlueprintId(course.id, 'courseId');
  const uid = assertValidBlueprintId(fbUser.uid, 'userId');
  const enrollmentPath = `courses/${safeCourseId}/enrollments/${uid}`;

  // Ensure course exists in Firestore if the current user happens to be Chancellor
  try {
    const courseSnap = await getDoc(doc(db, 'courses', safeCourseId));
    if (!courseSnap.exists()) {
      if (isFirebaseChancellorSignedIn()) {
        await syncCourseToFirestore(course);
      } else {
        // Course isn't synced in Firestore yet
        return;
      }
    }
  } catch {
    return;
  }

  try {
    const enrollRef = doc(db, 'courses', safeCourseId, 'enrollments', uid);
    const snap = await getDoc(enrollRef);
    const ts = serverTimestamp();

    if (!snap.exists()) {
      await setDoc(enrollRef, {
        userId: uid,
        courseId: safeCourseId,
        status: 'active',
        enrolledAt: ts,
        updatedAt: ts,
      });
    } else if (snap.data()?.status === 'active') {
      await updateDoc(enrollRef, { updatedAt: ts });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, enrollmentPath);
  }
}

function sanitizeVideoSource(url: string | undefined | null): string {
  const clean = clampString(url, BLUEPRINT_LIMITS.URL_MAX_LEN);
  if (
    !clean ||
    clean.includes('assets.mixkit.co') ||
    clean.includes('commondatastorage.googleapis.com/gtv-videos-bucket/sample')
  ) {
    return '';
  }
  return clean;
}

export async function syncSettingsToFirestore(settings: PlatformSettings): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;
  const settingsPath = 'settings/platform';

  try {
    const settingsRef = doc(db, 'settings', 'platform');
    const snap = await getDoc(settingsRef);
    const clampedNavItems: CustomNavItem[] = Array.isArray(settings.customNavItems)
      ? settings.customNavItems.slice(0, 20).map((item, idx) => ({
          id: sanitizeId(item.id || `nav-${idx + 1}`),
          label: clampString(item.label, 60, 'Link'),
          key: clampString(item.key, 60, `tab-${idx + 1}`).toLowerCase(),
          isSystem: Boolean(item.isSystem),
        }))
      : [];

    const payload = {
      heroMode: settings.heroMode === 'image' ? 'image' : 'video',
      heroVideoUrl: sanitizeVideoSource(settings.heroVideoUrl),
      heroPosterUrl: clampString(settings.heroPosterUrl, BLUEPRINT_LIMITS.URL_MAX_LEN),
      heroImageUrl: clampString(settings.heroImageUrl, BLUEPRINT_LIMITS.URL_MAX_LEN),
      heroHeadline: clampString(
        settings.heroHeadline,
        BLUEPRINT_LIMITS.HEADLINE_MAX_LEN,
        'Deen Hijrah Academia'
      ),
      heroSubheadline: clampString(
        settings.heroSubheadline,
        BLUEPRINT_LIMITS.SUBHEADLINE_MAX_LEN,
        'Classical Scholarship'
      ),
      customLogoUrl: clampString(settings.customLogoUrl, BLUEPRINT_LIMITS.URL_MAX_LEN),
      customNavItems: clampedNavItems,
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      await setDoc(settingsRef, payload);
    } else {
      await updateDoc(settingsRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, settingsPath);
  }
}

const VALID_EVENT_TYPES = new Set([
  'lecture',
  'quiz',
  'homework',
  'project',
  'academic_date',
  'event',
]);
const VALID_PIN_COLORS = new Set(['aqua', 'emerald', 'crimson', 'amber']);

export async function syncEventToFirestore(event: CalendarEvent): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;
  const safeId = assertValidBlueprintId(event.id, 'eventId');
  const eventPath = `events/${safeId}`;

  try {
    const evRef = doc(db, 'events', safeId);
    const snap = await getDoc(evRef);
    const ts = serverTimestamp();

    const safeType = VALID_EVENT_TYPES.has(String(event.type))
      ? (event.type as CalendarEvent['type'])
      : 'event';
    const safePinColor = VALID_PIN_COLORS.has(String(event.pinColor))
      ? (event.pinColor as NonNullable<CalendarEvent['pinColor']>)
      : 'aqua';

    const payload: Record<string, unknown> = {
      id: safeId,
      title: clampString(event.title, BLUEPRINT_LIMITS.TITLE_MAX_LEN, 'Academy Event'),
      description: clampString(event.description, BLUEPRINT_LIMITS.DESCRIPTION_MAX_LEN, ''),
      posterUrl: clampString(event.posterUrl, BLUEPRINT_LIMITS.URL_MAX_LEN, ''),
      courseId: event.courseId ? clampString(event.courseId, BLUEPRINT_LIMITS.ID_MAX_LEN, '') : '',
      courseTitle: event.courseTitle ? clampString(event.courseTitle, BLUEPRINT_LIMITS.TITLE_MAX_LEN, '') : '',
      startUtc: clampString(event.startUtc || new Date().toISOString(), BLUEPRINT_LIMITS.META_STRING_MAX_LEN, new Date().toISOString()),
      endUtc: clampString(event.endUtc || event.startUtc || new Date().toISOString(), BLUEPRINT_LIMITS.META_STRING_MAX_LEN, new Date().toISOString()),
      ...(event.dateStr ? { dateStr: clampString(event.dateStr, 40) } : {}),
      ...(event.dayOfWeek ? { dayOfWeek: clampString(event.dayOfWeek, 40) } : {}),
      ...(event.timeUtc ? { timeUtc: clampString(event.timeUtc, 120) } : {}),
      ...(event.instructorId ? { instructorId: clampString(event.instructorId, 128) } : {}),
      ...(event.instructorName ? { instructorName: clampString(event.instructorName, 120) } : {}),
      ...(event.meetingId ? { meetingId: clampString(event.meetingId, 120) } : {}),
      ...(event.meetingPasscode ? { meetingPasscode: clampString(event.meetingPasscode, 60) } : {}),
      ...(event.joinUrl ? { joinUrl: clampString(event.joinUrl, BLUEPRINT_LIMITS.URL_MAX_LEN) } : {}),
      ...(event.hostStartUrl ? { hostStartUrl: clampString(event.hostStartUrl, BLUEPRINT_LIMITS.URL_MAX_LEN) } : {}),
      ...(event.isLiveNow !== undefined ? { isLiveNow: Boolean(event.isLiveNow) } : {}),
      ...(event.autoRecord !== undefined ? { autoRecord: Boolean(event.autoRecord) } : {}),
      type: safeType,
      pinnedToBoard: event.pinnedToBoard ?? true,
      pinColor: safePinColor,
      locationOrLabel: clampString(
        event.locationOrLabel,
        BLUEPRINT_LIMITS.META_STRING_MAX_LEN,
        'Deen Hijrah Live Classroom'
      ),
      isPublished: true,
      updatedAt: ts,
    };

    if (!snap.exists()) {
      await setDoc(evRef, { ...payload, createdAt: ts });
    } else {
      const { id: _id, ...updatable } = payload;
      await updateDoc(evRef, updatable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, eventPath);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;
  const safeId = assertValidBlueprintId(eventId, 'eventId');
  const eventPath = `events/${safeId}`;
  try {
    await deleteDoc(doc(db, 'events', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, eventPath);
  }
}

export async function syncBlogPostToFirestore(post: BlogPost): Promise<void> {
  if (!isFirebaseChancellorSignedIn()) return;
  const safeId = assertValidBlueprintId(post.id, 'blogId');
  const blogPath = `blogPosts/${safeId}`;

  try {
    const blogRef = doc(db, 'blogPosts', safeId);
    const snap = await getDoc(blogRef);
    const ts = serverTimestamp();

    const safeTags = Array.isArray(post.tags)
      ? post.tags
          .map((t) => clampString(t, 60))
          .filter((t) => t.length > 0)
          .slice(0, 10)
      : [];

    const payload = {
      id: safeId,
      title: clampString(post.title, BLUEPRINT_LIMITS.TITLE_MAX_LEN, 'Scholastic Monograph'),
      excerpt: clampString(post.excerpt, 600, 'Insights from Deen Hijrah Academia.'),
      content: clampString(post.content, 50000, 'Scholastic article content.'),
      authorName: clampString(post.authorName, 120, 'Mustaqeem Shaikh'),
      authorBadge: clampString(post.authorBadge, 120, 'Founding Chancellor'),
      readTime: clampString(post.readTime, 60, '4 min read'),
      bannerUrl: clampString(post.bannerUrl, BLUEPRINT_LIMITS.URL_MAX_LEN, 'fallback://blog'),
      tags: safeTags,
      isPublished: true,
      publishedAt: clampString(
        post.publishedAt || new Date().toISOString(),
        120,
        new Date().toISOString()
      ),
      updatedAt: ts,
    };

    if (!snap.exists()) {
      await setDoc(blogRef, { ...payload, createdAt: ts });
    } else {
      const { id: _id, ...updatable } = payload;
      await updateDoc(blogRef, updatable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, blogPath);
  }
}

export async function createCommunityPostInFirestore(post: CommunityPost): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safeId = assertValidBlueprintId(post.id, 'postId');
  const postPath = `communityPosts/${safeId}`;
  const isChancellor = isFirebaseChancellorSignedIn();

  try {
    const ts = serverTimestamp();
    const mediaUrl = clampString(post.mediaUrl, BLUEPRINT_LIMITS.URL_MAX_LEN);
    const authorAvatar = clampString(post.authorAvatar, BLUEPRINT_LIMITS.URL_MAX_LEN);

    // Direct setDoc without reading nonexistent doc (allow get requires resource != null for non-admins)
    await setDoc(doc(db, 'communityPosts', safeId), {
      id: safeId,
      authorId: assertValidBlueprintId(fbUser.uid, 'userId'),
      authorName: clampString(post.authorName, 120, fbUser.displayName || 'Scholar User'),
      authorRole: isChancellor ? post.authorRole : 'student',
      authorGender: post.authorGender === 'female' ? 'female' : 'male',
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(authorAvatar ? { authorAvatar } : {}),
      content: clampString(post.content, 5000, 'Reflection'),
      category: isChancellor && post.category === 'announcement' ? 'announcement' : 'community',
      pinned: isChancellor ? Boolean(post.pinned) : false,
      flagged: false,
      likes: 0,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, postPath);
  }
}

export async function addCommunityCommentInFirestore(
  postId: string,
  comment: PostComment
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safePostId = assertValidBlueprintId(postId, 'postId');
  const safeCommentId = assertValidBlueprintId(comment.id, 'commentId');
  const commentPath = `communityPosts/${safePostId}/comments/${safeCommentId}`;
  const isChancellor = isFirebaseChancellorSignedIn();

  try {
    const postSnap = await getDoc(doc(db, 'communityPosts', safePostId));
    if (!postSnap.exists()) return;

    const ts = serverTimestamp();
    const authorAvatar = clampString(comment.authorAvatar, BLUEPRINT_LIMITS.URL_MAX_LEN);

    await setDoc(doc(db, 'communityPosts', safePostId, 'comments', safeCommentId), {
      id: safeCommentId,
      postId: safePostId,
      authorId: assertValidBlueprintId(fbUser.uid, 'userId'),
      authorName: clampString(comment.authorName, 120, fbUser.displayName || 'Scholar User'),
      authorRole: isChancellor ? comment.authorRole : 'student',
      authorGender: comment.authorGender === 'female' ? 'female' : 'male',
      ...(authorAvatar ? { authorAvatar } : {}),
      content: clampString(comment.content, 2000, 'Comment'),
      createdAt: ts,
      updatedAt: ts,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, commentPath);
  }
}

export async function toggleCommunityLikeInFirestore(postId: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safePostId = assertValidBlueprintId(postId, 'postId');
  const safeUid = assertValidBlueprintId(fbUser.uid, 'userId');
  const postPath = `communityPosts/${safePostId}`;
  const postRef = doc(db, 'communityPosts', safePostId);
  const likeRef = doc(db, 'communityPosts', safePostId, 'likes', safeUid);

  try {
    const [postSnap, likeSnap] = await Promise.all([getDoc(postRef), getDoc(likeRef)]);
    if (!postSnap.exists()) return;

    const currentLikes = Math.max(0, Number(postSnap.data()?.likes) || 0);
    const batch = writeBatch(db);
    const ts = serverTimestamp();

    if (!likeSnap.exists()) {
      batch.set(likeRef, {
        userId: safeUid,
        postId: safePostId,
        createdAt: ts,
      });
      batch.update(postRef, {
        likes: currentLikes + 1,
        updatedAt: ts,
      });
    } else if (currentLikes >= 1) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likes: currentLikes - 1,
        updatedAt: ts,
      });
    } else {
      return;
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, postPath);
  }
}

export async function createChatMessageInFirestore(msg: ChatMessage): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safeId = assertValidBlueprintId(msg.id, 'messageId');
  const msgPath = `chatMessages/${safeId}`;
  const isChancellor = isFirebaseChancellorSignedIn();

  try {
    const courseId = msg.courseId ? clampString(msg.courseId, 128) : '';
    const senderAvatar = clampString(msg.senderAvatar, BLUEPRINT_LIMITS.URL_MAX_LEN);

    await setDoc(doc(db, 'chatMessages', safeId), {
      id: safeId,
      ...(courseId ? { courseId } : {}),
      channelId: clampString(msg.channelId, 128, 'general'),
      senderId: assertValidBlueprintId(fbUser.uid, 'userId'),
      senderName: clampString(msg.senderName, 120, fbUser.displayName || 'Scholar User'),
      senderRole: isChancellor ? msg.senderRole : 'student',
      senderGender: msg.senderGender === 'female' ? 'female' : 'male',
      ...(senderAvatar ? { senderAvatar } : {}),
      content: clampString(msg.content, 2000, 'Message'),
      flagged: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, msgPath);
  }
}

export async function saveCourseReviewToFirestore(review: CourseReview): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safeCourseId = assertValidBlueprintId(review.courseId, 'courseId');
  const safeUid = assertValidBlueprintId(fbUser.uid, 'authorId');
  const safeId = assertValidBlueprintId(`${safeCourseId}_${safeUid}`, 'reviewId');
  const reviewPath = `courseReviews/${safeId}`;

  try {
    const ref = doc(db, 'courseReviews', safeId);
    const snap = await getDoc(ref);
    const authorAvatar = clampString(review.authorAvatar, BLUEPRINT_LIMITS.URL_MAX_LEN);
    const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5)));
    const comment = clampString(review.comment, 1500, 'Course review');

    if (snap.exists()) {
      await updateDoc(ref, {
        rating,
        comment,
        authorName: clampString(review.authorName, 120, fbUser.displayName || 'Student'),
        ...(authorAvatar ? { authorAvatar } : {}),
        isVerifiedEnrollment: Boolean(review.isVerifiedEnrollment),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        courseId: safeCourseId,
        authorId: safeUid,
        authorName: clampString(review.authorName, 120, fbUser.displayName || 'Student'),
        authorGender: review.authorGender === 'female' ? 'female' : 'male',
        ...(authorAvatar ? { authorAvatar } : {}),
        rating,
        comment,
        isVerifiedEnrollment: Boolean(review.isVerifiedEnrollment),
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reviewPath);
  }
}

export async function deleteCourseReviewFromFirestore(
  courseId: string,
  reviewId?: string
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const candidateId =
    reviewId && BLUEPRINT_LIMITS.ID_PATTERN.test(reviewId)
      ? reviewId
      : `${assertValidBlueprintId(courseId, 'courseId')}_${assertValidBlueprintId(fbUser.uid, 'userId')}`;
  const reviewPath = `courseReviews/${candidateId}`;
  try {
    await deleteDoc(doc(db, 'courseReviews', candidateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, reviewPath);
  }
}

export async function saveInstructorReviewToFirestore(review: InstructorReview): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const safeInstructorId = assertValidBlueprintId(review.instructorId, 'instructorId');
  const safeUid = assertValidBlueprintId(fbUser.uid, 'authorId');
  const safeId = assertValidBlueprintId(`${safeInstructorId}_${safeUid}`, 'reviewId');
  const reviewPath = `instructorReviews/${safeId}`;

  try {
    const ref = doc(db, 'instructorReviews', safeId);
    const snap = await getDoc(ref);
    const authorAvatar = clampString(review.authorAvatar, BLUEPRINT_LIMITS.URL_MAX_LEN);
    const courseId = review.courseId ? clampString(review.courseId, 128) : '';
    const courseTitle = review.courseTitle ? clampString(review.courseTitle, 200) : '';
    const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5)));
    const comment = clampString(review.comment, 1500, 'Instructor review');

    if (snap.exists()) {
      await updateDoc(ref, {
        rating,
        comment,
        authorName: clampString(review.authorName, 120, fbUser.displayName || 'Student'),
        ...(authorAvatar ? { authorAvatar } : {}),
        ...(courseId ? { courseId } : {}),
        ...(courseTitle ? { courseTitle } : {}),
        isVerifiedStudent: Boolean(review.isVerifiedStudent),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        instructorId: safeInstructorId,
        instructorName: clampString(review.instructorName, 120, 'Academy Instructor'),
        authorId: safeUid,
        authorName: clampString(review.authorName, 120, fbUser.displayName || 'Student'),
        authorGender: review.authorGender === 'female' ? 'female' : 'male',
        ...(authorAvatar ? { authorAvatar } : {}),
        ...(courseId ? { courseId } : {}),
        ...(courseTitle ? { courseTitle } : {}),
        rating,
        comment,
        isVerifiedStudent: Boolean(review.isVerifiedStudent),
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reviewPath);
  }
}

export async function deleteInstructorReviewFromFirestore(
  instructorId: string,
  reviewId?: string
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const candidateId =
    reviewId && BLUEPRINT_LIMITS.ID_PATTERN.test(reviewId)
      ? reviewId
      : `${assertValidBlueprintId(instructorId, 'instructorId')}_${assertValidBlueprintId(fbUser.uid, 'userId')}`;
  const reviewPath = `instructorReviews/${candidateId}`;
  try {
    await deleteDoc(doc(db, 'instructorReviews', candidateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, reviewPath);
  }
}

// ==================== REAL-TIME FIRESTORE ONSNAPSHOT SUBSCRIPTIONS ====================

function wrapSnapshotError(
  operationType: OperationType,
  path: string,
  onError?: (err: Error) => void
) {
  return (error: unknown) => {
    try {
      handleFirestoreError(error, operationType, path);
    } catch (wrapped) {
      onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };
}

export function subscribeToPlatformSettings(
  onData: (settings: PlatformSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'settings/platform';
  return onSnapshot(
    doc(db, 'settings', 'platform'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onData({
        heroMode: data.heroMode === 'image' ? 'image' : 'video',
        heroVideoUrl: sanitizeVideoSource(data.heroVideoUrl),
        heroPosterUrl: typeof data.heroPosterUrl === 'string' && data.heroPosterUrl ? data.heroPosterUrl : 'fallback://hero',
        heroImageUrl: typeof data.heroImageUrl === 'string' && data.heroImageUrl ? data.heroImageUrl : 'fallback://hero',
        heroHeadline: typeof data.heroHeadline === 'string' ? data.heroHeadline : 'Deen Hijrah Academia',
        heroSubheadline: typeof data.heroSubheadline === 'string' ? data.heroSubheadline : 'Classical Scholarship',
        customLogoUrl: typeof data.customLogoUrl === 'string' ? data.customLogoUrl : '',
        customNavItems: Array.isArray(data.customNavItems) ? data.customNavItems : [],
      });
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToCourses(
  onData: (courses: Partial<Course>[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'courses';
  const q = query(collection(db, 'courses'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Partial<Course>[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          code: data.code,
          title: data.title,
          description: data.description,
          instructorId: data.instructorId,
          instructorName: data.instructorName,
          status: data.status,
          level: data.level,
          thumbnail: data.thumbnail || 'fallback://course',
          totalLectures: Number(data.totalLectures) || 0,
        };
      });
      onData(items);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToEvents(
  onData: (events: CalendarEvent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'events';
  const q = query(collection(db, 'events'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CalendarEvent[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          title: data.title || 'Academy Event',
          description: data.description || '',
          posterUrl: data.posterUrl || undefined,
          courseId: data.courseId || undefined,
          courseTitle: data.courseTitle || undefined,
          startUtc: data.startUtc || toIsoString(data.createdAt),
          endUtc: data.endUtc || data.startUtc || toIsoString(data.createdAt),
          dateStr: data.dateStr || undefined,
          dayOfWeek: data.dayOfWeek || undefined,
          timeUtc: data.timeUtc || undefined,
          instructorId: data.instructorId || undefined,
          instructorName: data.instructorName || undefined,
          meetingId: data.meetingId || undefined,
          meetingPasscode: data.meetingPasscode || undefined,
          joinUrl: data.joinUrl || undefined,
          hostStartUrl: data.hostStartUrl || undefined,
          isLiveNow: Boolean(data.isLiveNow),
          autoRecord: data.autoRecord !== undefined ? Boolean(data.autoRecord) : undefined,
          type: (VALID_EVENT_TYPES.has(String(data.type)) ? data.type : 'event') as CalendarEvent['type'],
          pinnedToBoard: data.pinnedToBoard ?? true,
          pinColor: (VALID_PIN_COLORS.has(String(data.pinColor)) ? data.pinColor : 'aqua') as CalendarEvent['pinColor'],
          locationOrLabel: data.locationOrLabel || 'Global Online Sanctuary',
          isDerived: false,
        };
      });
      items.sort((a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime());
      onData(items);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToBlogPosts(
  onData: (posts: BlogPost[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'blogPosts';
  const q = query(collection(db, 'blogPosts'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const posts: BlogPost[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          title: data.title || 'Scholastic Article',
          excerpt: data.excerpt || '',
          content: data.content || '',
          authorName: data.authorName || 'Mustaqeem Shaikh',
          authorBadge: data.authorBadge || 'Founding Chancellor',
          readTime: data.readTime || '4 min read',
          bannerUrl: data.bannerUrl || 'fallback://blog',
          publishedAt: data.publishedAt || toIsoString(data.createdAt),
          tags: Array.isArray(data.tags) ? data.tags : [],
        };
      });
      posts.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      onData(posts);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToCommunityPosts(
  onData: (posts: CommunityPost[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'communityPosts';
  const q = query(collection(db, 'communityPosts'), where('flagged', '==', false));
  return onSnapshot(
    q,
    (snapshot) => {
      const posts: CommunityPost[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          authorId: data.authorId,
          authorName: data.authorName,
          authorRole: data.authorRole || 'student',
          authorGender: data.authorGender === 'female' ? 'female' : 'male',
          authorAvatar: data.authorAvatar || undefined,
          content: data.content,
          mediaUrl: data.mediaUrl || undefined,
          category: data.category === 'announcement' ? 'announcement' : 'community',
          pinned: Boolean(data.pinned),
          createdAt: toIsoString(data.createdAt),
          likes: Math.max(0, Number(data.likes) || 0),
          likedByUserIds: [],
          comments: [],
          flagged: Boolean(data.flagged),
        };
      });
      posts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(posts);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToChatMessages(
  onData: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'chatMessages';
  const q = query(collection(db, 'chatMessages'), where('flagged', '==', false));
  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          courseId: data.courseId || undefined,
          channelId: data.channelId || 'general',
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole || 'student',
          senderGender: data.senderGender === 'female' ? 'female' : 'male',
          senderAvatar: data.senderAvatar || undefined,
          content: data.content,
          timestamp: toIsoString(data.createdAt),
          flagged: Boolean(data.flagged),
        };
      });
      messages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      onData(messages);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToCourseReviews(
  onData: (reviews: CourseReview[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'courseReviews';
  const q = query(collection(db, 'courseReviews'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const reviews: CourseReview[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          courseId: String(data.courseId || ''),
          authorId: String(data.authorId || ''),
          authorName: String(data.authorName || 'Academy Student'),
          authorGender: data.authorGender === 'female' ? 'female' : 'male',
          authorAvatar: typeof data.authorAvatar === 'string' && data.authorAvatar ? data.authorAvatar : undefined,
          rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
          comment: String(data.comment || ''),
          isVerifiedEnrollment: Boolean(data.isVerifiedEnrollment),
          isPublished: data.isPublished !== false,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      reviews.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(reviews);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToInstructorReviews(
  onData: (reviews: InstructorReview[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'instructorReviews';
  const q = query(collection(db, 'instructorReviews'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const reviews: InstructorReview[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          instructorId: String(data.instructorId || ''),
          instructorName: String(data.instructorName || 'Academy Instructor'),
          authorId: String(data.authorId || ''),
          authorName: String(data.authorName || 'Academy Student'),
          authorGender: data.authorGender === 'female' ? 'female' : 'male',
          authorAvatar: typeof data.authorAvatar === 'string' && data.authorAvatar ? data.authorAvatar : undefined,
          courseId: typeof data.courseId === 'string' && data.courseId ? data.courseId : undefined,
          courseTitle: typeof data.courseTitle === 'string' && data.courseTitle ? data.courseTitle : undefined,
          rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
          comment: String(data.comment || ''),
          isVerifiedStudent: Boolean(data.isVerifiedStudent),
          isPublished: data.isPublished !== false,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      reviews.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(reviews);
    },
    wrapSnapshotError(OperationType.GET, path, onError)
  );
}

export function subscribeToUserAccount(
  uid: string,
  onPatch: (patch: Partial<User>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeUid = assertValidBlueprintId(uid, 'userId');
  const rootPath = `users/${safeUid}`;
  const publicPath = `users/${safeUid}/public/profile`;

  const unsubRoot = onSnapshot(
    doc(db, 'users', safeUid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.role === 'admin' || data.role === 'teacher' || data.role === 'student') {
        onPatch({ role: data.role });
      }
    },
    wrapSnapshotError(OperationType.GET, rootPath, onError)
  );

  const unsubPublic = onSnapshot(
    doc(db, 'users', safeUid, 'public', 'profile'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onPatch({
        ...(typeof data.firstName === 'string' ? { firstName: data.firstName } : {}),
        ...(typeof data.lastName === 'string' ? { lastName: data.lastName } : {}),
        ...(data.gender === 'female' || data.gender === 'male' ? { gender: data.gender } : {}),
        ...(typeof data.avatarUrl === 'string' && data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
        ...(typeof data.avatarStoragePath === 'string' && data.avatarStoragePath
          ? { avatarStoragePath: data.avatarStoragePath }
          : {}),
      });
    },
    wrapSnapshotError(OperationType.GET, publicPath, onError)
  );

  return () => {
    unsubRoot();
    unsubPublic();
  };
}

export function subscribeToUserPreferences(
  uid: string,
  onTheme: (theme: 'dark' | 'light') => void,
  onError?: (err: Error) => void,
  onReadNotifications?: (readIds: string[]) => void
): Unsubscribe {
  const safeUid = assertValidBlueprintId(uid, 'userId');
  const prefPath = `users/${safeUid}/preferences/ui`;

  return onSnapshot(
    doc(db, 'users', safeUid, 'preferences', 'ui'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const rawTheme = data?.theme;
      if (rawTheme === 'dark' || rawTheme === 'light') {
        onTheme(rawTheme);
      }
      if (onReadNotifications && Array.isArray(data?.readNotificationIds)) {
        onReadNotifications(sanitizeReadNotificationIds(data.readNotificationIds));
      }
    },
    wrapSnapshotError(OperationType.GET, prefPath, onError)
  );
}

export function subscribeToEnrolledCourseRecordings(
  courseIds: string[],
  onCourseRecordings: (courseId: string, recordings: CompletedVideoArchive[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const validCourseIds = Array.from(
    new Set(
      courseIds.filter(
        (cid) =>
          typeof cid === 'string' &&
          cid.length > 0 &&
          cid.length <= BLUEPRINT_LIMITS.ID_MAX_LEN &&
          BLUEPRINT_LIMITS.ID_PATTERN.test(cid)
      )
    )
  ).slice(0, 20);

  for (const cid of validCourseIds) {
    const catalogPath = `courses/${cid}/recordingCatalog`;
    const q = query(
      collection(db, 'courses', cid, 'recordingCatalog'),
      where('courseId', '==', cid),
      where('mimeType', '==', 'video/mp4')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: CompletedVideoArchive[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || 'Lecture Recording'),
            duration: String(data.duration || '45 min'),
            recordedAt:
              typeof data.recordedAt === 'string' && data.recordedAt
                ? data.recordedAt
                : toIsoString(data.createdAt),
            videoUrl: '',
            thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : '',
            isOrientation: Boolean(data.isOrientation),
            mimeType: 'video/mp4',
            syncedFromZoomWebhook: false,
            fileSize: String(data.fileSize || '150 MB'),
          };
        });
        onCourseRecordings(cid, items);
      },
      wrapSnapshotError(OperationType.GET, catalogPath, onError)
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

// ==================== DUAL-PATH SMART MEDIA UPLOADS (SQL SERVER + FIREBASE STORAGE) ====================

export type SmartAssetKind =
  | 'course_thumbnail'
  | 'recording_thumbnail'
  | 'event_poster'
  | 'hero_poster'
  | 'hero_image'
  | 'custom_logo'
  | 'avatar';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read selected file.'));
        return;
      }
      const commaIdx = reader.result.indexOf(',');
      resolve(commaIdx >= 0 ? reader.result.slice(commaIdx + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAssetSmart(
  kind: SmartAssetKind,
  file: File,
  onProgress?: (percent: number) => void,
  meta: { courseId?: string; recordingId?: string } = {}
): Promise<{ url: string; storagePath: string }> {
  const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  const allowed = kind === 'avatar' ? allowedAvatarTypes : allowedImageTypes;

  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === 'avatar'
        ? 'Profile picture must be JPG, PNG, or WebP.'
        : 'Image must be JPG, PNG, WebP, or SVG.'
    );
  }

  const maxBytes =
    kind === 'avatar'
      ? BLUEPRINT_LIMITS.MAX_AVATAR_BYTES
      : kind === 'course_thumbnail' || kind === 'recording_thumbnail'
      ? BLUEPRINT_LIMITS.MAX_THUMBNAIL_BYTES
      : 15 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`Image size must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }

  // Prefer Firebase Storage directly when an appropriate verified Google session is active
  if (kind === 'avatar' && auth.currentUser?.emailVerified) {
    const res = await uploadProfileAvatarToStorage(file, onProgress);
    return { url: res.avatarUrl, storagePath: res.avatarStoragePath };
  }

  if (isFirebaseChancellorSignedIn()) {
    if (
      kind === 'hero_poster' ||
      kind === 'hero_image' ||
      kind === 'custom_logo'
    ) {
      const res = await uploadBrandingAssetToStorage(kind, file, onProgress);
      return { url: res.downloadUrl, storagePath: res.storagePath };
    }
    if (kind === 'recording_thumbnail' && meta.courseId && meta.recordingId) {
      const res = await uploadRecordingThumbnailToStorage(
        meta.courseId,
        meta.recordingId,
        file,
        onProgress
      );
      return { url: res.thumbnailUrl, storagePath: res.thumbnailStoragePath };
    }
  }

  // Durable Cloud SQL / Server asset upload (no forced Google popup required)
  onProgress?.(25);
  const dataBase64 = await readFileAsBase64(file);
  onProgress?.(65);
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/uploads/asset', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind,
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Failed to persist uploaded image asset.');
  }
  onProgress?.(100);
  return { url: data.url, storagePath: '' };
}

export async function uploadPdfDocumentSmart(
  kind: 'supplementary_pdf' | 'assessment_attachment' | 'course_material' | 'student_submission',
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; fileName: string; sizeBytes: number; storagePath: string }> {
  const maxBytes = 20 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error('Document size must be under 20 MB.');
  }
  const lower = file.name.toLowerCase();
  const isPdfOrAllowed =
    file.type === 'application/pdf' ||
    lower.endsWith('.pdf') ||
    (kind === 'student_submission' &&
      (lower.endsWith('.doc') ||
        lower.endsWith('.docx') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.md') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.ppt') ||
        lower.endsWith('.pptx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.zip') ||
        file.type.startsWith('image/')));

  if (!isPdfOrAllowed) {
    throw new Error(
      kind === 'student_submission'
        ? 'Please upload a PDF, Word, PowerPoint, Excel, TXT/MD, ZIP, or image file.'
        : 'Supplementary materials must be uploaded as a .pdf file.'
    );
  }

  onProgress?.(25);
  const dataBase64 = await readFileAsBase64(file);
  onProgress?.(60);
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/uploads/pdf', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind,
      fileName: file.name,
      mimeType: file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
      dataBase64,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Failed to upload document.');
  }
  onProgress?.(100);
  return {
    url: data.url,
    fileName: data.fileName || file.name,
    sizeBytes: Number(data.sizeBytes) || file.size,
    storagePath: '',
  };
}

export async function uploadMp4VideoSmart(
  kind: 'course_recording' | 'course_teaser' | 'hero_video' | 'live_recording',
  file: File | Blob,
  opts: { courseId?: string; recordingId?: string; isOrientation?: boolean; fileName?: string } = {},
  onProgress?: (percent: number) => void
): Promise<{ streamUrl: string; storagePath: string; fileSize: string }> {
  const fileName = opts.fileName || (file instanceof File ? file.name : 'live_classroom.webm');
  const lowerName = fileName.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  const isWebm = mime.includes('webm') || lowerName.endsWith('.webm');
  const isMp4 = mime === 'video/mp4' || lowerName.endsWith('.mp4');

  if (kind !== 'live_recording' && !isMp4) {
    throw new Error('Video upload must strictly be in .mp4 format (video/mp4).');
  }
  if (kind === 'live_recording' && !isMp4 && !isWebm) {
    throw new Error('Live classroom recording must be MP4 or WebM.');
  }
  const maxBytes =
    kind === 'hero_video'
      ? BLUEPRINT_LIMITS.MAX_BRANDING_VIDEO_BYTES
      : BLUEPRINT_LIMITS.MAX_VIDEO_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`Video file size must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }

  // Use Firebase Storage directly if Chancellor is signed in via Google for MP4 uploads
  if (isFirebaseChancellorSignedIn() && isMp4 && file instanceof File) {
    if ((kind === 'course_recording' || kind === 'course_teaser') && opts.courseId && opts.recordingId) {
      const isTeaser = kind === 'course_teaser';
      const res = await uploadCourseRecordingToStorage(
        opts.courseId,
        opts.recordingId,
        file,
        isTeaser ? true : Boolean(opts.isOrientation),
        onProgress
      );
      return { streamUrl: '', storagePath: res.storagePath, fileSize: res.fileSize };
    }
    if (kind === 'hero_video') {
      const res = await uploadBrandingAssetToStorage('hero_video', file, onProgress);
      return {
        streamUrl: res.downloadUrl,
        storagePath: res.storagePath,
        fileSize: formatFileSize(file.size),
      };
    }
  }

  // Upload raw binary video directly to Express backend with XHR progress reporting
  const authHeaders = await getAuthHeaders();
  const params = new URLSearchParams({
    kind,
    filename: fileName,
    ...(opts.courseId ? { courseId: opts.courseId } : {}),
    ...(opts.recordingId ? { recId: opts.recordingId } : {}),
  });

  const payload = await new Promise<{ streamUrl: string; fileSize: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/uploads/video?${params.toString()}`);
    Object.entries(authHeaders).forEach(([k, v]) => {
      xhr.setRequestHeader(k, v);
    });
    xhr.setRequestHeader('Content-Type', isWebm ? 'video/webm' : 'video/mp4');

    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && parsed.streamUrl) {
          onProgress?.(100);
          resolve({
            streamUrl: parsed.streamUrl,
            fileSize: parsed.fileSize || formatFileSize(file.size),
          });
        } else {
          reject(new Error(parsed.error || `Upload failed (HTTP ${xhr.status}).`));
        }
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading video file.'));
    xhr.send(file);
  });

  return {
    streamUrl: payload.streamUrl,
    storagePath: '',
    fileSize: payload.fileSize,
  };
}

// ==================== SECURE NON-DOWNLOADABLE MP4 STREAM VERIFICATION ====================

export interface VerifiedStreamResult {
  streamUrl: string;
  isObjectUrl: boolean;
  verifiedByRules: boolean;
}

export async function verifyAndResolveMp4Stream(
  courseId: string,
  recording: CompletedVideoArchive,
  isEnrolledLocally: boolean,
  isAdminViewer = false
): Promise<VerifiedStreamResult> {
  const safeCourseId = assertValidBlueprintId(courseId, 'courseId');
  const safeRecId = assertValidBlueprintId(recording.id, 'recordingId');
  const fbUser = auth.currentUser;
  const hasStoragePath = Boolean(
    recording.storagePath &&
      recording.storagePath.startsWith(`courses/${safeCourseId}/recordings/`)
  );

  const isAuthorized = Boolean(recording.isOrientation || isEnrolledLocally || isAdminViewer);
  if (!isAuthorized) {
    throw new Error('ENROLLMENT_REQUIRED');
  }

  // If recording does not live in Firebase Storage, resolve directly via local/SQL access controls
  // without triggering Firestore PERMISSION_DENIED on nonexistent /courses/.../recordings docs.
  if (!hasStoragePath) {
    let streamUrl = (recording.videoUrl || '').trim();
    if (!streamUrl) {
      throw new Error('No playable MP4 source found for this recording.');
    }

    if (streamUrl.startsWith('/api/courses/')) {
      const token = getStoredSessionToken();
      if (token && !streamUrl.includes('st=')) {
        const sep = streamUrl.includes('?') ? '&' : '?';
        streamUrl = `${streamUrl}${sep}st=${encodeURIComponent(token)}`;
      }
    }

    return {
      streamUrl,
      isObjectUrl: false,
      verifiedByRules: false,
    };
  }

  // Firebase Storage backed recording: require verified Google auth for non-orientation streams
  if (!recording.isOrientation && (!fbUser || !fbUser.emailVerified)) {
    throw new Error('FIREBASE_AUTH_REQUIRED');
  }

  let verifiedStoragePath = recording.storagePath || '';
  let verifiedVideoUrl = recording.videoUrl || '';
  let verifiedByRules = false;

  // Step 1: Verify authorization directly against Firestore /courses/{courseId}/recordings/{recordingId}
  const recordingDocPath = `courses/${safeCourseId}/recordings/${safeRecId}`;
  try {
    const recSnap = await getDoc(doc(db, 'courses', safeCourseId, 'recordings', safeRecId));
    if (recSnap.exists()) {
      const data = recSnap.data();
      if (data.nonDownloadable !== true || data.mimeType !== 'video/mp4') {
        throw new Error('Recording failed non-downloadable MP4 integrity policy.');
      }
      verifiedStoragePath = data.storagePath || verifiedStoragePath;
      verifiedVideoUrl = data.videoUrl || verifiedVideoUrl;
      verifiedByRules = true;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (
      msg.includes('permission') ||
      msg.includes('insufficient') ||
      msg.includes('denied') ||
      msg.includes('unauthenticated')
    ) {
      handleFirestoreError(error, OperationType.GET, recordingDocPath);
    }
    handleFirestoreError(error, OperationType.GET, recordingDocPath);
  }

  if (!verifiedByRules && !recording.isOrientation && !isEnrolledLocally && !isAdminViewer) {
    throw new Error('ENROLLMENT_REQUIRED');
  }

  // Step 2: For Firebase Storage bucket MP4s with authenticated user, write an immutable
  // streamRequests document verified by Firestore Security Rules (Master Gate check)
  if (verifiedStoragePath && fbUser && fbUser.emailVerified) {
    const reqId = `req-${Date.now()}-${generateSecureToken().slice(0, 6)}`;
    const reqPath = `courses/${safeCourseId}/streamRequests/${reqId}`;
    const isChancellor = fbUser.email?.toLowerCase() === CHANCELLOR_EMAIL;
    const accessType = isChancellor
      ? 'admin_stream'
      : recording.isOrientation
      ? 'orientation_preview'
      : 'enrolled_stream';

    try {
      await setDoc(doc(db, 'courses', safeCourseId, 'streamRequests', reqId), {
        id: reqId,
        courseId: safeCourseId,
        recordingId: safeRecId,
        userId: fbUser.uid,
        storagePath: verifiedStoragePath,
        mimeType: 'video/mp4',
        nonDownloadable: true,
        accessType,
        requestedAt: serverTimestamp(),
      });
      verifiedByRules = true;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, reqPath);
    }
  }

  // Step 3: Stream from Firebase Storage Bucket using authenticated getBlob -> ephemeral blob: URL
  if (verifiedStoragePath) {
    const storageRef = ref(storage, verifiedStoragePath);
    try {
      const blob = await getBlob(storageRef);
      const mp4Blob =
        blob.type === 'video/mp4' ? blob : new Blob([blob], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(mp4Blob);
      return {
        streamUrl: blobUrl,
        isObjectUrl: true,
        verifiedByRules: true,
      };
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        throw new Error('Firebase Storage denied access to this protected MP4 recording.');
      }
      if (verifiedByRules) {
        const directUrl = await getDownloadURL(storageRef);
        return {
          streamUrl: directUrl,
          isObjectUrl: false,
          verifiedByRules: true,
        };
      }
      throw error;
    }
  }

  return {
    streamUrl: verifiedVideoUrl,
    isObjectUrl: false,
    verifiedByRules,
  };
}
