import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendanceRecords,
  authSessions,
  blogPosts,
  calendarEvents,
  chatMessages,
  communityPosts,
  courses,
  enrollments,
  moderationLogs,
  platformSettings,
  recordings,
  submissions,
  uploadedAssets,
  users,
} from './schema.ts';
import type {
  AttendanceRecord,
  BlogPost,
  CalendarEvent,
  ChatMessage,
  CommunityPost,
  CompletedVideoArchive,
  Course,
  CustomNavItem,
  ModerationLog,
  PlatformSettings,
  PostComment,
  StudentSubmission,
  User,
} from '../types.ts';

function normalizeMediaToken(url: string | undefined | null, fallbackToken: string): string {
  const clean = (url || '').trim();
  if (!clean || clean.includes('images.unsplash.com')) {
    return fallbackToken;
  }
  return clean;
}

function normalizeVideoUrl(url: string | undefined | null, fallback = ''): string {
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

function sanitizeMaterialUrl(
  courseId: string,
  materialId: string,
  fileUrl: string | undefined | null
): string {
  const clean = (fileUrl || '').trim();
  if (!clean || clean === '#' || clean.startsWith('#')) {
    return `/api/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}/download`;
  }
  return clean;
}

let seedPromise: Promise<void> | null = null;

const DEFAULT_NAV_ITEMS: CustomNavItem[] = [
  { id: 'nav-home', label: 'Home', key: 'home', isSystem: true },
  { id: 'nav-courses', label: 'Courses', key: 'courses', isSystem: true },
  { id: 'nav-preregister', label: 'Pre-Register', key: 'pre-register', isSystem: true },
  { id: 'nav-faculty', label: 'Faculty', key: 'faculty', isSystem: true },
  { id: 'nav-blogs', label: 'Articles', key: 'blogs', isSystem: true },
  { id: 'nav-counseling', label: 'Counseling', key: 'counseling', isSystem: true },
  { id: 'nav-about', label: 'About', key: 'about', isSystem: true },
  { id: 'nav-contact', label: 'Contact', key: 'contact', isSystem: true },
];

function isLegacyDefaultNav(items?: CustomNavItem[] | null): boolean {
  if (!items || items.length !== 6) return true;
  const legacyKeys = ['home', 'courses', 'blogs', 'faculty', 'about', 'contact'];
  return items.every((item, i) => item.key === legacyKeys[i]);
}

export async function ensureInitialSqlBootstrap(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        await db
          .insert(users)
          .values([
            {
              uid: 'admin-mustaqeem',
              firstName: 'Mustaqeem',
              lastName: 'Shaikh',
              email: 'mustaqeemshaikh004@gmail.com',
              role: 'admin',
              gender: 'male',
            },
            {
              uid: 'student-tester',
              firstName: 'Zayd',
              lastName: 'Farooq',
              email: 'zayd.farooq@deenhijrahacademia.edu',
              role: 'student',
              gender: 'male',
            },
          ])
          .onConflictDoNothing();

        await db
          .insert(platformSettings)
          .values({
            id: 'platform',
            heroMode: 'video',
            heroVideoUrl: '',
            heroPosterUrl: 'fallback://hero',
            heroImageUrl: 'fallback://hero',
            heroHeadline: 'Pursue Sacred Knowledge with Rigor & Elegance',
            heroSubheadline:
              'A sanctuary of classical Islamic scholarship engineered with immersive real-time classrooms, automated Zoom lecture archives, and global timezone intelligence.',
            customLogoUrl: '',
            customNavItemsJson: DEFAULT_NAV_ITEMS,
          })
          .onConflictDoNothing();

        await db
          .insert(communityPosts)
          .values({
            id: 'post-1',
            authorUid: 'admin-mustaqeem',
            authorName: 'Mustaqeem Shaikh',
            authorRole: 'admin',
            authorGender: 'male',
            content:
              'Bismillah! Welcome to Deen Hijrah Academia. The academy platform is initialized with Seerahverse aesthetics, automated Zoom cloud recording synchronization, and real-time international timezone clocking. We invite students and seekers of knowledge to join our sacred academic journey.',
            category: 'announcement',
            pinned: true,
            likes: 1,
            likedByUserUidsJson: ['admin-mustaqeem'],
            commentsJson: [],
            flagged: false,
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing();

        await db
          .insert(blogPosts)
          .values({
            id: 'blog-1',
            title: 'The Sacred Convergence: Classical Tradition Meets Frontier Technology',
            excerpt:
              'How Deen Hijrah Academia bridges timeless scholastic lineage with modern educational architecture.',
            content:
              'In the tradition of profound scholarship, pedagogy requires clarity, discipline, and communal presence. Deen Hijrah Academia establishes an academic standard where live digital halls eliminate geographical distances. Through automated timezone alignment, automated lecture archives, and strict moderation ethics, we cultivate an intellectual sanctuary for global seekers.',
            authorName: 'Administrator Mustaqeem',
            authorBadge: 'Founding Chancellor',
            readTime: '4 min read',
            bannerUrl: 'fallback://blog',
            tagsJson: ['Academics', 'Foundational Vision', 'Scholarship'],
            publishedAt: new Date().toISOString(),
          })
          .onConflictDoNothing();
      } catch (err) {
        seedPromise = null;
        throw err;
      }
    })();
  }
  await seedPromise;
}

export async function listCoursesFromSql(): Promise<Course[]> {
  try {
    await ensureInitialSqlBootstrap();
    const [courseRows, enrollmentRows, recordingRows] = await Promise.all([
      db.select().from(courses).orderBy(desc(courses.createdAt)),
      db.select().from(enrollments).where(eq(enrollments.status, 'active')),
      db.select().from(recordings),
    ]);

    return courseRows.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      instructorId: c.instructorId,
      instructorName: c.instructorName,
      status: c.status as Course['status'],
      level: c.level as Course['level'],
      thumbnail: normalizeMediaToken(c.thumbnail, 'fallback://course'),
      totalLectures: c.totalLectures,
      maxSpots: c.maxSpots ?? 50,
      durationLabel: c.durationLabel || '12 Weeks',
      enrollmentDeadlineUtc: c.enrollmentDeadlineUtc || '',
      modules: c.modulesJson || [],
      schedules: c.schedulesJson || [],
      materials: (c.materialsJson || []).map((m) => ({
        ...m,
        fileUrl: sanitizeMaterialUrl(c.id, m.id, m.fileUrl),
      })),
      assignments: c.assignmentsJson || [],
      enrolledStudentIds: enrollmentRows
        .filter((e) => e.courseId === c.id)
        .map((e) => e.userUid),
      videoArchives: recordingRows
        .filter((r) => r.courseId === c.id)
        .map((r) => ({
          id: r.id,
          title: r.title,
          duration: r.duration,
          recordedAt: r.recordedAt,
          videoUrl: r.storagePath
            ? r.videoUrl || ''
            : normalizeVideoUrl(r.videoUrl, '/api/streams/sample/lecture'),
          storagePath: r.storagePath || undefined,
          teaserUrl: r.teaserUrl || undefined,
          teaserStoragePath: r.teaserStoragePath || undefined,
          thumbnailUrl: r.thumbnailUrl
            ? normalizeMediaToken(r.thumbnailUrl, 'fallback://course')
            : undefined,
          thumbnailStoragePath: r.thumbnailStoragePath || undefined,
          supplementaryPdfUrl: r.supplementaryPdfUrl || undefined,
          supplementaryPdfName: r.supplementaryPdfName || undefined,
          supplementaryPdfStoragePath: r.supplementaryPdfStoragePath || undefined,
          mimeType: 'video/mp4',
          nonDownloadable: r.nonDownloadable,
          nonShareable: r.nonShareable,
          isOrientation: r.isOrientation,
          syncedFromZoomWebhook: r.syncedFromZoomWebhook,
          fileSize: r.fileSize,
        })),
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createCourseInSql(course: Course): Promise<Course> {
  try {
    await ensureInitialSqlBootstrap();
    await db
      .insert(courses)
      .values({
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        status: course.status,
        level: course.level,
        thumbnail: course.thumbnail,
        totalLectures: course.totalLectures,
        maxSpots: Math.max(1, Number(course.maxSpots) || 50),
        durationLabel: (course.durationLabel || '12 Weeks').trim(),
        enrollmentDeadlineUtc: (course.enrollmentDeadlineUtc || '').trim(),
        modulesJson: course.modules || [],
        schedulesJson: course.schedules || [],
        materialsJson: course.materials || [],
        assignmentsJson: course.assignments || [],
      })
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          code: course.code,
          title: course.title,
          description: course.description,
          instructorId: course.instructorId,
          instructorName: course.instructorName,
          status: course.status,
          level: course.level,
          thumbnail: course.thumbnail,
          totalLectures: course.totalLectures,
          maxSpots: Math.max(1, Number(course.maxSpots) || 50),
          durationLabel: (course.durationLabel || '12 Weeks').trim(),
          enrollmentDeadlineUtc: (course.enrollmentDeadlineUtc || '').trim(),
          modulesJson: course.modules || [],
          schedulesJson: course.schedules || [],
          materialsJson: course.materials || [],
          assignmentsJson: course.assignments || [],
          updatedAt: new Date(),
        },
      });

    for (const studentUid of course.enrolledStudentIds || []) {
      await enrollStudentInSql(course.id, studentUid);
    }

    for (const rec of course.videoArchives || []) {
      await upsertRecordingInSql(course.id, rec);
    }

    return course;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteCourseInSql(courseId: string): Promise<void> {
  try {
    await db.delete(courses).where(eq(courses.id, courseId));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function enrollStudentInSql(
  courseId: string,
  userUid: string,
  emailHint?: string
): Promise<void> {
  try {
    await ensureInitialSqlBootstrap();
    await db
      .insert(users)
      .values({
        uid: userUid,
        email: emailHint || `${userUid}@deenhijrahacademia.edu`,
        firstName: 'Scholar',
        lastName: 'Student',
        role: 'student',
        gender: 'male',
      })
      .onConflictDoNothing();

    await db
      .insert(enrollments)
      .values({
        courseId,
        userUid,
        status: 'active',
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function isStudentEnrolledInSql(
  courseId: string,
  userUid: string
): Promise<boolean> {
  try {
    const rows = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userUid, userUid)));
    return rows.some((r) => r.status === 'active' || r.status === 'completed');
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertRecordingInSql(
  courseId: string,
  rec: CompletedVideoArchive
): Promise<void> {
  try {
    await db
      .insert(recordings)
      .values({
        id: rec.id,
        courseId,
        title: rec.title,
        duration: rec.duration,
        videoUrl: rec.videoUrl || '',
        storagePath: rec.storagePath || '',
        teaserUrl: rec.teaserUrl || '',
        teaserStoragePath: rec.teaserStoragePath || '',
        thumbnailUrl: rec.thumbnailUrl || '',
        thumbnailStoragePath: rec.thumbnailStoragePath || '',
        supplementaryPdfUrl: rec.supplementaryPdfUrl || '',
        supplementaryPdfName: rec.supplementaryPdfName || '',
        supplementaryPdfStoragePath: rec.supplementaryPdfStoragePath || '',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        nonShareable: true,
        isOrientation: Boolean(rec.isOrientation),
        syncedFromZoomWebhook: Boolean(rec.syncedFromZoomWebhook),
        fileSize: rec.fileSize || '180 MB',
        recordedAt: rec.recordedAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: recordings.id,
        set: {
          title: rec.title,
          duration: rec.duration,
          videoUrl: rec.videoUrl || '',
          storagePath: rec.storagePath || '',
          teaserUrl: rec.teaserUrl || '',
          teaserStoragePath: rec.teaserStoragePath || '',
          thumbnailUrl: rec.thumbnailUrl || '',
          thumbnailStoragePath: rec.thumbnailStoragePath || '',
          supplementaryPdfUrl: rec.supplementaryPdfUrl || '',
          supplementaryPdfName: rec.supplementaryPdfName || '',
          supplementaryPdfStoragePath: rec.supplementaryPdfStoragePath || '',
          isOrientation: Boolean(rec.isOrientation),
          syncedFromZoomWebhook: Boolean(rec.syncedFromZoomWebhook),
          fileSize: rec.fileSize || '180 MB',
        },
      });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateRecordingInSql(
  courseId: string,
  recordingId: string,
  patch: Partial<CompletedVideoArchive>
): Promise<CompletedVideoArchive | null> {
  try {
    const existing = await db
      .select()
      .from(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.courseId, courseId)));
    const current = existing[0];
    if (!current) return null;

    const updated = await db
      .update(recordings)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.duration !== undefined ? { duration: patch.duration } : {}),
        ...(patch.videoUrl !== undefined ? { videoUrl: patch.videoUrl } : {}),
        ...(patch.storagePath !== undefined ? { storagePath: patch.storagePath } : {}),
        ...(patch.teaserUrl !== undefined ? { teaserUrl: patch.teaserUrl } : {}),
        ...(patch.teaserStoragePath !== undefined ? { teaserStoragePath: patch.teaserStoragePath } : {}),
        ...(patch.thumbnailUrl !== undefined ? { thumbnailUrl: patch.thumbnailUrl } : {}),
        ...(patch.thumbnailStoragePath !== undefined
          ? { thumbnailStoragePath: patch.thumbnailStoragePath }
          : {}),
        ...(patch.supplementaryPdfUrl !== undefined
          ? { supplementaryPdfUrl: patch.supplementaryPdfUrl }
          : {}),
        ...(patch.supplementaryPdfName !== undefined
          ? { supplementaryPdfName: patch.supplementaryPdfName }
          : {}),
        ...(patch.supplementaryPdfStoragePath !== undefined
          ? { supplementaryPdfStoragePath: patch.supplementaryPdfStoragePath }
          : {}),
        ...(patch.isOrientation !== undefined
          ? { isOrientation: Boolean(patch.isOrientation) }
          : {}),
        ...(patch.fileSize !== undefined ? { fileSize: patch.fileSize } : {}),
      })
      .where(and(eq(recordings.id, recordingId), eq(recordings.courseId, courseId)))
      .returning();

    const r = updated[0];
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      duration: r.duration,
      recordedAt: r.recordedAt,
      videoUrl: r.videoUrl,
      storagePath: r.storagePath || undefined,
      teaserUrl: r.teaserUrl || undefined,
      teaserStoragePath: r.teaserStoragePath || undefined,
      thumbnailUrl: r.thumbnailUrl || undefined,
      thumbnailStoragePath: r.thumbnailStoragePath || undefined,
      supplementaryPdfUrl: r.supplementaryPdfUrl || undefined,
      supplementaryPdfName: r.supplementaryPdfName || undefined,
      supplementaryPdfStoragePath: r.supplementaryPdfStoragePath || undefined,
      mimeType: 'video/mp4',
      nonDownloadable: r.nonDownloadable,
      nonShareable: r.nonShareable,
      isOrientation: r.isOrientation,
      syncedFromZoomWebhook: r.syncedFromZoomWebhook,
      fileSize: r.fileSize,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getRawRecordingFromSql(
  courseId: string,
  recordingId: string
): Promise<CompletedVideoArchive | null> {
  try {
    const rows = await db
      .select()
      .from(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.courseId, courseId)));
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      duration: r.duration,
      recordedAt: r.recordedAt,
      videoUrl: r.videoUrl,
      storagePath: r.storagePath || undefined,
      teaserUrl: r.teaserUrl || undefined,
      teaserStoragePath: r.teaserStoragePath || undefined,
      thumbnailUrl: r.thumbnailUrl || undefined,
      thumbnailStoragePath: r.thumbnailStoragePath || undefined,
      supplementaryPdfUrl: r.supplementaryPdfUrl || undefined,
      supplementaryPdfName: r.supplementaryPdfName || undefined,
      supplementaryPdfStoragePath: r.supplementaryPdfStoragePath || undefined,
      mimeType: 'video/mp4',
      nonDownloadable: r.nonDownloadable,
      nonShareable: r.nonShareable,
      isOrientation: r.isOrientation,
      syncedFromZoomWebhook: r.syncedFromZoomWebhook,
      fileSize: r.fileSize,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteRecordingInSql(
  courseId: string,
  recordingId: string
): Promise<void> {
  try {
    await db
      .delete(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.courseId, courseId)));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getSettingsFromSql(): Promise<PlatformSettings> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 'platform'));

    const row = rows[0];
    return {
      heroMode: row?.heroMode === 'image' ? 'image' : 'video',
      heroVideoUrl: normalizeVideoUrl(row?.heroVideoUrl, ''),
      heroPosterUrl: normalizeMediaToken(row?.heroPosterUrl, 'fallback://hero'),
      heroImageUrl: normalizeMediaToken(row?.heroImageUrl, 'fallback://hero'),
      heroHeadline: row?.heroHeadline || 'Pursue Sacred Knowledge with Rigor & Elegance',
      heroSubheadline:
        row?.heroSubheadline ||
        'A sanctuary of classical Islamic scholarship engineered with immersive real-time classrooms, automated Zoom lecture archives, and global timezone intelligence.',
      customLogoUrl: row?.customLogoUrl || '',
      customNavItems:
        row?.customNavItemsJson &&
        row.customNavItemsJson.length > 0 &&
        !isLegacyDefaultNav(row.customNavItemsJson)
          ? row.customNavItemsJson
          : DEFAULT_NAV_ITEMS,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateSettingsInSql(
  patch: Partial<PlatformSettings>
): Promise<PlatformSettings> {
  try {
    const current = await getSettingsFromSql();
    const next: PlatformSettings = { ...current, ...patch };
    await db
      .update(platformSettings)
      .set({
        heroMode: next.heroMode,
        heroVideoUrl: next.heroVideoUrl,
        heroPosterUrl: next.heroPosterUrl || '',
        heroImageUrl: next.heroImageUrl,
        heroHeadline: next.heroHeadline,
        heroSubheadline: next.heroSubheadline,
        customLogoUrl: next.customLogoUrl || '',
        customNavItemsJson: next.customNavItems || DEFAULT_NAV_ITEMS,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.id, 'platform'));
    return next;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createAttendanceInSql(record: AttendanceRecord): Promise<void> {
  try {
    await ensureInitialSqlBootstrap();
    await db
      .insert(users)
      .values({
        uid: record.studentId,
        email: `${record.studentId}@deenhijrahacademia.edu`,
        firstName: record.studentName.split(' ')[0] || 'Student',
        lastName: record.studentName.split(' ').slice(1).join(' ') || 'User',
        role: 'student',
        gender: 'male',
      })
      .onConflictDoNothing();

    await db.insert(attendanceRecords).values({
      id: record.id,
      courseId: record.courseId,
      scheduleId: record.scheduleId,
      studentUid: record.studentId,
      studentName: record.studentName,
      status: record.status,
      timezoneDetected: record.timezoneDetected,
      verifiedByTeacher: record.verifiedByTeacher,
      timestamp: record.timestamp,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listCourseAttendanceFromSql(
  courseId: string
): Promise<AttendanceRecord[]> {
  try {
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.courseId, courseId));
    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      scheduleId: r.scheduleId,
      studentId: r.studentUid,
      studentName: r.studentName,
      status: r.status as AttendanceRecord['status'],
      timezoneDetected: r.timezoneDetected,
      verifiedByTeacher: r.verifiedByTeacher,
      timestamp: r.timestamp,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createSubmissionInSql(sub: StudentSubmission): Promise<void> {
  try {
    await ensureInitialSqlBootstrap();
    await db
      .insert(users)
      .values({
        uid: sub.studentId,
        email: `${sub.studentId}@deenhijrahacademia.edu`,
        firstName: sub.studentName.split(' ')[0] || 'Student',
        lastName: sub.studentName.split(' ').slice(1).join(' ') || 'User',
        role: 'student',
        gender: 'male',
      })
      .onConflictDoNothing();

    await db.insert(submissions).values({
      id: sub.id,
      assessmentId: sub.assessmentId,
      courseId: sub.courseId,
      studentUid: sub.studentId,
      studentName: sub.studentName,
      type: sub.type,
      content: sub.content || null,
      fileUrl: sub.fileUrl || null,
      fileName: sub.fileName || null,
      quizAnswersJson: sub.quizAnswers || null,
      quizScore: sub.quizScore ?? null,
      grade: sub.grade ?? null,
      maxPoints: sub.maxPoints,
      feedback: sub.feedback || null,
      status: sub.status,
      submittedAt: sub.submittedAt,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listStudentCourseSubmissionsFromSql(
  courseId: string,
  studentUid: string
): Promise<StudentSubmission[]> {
  try {
    const rows = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.courseId, courseId), eq(submissions.studentUid, studentUid)))
      .orderBy(desc(submissions.createdAt));
    return rows.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      courseId: r.courseId,
      studentId: r.studentUid,
      studentName: r.studentName,
      submittedAt: r.submittedAt,
      type: r.type as StudentSubmission['type'],
      content: r.content || undefined,
      fileUrl: r.fileUrl || undefined,
      fileName: r.fileName || undefined,
      quizAnswers: r.quizAnswersJson || undefined,
      quizScore: r.quizScore ?? undefined,
      grade: r.grade ?? undefined,
      maxPoints: r.maxPoints,
      feedback: r.feedback || undefined,
      status: r.status as StudentSubmission['status'],
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listAllSubmissionsFromSql(courseId?: string): Promise<StudentSubmission[]> {
  try {
    const rows = courseId
      ? await db
          .select()
          .from(submissions)
          .where(eq(submissions.courseId, courseId))
          .orderBy(desc(submissions.createdAt))
      : await db.select().from(submissions).orderBy(desc(submissions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      courseId: r.courseId,
      studentId: r.studentUid,
      studentName: r.studentName,
      submittedAt: r.submittedAt,
      type: r.type as StudentSubmission['type'],
      content: r.content || undefined,
      fileUrl: r.fileUrl || undefined,
      fileName: r.fileName || undefined,
      quizAnswers: r.quizAnswersJson || undefined,
      quizScore: r.quizScore ?? undefined,
      grade: r.grade ?? undefined,
      maxPoints: r.maxPoints,
      feedback: r.feedback || undefined,
      status: r.status as StudentSubmission['status'],
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listStudentSubmissionsAllFromSql(
  studentUid: string
): Promise<StudentSubmission[]> {
  try {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.studentUid, studentUid))
      .orderBy(desc(submissions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      courseId: r.courseId,
      studentId: r.studentUid,
      studentName: r.studentName,
      submittedAt: r.submittedAt,
      type: r.type as StudentSubmission['type'],
      content: r.content || undefined,
      fileUrl: r.fileUrl || undefined,
      fileName: r.fileName || undefined,
      quizAnswers: r.quizAnswersJson || undefined,
      quizScore: r.quizScore ?? undefined,
      grade: r.grade ?? undefined,
      maxPoints: r.maxPoints,
      feedback: r.feedback || undefined,
      status: r.status as StudentSubmission['status'],
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listCommunityPostsFromSql(): Promise<CommunityPost[]> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db
      .select()
      .from(communityPosts)
      .orderBy(desc(communityPosts.insertedAt));
    return rows.map((r) => ({
      id: r.id,
      authorId: r.authorUid,
      authorName: r.authorName,
      authorRole: r.authorRole as CommunityPost['authorRole'],
      authorGender: r.authorGender === 'female' ? 'female' : 'male',
      authorAvatar: r.authorAvatar || undefined,
      content: r.content,
      mediaUrl: r.mediaUrl || undefined,
      category: r.category === 'announcement' ? 'announcement' : 'community',
      pinned: r.pinned,
      createdAt: r.createdAt,
      likes: r.likes,
      likedByUserIds: r.likedByUserUidsJson || [],
      comments: r.commentsJson || [],
      flagged: r.flagged,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createCommunityPostInSql(post: CommunityPost): Promise<void> {
  try {
    await db.insert(communityPosts).values({
      id: post.id,
      authorUid: post.authorId,
      authorName: post.authorName,
      authorRole: post.authorRole,
      authorGender: post.authorGender,
      authorAvatar: post.authorAvatar || null,
      content: post.content,
      mediaUrl: post.mediaUrl || null,
      category: post.category,
      pinned: post.pinned,
      flagged: post.flagged,
      likes: post.likes,
      likedByUserUidsJson: post.likedByUserIds || [],
      commentsJson: post.comments || [],
      createdAt: post.createdAt,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateCommunityPostLikesInSql(
  postId: string,
  likes: number,
  likedByUserIds: string[]
): Promise<void> {
  try {
    await db
      .update(communityPosts)
      .set({ likes, likedByUserUidsJson: likedByUserIds })
      .where(eq(communityPosts.id, postId));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateCommunityPostCommentsInSql(
  postId: string,
  comments: PostComment[]
): Promise<void> {
  try {
    await db
      .update(communityPosts)
      .set({ commentsJson: comments })
      .where(eq(communityPosts.id, postId));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listChatMessagesFromSql(filters?: {
  courseId?: string;
  channelId?: string;
}): Promise<ChatMessage[]> {
  try {
    const rows = filters?.courseId
      ? await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.courseId, filters.courseId))
      : filters?.channelId
      ? await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.channelId, filters.channelId))
      : await db.select().from(chatMessages);

    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId || undefined,
      channelId: r.channelId || undefined,
      senderId: r.senderUid,
      senderName: r.senderName,
      senderRole: r.senderRole as ChatMessage['senderRole'],
      senderGender: r.senderGender === 'female' ? 'female' : 'male',
      content: r.content,
      timestamp: r.timestamp,
      flagged: r.flagged,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createChatMessageInSql(msg: ChatMessage): Promise<void> {
  try {
    await db.insert(chatMessages).values({
      id: msg.id,
      courseId: msg.courseId || null,
      channelId: msg.channelId || null,
      senderUid: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      senderGender: msg.senderGender,
      content: msg.content,
      flagged: msg.flagged,
      timestamp: msg.timestamp,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listModerationLogsFromSql(): Promise<ModerationLog[]> {
  try {
    const rows = await db
      .select()
      .from(moderationLogs)
      .orderBy(desc(moderationLogs.createdAt));
    return rows.map((r) => ({
      id: r.id,
      source: r.source as ModerationLog['source'],
      authorId: r.authorUid,
      authorName: r.authorName,
      content: r.content,
      flaggedKeyword: r.flaggedKeyword,
      action: r.action as ModerationLog['action'],
      timestamp: r.timestamp,
      reviewedByMustaqeem: r.reviewedByMustaqeem,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createModerationLogInSql(log: ModerationLog): Promise<void> {
  try {
    await db.insert(moderationLogs).values({
      id: log.id,
      source: log.source,
      authorUid: log.authorId,
      authorName: log.authorName,
      content: log.content,
      flaggedKeyword: log.flaggedKeyword,
      action: log.action,
      reviewedByMustaqeem: log.reviewedByMustaqeem,
      timestamp: log.timestamp,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markModerationReviewedInSql(logId: string): Promise<void> {
  try {
    await db
      .update(moderationLogs)
      .set({ reviewedByMustaqeem: true })
      .where(eq(moderationLogs.id, logId));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listBlogPostsFromSql(): Promise<BlogPost[]> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      authorName: r.authorName,
      authorBadge: r.authorBadge,
      readTime: r.readTime,
      bannerUrl: r.bannerUrl,
      publishedAt: r.publishedAt,
      tags: r.tagsJson || [],
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createBlogPostInSql(post: BlogPost): Promise<void> {
  try {
    await db.insert(blogPosts).values({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      authorName: post.authorName,
      authorBadge: post.authorBadge,
      readTime: post.readTime,
      bannerUrl: post.bannerUrl,
      tagsJson: post.tags || [],
      publishedAt: post.publishedAt,
    });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function findOrCreateStudentByEmailInSql(params: {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  email: string;
}): Promise<User> {
  try {
    await ensureInitialSqlBootstrap();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, params.email));

    if (existing[0]) {
      const row = existing[0];
      return {
        id: row.uid,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        role: row.role as User['role'],
        gender: row.gender === 'female' ? 'female' : 'male',
        avatarUrl: row.avatarUrl || undefined,
        avatarStoragePath: row.avatarStoragePath || undefined,
        timezone: row.timezone || undefined,
        hasCustomPassword: Boolean(row.accessCode),
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
        lastActive: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
      };
    }

    const uid = `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        role: 'student',
        gender: params.gender,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.uid,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role as User['role'],
      gender: row.gender === 'female' ? 'female' : 'male',
      timezone: row.timezone || undefined,
      hasCustomPassword: Boolean(row.accessCode),
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
      lastActive: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getCourseByIdFromSql(courseId: string): Promise<Course | null> {
  const all = await listCoursesFromSql();
  return all.find((c) => c.id === courseId) || null;
}

export async function updateCourseInSql(
  courseId: string,
  patch: Partial<Course>
): Promise<Course | null> {
  try {
    const current = await getCourseByIdFromSql(courseId);
    if (!current) return null;

    const merged: Course = { ...current, ...patch, id: current.id };
    await db
      .update(courses)
      .set({
        code: merged.code,
        title: merged.title,
        description: merged.description,
        instructorId: merged.instructorId,
        instructorName: merged.instructorName,
        status: merged.status,
        level: merged.level,
        thumbnail: merged.thumbnail,
        totalLectures: merged.totalLectures,
        maxSpots: Math.max(1, Number(merged.maxSpots) || 50),
        durationLabel: (merged.durationLabel || '12 Weeks').trim(),
        enrollmentDeadlineUtc: (merged.enrollmentDeadlineUtc || '').trim(),
        modulesJson: merged.modules || [],
        schedulesJson: merged.schedules || [],
        materialsJson: merged.materials || [],
        assignmentsJson: merged.assignments || [],
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId));

    return merged;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function gradeSubmissionInSql(
  submissionId: string,
  grade: number,
  feedback: string
): Promise<StudentSubmission | null> {
  try {
    const updated = await db
      .update(submissions)
      .set({
        grade,
        feedback,
        status: 'graded',
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    const r = updated[0];
    if (!r) return null;
    return {
      id: r.id,
      assessmentId: r.assessmentId,
      courseId: r.courseId,
      studentId: r.studentUid,
      studentName: r.studentName,
      submittedAt: r.submittedAt,
      type: r.type as StudentSubmission['type'],
      content: r.content || undefined,
      fileUrl: r.fileUrl || undefined,
      fileName: r.fileName || undefined,
      quizAnswers: r.quizAnswersJson || undefined,
      quizScore: r.quizScore ?? undefined,
      grade: r.grade ?? undefined,
      maxPoints: r.maxPoints,
      feedback: r.feedback || undefined,
      status: r.status as StudentSubmission['status'],
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function toggleCommunityPostLikeInSql(
  postId: string,
  userId: string
): Promise<CommunityPost | null> {
  try {
    const rows = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    const r = rows[0];
    if (!r) return null;

    const liked = [...(r.likedByUserUidsJson || [])];
    const idx = liked.indexOf(userId);
    let likes = r.likes;
    if (idx > -1) {
      liked.splice(idx, 1);
      likes = Math.max(0, likes - 1);
    } else {
      liked.push(userId);
      likes += 1;
    }

    await db
      .update(communityPosts)
      .set({ likes, likedByUserUidsJson: liked })
      .where(eq(communityPosts.id, postId));

    return {
      id: r.id,
      authorId: r.authorUid,
      authorName: r.authorName,
      authorRole: r.authorRole as CommunityPost['authorRole'],
      authorGender: r.authorGender === 'female' ? 'female' : 'male',
      authorAvatar: r.authorAvatar || undefined,
      content: r.content,
      mediaUrl: r.mediaUrl || undefined,
      category: r.category === 'announcement' ? 'announcement' : 'community',
      pinned: r.pinned,
      createdAt: r.createdAt,
      likes,
      likedByUserIds: liked,
      comments: r.commentsJson || [],
      flagged: r.flagged,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function addCommunityPostCommentInSql(
  postId: string,
  comment: PostComment
): Promise<PostComment | null> {
  try {
    const rows = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    const r = rows[0];
    if (!r) return null;

    const nextComments = [...(r.commentsJson || []), comment];
    await db
      .update(communityPosts)
      .set({ commentsJson: nextComments })
      .where(eq(communityPosts.id, postId));

    return comment;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listStudentAttendanceFromSql(
  courseId: string,
  studentUid: string
): Promise<AttendanceRecord[]> {
  try {
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.courseId, courseId),
          eq(attendanceRecords.studentUid, studentUid)
        )
      );
    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      scheduleId: r.scheduleId,
      studentId: r.studentUid,
      studentName: r.studentName,
      status: r.status as AttendanceRecord['status'],
      timezoneDetected: r.timezoneDetected,
      verifiedByTeacher: r.verifiedByTeacher,
      timestamp: r.timestamp,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listAttendanceByStudentAllFromSql(
  studentUid: string
): Promise<AttendanceRecord[]> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentUid, studentUid))
      .orderBy(desc(attendanceRecords.createdAt));
    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      scheduleId: r.scheduleId,
      studentId: r.studentUid,
      studentName: r.studentName,
      status: r.status as AttendanceRecord['status'],
      timezoneDetected: r.timezoneDetected,
      verifiedByTeacher: r.verifiedByTeacher,
      timestamp: r.timestamp,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserSqlSummary(userUid: string): Promise<{
  enrolledCourseIds: string[];
  attendanceRecords: AttendanceRecord[];
}> {
  try {
    await ensureInitialSqlBootstrap();
    const [enrollRows, attRows] = await Promise.all([
      db.select().from(enrollments).where(eq(enrollments.userUid, userUid)),
      db.select().from(attendanceRecords).where(eq(attendanceRecords.studentUid, userUid)),
    ]);

    return {
      enrolledCourseIds: enrollRows
        .filter((e) => e.status === 'active' || e.status === 'completed')
        .map((e) => e.courseId),
      attendanceRecords: attRows.map((r) => ({
        id: r.id,
        courseId: r.courseId,
        scheduleId: r.scheduleId,
        studentId: r.studentUid,
        studentName: r.studentName,
        status: r.status as AttendanceRecord['status'],
        timezoneDetected: r.timezoneDetected,
        verifiedByTeacher: r.verifiedByTeacher,
        timestamp: r.timestamp,
      })),
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function verifyRecordingAccessInSql(
  courseId: string,
  recordingId: string,
  userUid: string,
  userEmail?: string
): Promise<{
  found: boolean;
  authorized: boolean;
  isOrientation: boolean;
  enrolled: boolean;
  isChancellor: boolean;
  recording?: CompletedVideoArchive;
}> {
  try {
    const recRows = await db
      .select()
      .from(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.courseId, courseId)));
    const rec = recRows[0];
    if (!rec) {
      return {
        found: false,
        authorized: false,
        isOrientation: false,
        enrolled: false,
        isChancellor: false,
      };
    }

    const isChancellor = userEmail?.toLowerCase() === 'mustaqeemshaikh004@gmail.com';
    const enrolled = await isStudentEnrolledInSql(courseId, userUid);
    const authorized = isChancellor || rec.isOrientation || enrolled;

    return {
      found: true,
      authorized,
      isOrientation: rec.isOrientation,
      enrolled,
      isChancellor,
      recording: {
        id: rec.id,
        title: rec.title,
        duration: rec.duration,
        recordedAt: rec.recordedAt,
        videoUrl: authorized ? rec.videoUrl : '',
        storagePath: authorized ? rec.storagePath || undefined : undefined,
        teaserUrl: rec.teaserUrl || undefined,
        teaserStoragePath: rec.teaserStoragePath || undefined,
        thumbnailUrl: rec.thumbnailUrl || undefined,
        thumbnailStoragePath: rec.thumbnailStoragePath || undefined,
        supplementaryPdfUrl: authorized ? rec.supplementaryPdfUrl || undefined : undefined,
        supplementaryPdfName: authorized ? rec.supplementaryPdfName || undefined : undefined,
        supplementaryPdfStoragePath: authorized ? rec.supplementaryPdfStoragePath || undefined : undefined,
        mimeType: 'video/mp4',
        nonDownloadable: rec.nonDownloadable,
        nonShareable: rec.nonShareable,
        isOrientation: rec.isOrientation,
        syncedFromZoomWebhook: rec.syncedFromZoomWebhook,
        fileSize: rec.fileSize,
      },
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==================== PINNED EVENTS & CALENDAR REPOSITORY ====================

function mapCalendarEventRow(r: typeof calendarEvents.$inferSelect): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    posterUrl: r.posterUrl || undefined,
    courseId: r.courseId || undefined,
    courseTitle: r.courseTitle || undefined,
    startUtc: r.startUtc,
    endUtc: r.endUtc,
    dateStr: r.dateStr || undefined,
    dayOfWeek: r.dayOfWeek || undefined,
    timeUtc: r.timeUtc || undefined,
    instructorId: r.instructorId || undefined,
    instructorName: r.instructorName || undefined,
    meetingId: r.meetingId || undefined,
    meetingPasscode: r.meetingPasscode || undefined,
    joinUrl: r.joinUrl || undefined,
    hostStartUrl: r.hostStartUrl || undefined,
    isLiveNow: r.isLiveNow,
    autoRecord: r.autoRecord,
    type: (r.type as CalendarEvent['type']) || 'event',
    pinnedToBoard: r.pinnedToBoard,
    pinColor: (r.pinColor as CalendarEvent['pinColor']) || 'aqua',
    locationOrLabel: r.locationOrLabel || 'Global Online Sanctuary',
    isDerived: false,
  };
}

export async function listEventsFromSql(): Promise<CalendarEvent[]> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db
      .select()
      .from(calendarEvents)
      .orderBy(desc(calendarEvents.createdAt));

    return rows.map(mapCalendarEventRow);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createEventInSql(ev: CalendarEvent): Promise<CalendarEvent> {
  try {
    await ensureInitialSqlBootstrap();
    const inserted = await db
      .insert(calendarEvents)
      .values({
        id: ev.id,
        title: ev.title,
        description: ev.description || '',
        posterUrl: ev.posterUrl || '',
        courseId: ev.courseId || null,
        courseTitle: ev.courseTitle || null,
        startUtc: ev.startUtc,
        endUtc: ev.endUtc || ev.startUtc,
        dateStr: ev.dateStr || '',
        dayOfWeek: ev.dayOfWeek || '',
        timeUtc: ev.timeUtc || '',
        instructorId: ev.instructorId || '',
        instructorName: ev.instructorName || '',
        meetingId: ev.meetingId || '',
        meetingPasscode: ev.meetingPasscode || '',
        joinUrl: ev.joinUrl || '',
        hostStartUrl: ev.hostStartUrl || '',
        isLiveNow: Boolean(ev.isLiveNow),
        autoRecord: ev.autoRecord ?? true,
        type: ev.type || 'event',
        pinnedToBoard: ev.pinnedToBoard ?? true,
        pinColor: ev.pinColor || 'aqua',
        locationOrLabel: ev.locationOrLabel || 'Global Online Sanctuary',
      })
      .onConflictDoUpdate({
        target: calendarEvents.id,
        set: {
          title: ev.title,
          description: ev.description || '',
          posterUrl: ev.posterUrl || '',
          courseId: ev.courseId || null,
          courseTitle: ev.courseTitle || null,
          startUtc: ev.startUtc,
          endUtc: ev.endUtc || ev.startUtc,
          dateStr: ev.dateStr || '',
          dayOfWeek: ev.dayOfWeek || '',
          timeUtc: ev.timeUtc || '',
          instructorId: ev.instructorId || '',
          instructorName: ev.instructorName || '',
          meetingId: ev.meetingId || '',
          meetingPasscode: ev.meetingPasscode || '',
          joinUrl: ev.joinUrl || '',
          hostStartUrl: ev.hostStartUrl || '',
          isLiveNow: Boolean(ev.isLiveNow),
          autoRecord: ev.autoRecord ?? true,
          type: ev.type || 'event',
          pinnedToBoard: ev.pinnedToBoard ?? true,
          pinColor: ev.pinColor || 'aqua',
          locationOrLabel: ev.locationOrLabel || 'Global Online Sanctuary',
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapCalendarEventRow(inserted[0]);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateEventInSql(
  id: string,
  patch: Partial<CalendarEvent>
): Promise<CalendarEvent | null> {
  try {
    const updated = await db
      .update(calendarEvents)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.posterUrl !== undefined ? { posterUrl: patch.posterUrl || '' } : {}),
        ...(patch.courseId !== undefined ? { courseId: patch.courseId || null } : {}),
        ...(patch.courseTitle !== undefined ? { courseTitle: patch.courseTitle || null } : {}),
        ...(patch.startUtc !== undefined ? { startUtc: patch.startUtc } : {}),
        ...(patch.endUtc !== undefined ? { endUtc: patch.endUtc } : {}),
        ...(patch.dateStr !== undefined ? { dateStr: patch.dateStr || '' } : {}),
        ...(patch.dayOfWeek !== undefined ? { dayOfWeek: patch.dayOfWeek || '' } : {}),
        ...(patch.timeUtc !== undefined ? { timeUtc: patch.timeUtc || '' } : {}),
        ...(patch.instructorId !== undefined ? { instructorId: patch.instructorId || '' } : {}),
        ...(patch.instructorName !== undefined ? { instructorName: patch.instructorName || '' } : {}),
        ...(patch.meetingId !== undefined ? { meetingId: patch.meetingId || '' } : {}),
        ...(patch.meetingPasscode !== undefined ? { meetingPasscode: patch.meetingPasscode || '' } : {}),
        ...(patch.joinUrl !== undefined ? { joinUrl: patch.joinUrl || '' } : {}),
        ...(patch.hostStartUrl !== undefined ? { hostStartUrl: patch.hostStartUrl || '' } : {}),
        ...(patch.isLiveNow !== undefined ? { isLiveNow: Boolean(patch.isLiveNow) } : {}),
        ...(patch.autoRecord !== undefined ? { autoRecord: Boolean(patch.autoRecord) } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.pinnedToBoard !== undefined
          ? { pinnedToBoard: Boolean(patch.pinnedToBoard) }
          : {}),
        ...(patch.pinColor !== undefined ? { pinColor: patch.pinColor } : {}),
        ...(patch.locationOrLabel !== undefined
          ? { locationOrLabel: patch.locationOrLabel }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, id))
      .returning();

    const r = updated[0];
    if (!r) return null;
    return mapCalendarEventRow(r);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteEventInSql(id: string): Promise<boolean> {
  try {
    const deleted = await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==================== PERSISTENT ASSET BLOB STORAGE ====================

export async function createUploadedAssetInSql(asset: {
  id: string;
  kind: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  dataBase64: string;
}): Promise<void> {
  try {
    await db
      .insert(uploadedAssets)
      .values(asset)
      .onConflictDoUpdate({
        target: uploadedAssets.id,
        set: {
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          sizeBytes: asset.sizeBytes,
          dataBase64: asset.dataBase64,
        },
      });
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUploadedAssetFromSql(id: string): Promise<{
  id: string;
  kind: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  dataBase64: string;
} | null> {
  try {
    const rows = await db
      .select()
      .from(uploadedAssets)
      .where(eq(uploadedAssets.id, id));
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      kind: r.kind,
      mimeType: r.mimeType,
      fileName: r.fileName,
      sizeBytes: r.sizeBytes,
      dataBase64: r.dataBase64,
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==================== PERSISTENT AUTH SESSIONS ====================

export async function createAuthSessionInSql(params: {
  token: string;
  userUid: string;
  email: string;
  role: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    await ensureInitialSqlBootstrap();
    await db.insert(authSessions).values(params).onConflictDoNothing();
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getAuthSessionFromSql(token: string): Promise<{
  token: string;
  user: User;
  role: string;
} | null> {
  try {
    await ensureInitialSqlBootstrap();
    const rows = await db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.token, token), gt(authSessions.expiresAt, new Date())));
    const sess = rows[0];
    if (!sess) return null;

    const uRows = await db.select().from(users).where(eq(users.uid, sess.userUid));
    const row = uRows[0];
    if (!row) return null;

    return {
      token: sess.token,
      role: row.role,
      user: {
        id: row.uid,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        role: row.role as User['role'],
        gender: row.gender === 'female' ? 'female' : 'male',
        avatarUrl: row.avatarUrl || undefined,
        avatarStoragePath: row.avatarStoragePath || undefined,
        timezone: row.timezone || undefined,
        hasCustomPassword: Boolean(row.accessCode),
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
        lastActive: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAuthSessionFromSql(token: string): Promise<void> {
  try {
    await db.delete(authSessions).where(eq(authSessions.token, token));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

