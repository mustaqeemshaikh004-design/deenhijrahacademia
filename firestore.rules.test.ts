import fs from 'node:fs';
import path from 'node:path';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'stalwart-meridian-vsmzh';
const CHANCELLOR_EMAIL = 'mustaqeemshaikh004@gmail.com';
const CHANCELLOR_UID = 'admin-mustaqeem';

const hasEmulatorConfig = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe('Deen Hijrah Academia Firestore Security Rules — Dirty Dozen & Master Gate Suite', { skip: !hasEmulatorConfig }, () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const now = serverTimestamp();

      await setDoc(doc(db, 'admins', CHANCELLOR_UID), {
        uid: CHANCELLOR_UID,
        email: CHANCELLOR_EMAIL,
        role: 'admin',
        grantedAt: now,
      });

      await setDoc(doc(db, 'courses', 'course-seerah-101'), {
        id: 'course-seerah-101',
        code: 'DHA-SRH101',
        title: 'Prophetic Biography (Seerah)',
        description: 'Foundational Seerah cohort',
        instructorId: 'teacher-umar',
        instructorName: 'Shaykh Umar Al-Madani',
        status: 'Open for Enrollment',
        level: 'Beginner',
        thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
        totalLectures: 12,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'courses', 'course-seerah-101', 'recordings', 'rec-orientation-1'), {
        id: 'rec-orientation-1',
        courseId: 'course-seerah-101',
        title: 'Orientation Lecture',
        duration: '45 min',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
        storagePath: 'courses/course-seerah-101/recordings/rec-orientation-1.mp4',
        videoUrl: '',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        nonShareable: true,
        isOrientation: true,
        uploadedBy: CHANCELLOR_UID,
        syncedFromZoomWebhook: false,
        fileSize: '120 MB',
        recordedAt: '2026-01-01T00:00:00.000Z',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'courses', 'course-seerah-101', 'recordings', 'rec-private-1'), {
        id: 'rec-private-1',
        courseId: 'course-seerah-101',
        title: 'Private Cohort Lecture 2',
        duration: '60 min',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        videoUrl: '',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        nonShareable: true,
        isOrientation: false,
        uploadedBy: CHANCELLOR_UID,
        syncedFromZoomWebhook: false,
        fileSize: '210 MB',
        recordedAt: '2026-01-02T00:00:00.000Z',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'courses', 'course-seerah-101', 'enrollments', 'student-enrolled'), {
        userId: 'student-enrolled',
        courseId: 'course-seerah-101',
        status: 'active',
        enrolledAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'courses', 'course-seerah-101', 'enrollments', 'student-revoked'), {
        userId: 'student-revoked',
        courseId: 'course-seerah-101',
        status: 'revoked',
        enrolledAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'student-alice'), {
        id: 'student-alice',
        role: 'student',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'student-alice', 'public', 'profile'), {
        id: 'student-alice',
        firstName: 'Alice',
        lastName: 'Khan',
        gender: 'female',
        visibility: 'public',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'student-bob', 'private', 'info'), {
        id: 'student-bob',
        email: 'bob.khan@deenhijrahacademia.edu',
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  test('Dirty Dozen #1: Rejects identity spoofing in streamRequests', async () => {
    const db = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'courses', 'course-seerah-101', 'streamRequests', 'req-spoof-1'), {
        id: 'req-spoof-1',
        courseId: 'course-seerah-101',
        recordingId: 'rec-private-1',
        userId: 'student-enrolled',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        accessType: 'enrolled_stream',
        requestedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #2: Rejects self-assigned admin role escalation', async () => {
    const db = testEnv.authenticatedContext('student-mallory', { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'users', 'student-mallory'), {
        id: 'student-mallory',
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #3: Rejects unverified chancellor email spoofing', async () => {
    const db = testEnv
      .authenticatedContext('attacker-uid', { email: CHANCELLOR_EMAIL, email_verified: false })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'courses', 'course-spoofed'), {
        id: 'course-spoofed',
        code: 'DHA-HACK',
        title: 'Spoofed Course',
        description: 'Unauthorized creation',
        instructorId: 'attacker-uid',
        instructorName: 'Attacker',
        status: 'Active',
        level: 'Beginner',
        thumbnail: '',
        totalLectures: 1,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #4: Rejects shadow field injection on user profile update', async () => {
    const db = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'student-alice', 'public', 'profile'), {
        isAdmin: true,
        updatedAt: serverTimestamp(),
      } as Record<string, unknown>)
    );
  });

  test('Dirty Dozen #5: Rejects non-enrolled private MP4 recording fetch & stream request', async () => {
    const db = testEnv.authenticatedContext('student-unenrolled', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'courses', 'course-seerah-101', 'recordings', 'rec-private-1')));
    await assertFails(
      setDoc(doc(db, 'courses', 'course-seerah-101', 'streamRequests', 'req-unauth-stream'), {
        id: 'req-unauth-stream',
        courseId: 'course-seerah-101',
        recordingId: 'rec-private-1',
        userId: 'student-unenrolled',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        accessType: 'enrolled_stream',
        requestedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #6: Rejects nonDownloadable=false tampering on enrolled streamRequest', async () => {
    const db = testEnv.authenticatedContext('student-enrolled', { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'courses', 'course-seerah-101', 'streamRequests', 'req-download-bypass'), {
        id: 'req-download-bypass',
        courseId: 'course-seerah-101',
        recordingId: 'rec-private-1',
        userId: 'student-enrolled',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        mimeType: 'video/mp4',
        nonDownloadable: false,
        accessType: 'enrolled_stream',
        requestedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #7: Rejects storagePath swap onto orientation streamRequest', async () => {
    const db = testEnv.authenticatedContext('student-unenrolled', { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'courses', 'course-seerah-101', 'streamRequests', 'req-path-swap'), {
        id: 'req-path-swap',
        courseId: 'course-seerah-101',
        recordingId: 'rec-orientation-1',
        userId: 'student-unenrolled',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        accessType: 'orientation_preview',
        requestedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #8: Rejects self-reactivation of revoked enrollment status', async () => {
    const db = testEnv.authenticatedContext('student-revoked', { email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(db, 'courses', 'course-seerah-101', 'enrollments', 'student-revoked'), {
        status: 'active',
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #9: Rejects malformed document IDs (ID poisoning)', async () => {
    const db = testEnv
      .authenticatedContext(CHANCELLOR_UID, { email: CHANCELLOR_EMAIL, email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'courses', 'bad$id..traversal'), {
        id: 'bad$id..traversal',
        code: 'DHA-01',
        title: 'Poisoned',
        description: 'Invalid ID characters',
        instructorId: CHANCELLOR_UID,
        instructorName: 'Mustaqeem',
        status: 'Active',
        level: 'Beginner',
        thumbnail: '',
        totalLectures: 1,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #10: Rejects cross-user PII email reads & list scraping', async () => {
    const db = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'users', 'student-bob', 'private', 'info')));
    await assertFails(getDocs(collection(db, 'users', 'student-bob', 'private')));
  });

  test('Dirty Dozen #11: Rejects cross-resource avatar storagePath injection', async () => {
    const db = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'student-alice', 'public', 'profile'), {
        avatarStoragePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Dirty Dozen #12: Rejects oversized content & client-forged timestamp', async () => {
    const db = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'communityPosts', 'post-poison'), {
        id: 'post-poison',
        authorId: 'student-alice',
        authorName: 'Alice',
        authorRole: 'student',
        authorGender: 'female',
        content: 'A'.repeat(5001),
        category: 'announcement',
        pinned: true,
        flagged: false,
        likes: 999999,
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2020-01-01T00:00:00Z',
      })
    );
  });

  test('Authorized Path: Enrolled student can read private MP4 recording & issue non-downloadable streamRequest', async () => {
    const db = testEnv.authenticatedContext('student-enrolled', { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'courses', 'course-seerah-101', 'recordings', 'rec-private-1')));
    await assertSucceeds(
      setDoc(doc(db, 'courses', 'course-seerah-101', 'streamRequests', 'req-valid-1'), {
        id: 'req-valid-1',
        courseId: 'course-seerah-101',
        recordingId: 'rec-private-1',
        userId: 'student-enrolled',
        storagePath: 'courses/course-seerah-101/recordings/rec-private-1.mp4',
        mimeType: 'video/mp4',
        nonDownloadable: true,
        accessType: 'enrolled_stream',
        requestedAt: serverTimestamp(),
      })
    );
    const orientationQuery = query(
      collection(db, 'courses', 'course-seerah-101', 'recordings'),
      where('isOrientation', '==', true),
      where('nonDownloadable', '==', true)
    );
    assert.ok(await assertSucceeds(getDocs(orientationQuery)));
  });

  test('Blocks direct like counter inflation without atomic /likes receipt & non-admin blog writes', async () => {
    const adminDb = testEnv
      .authenticatedContext(CHANCELLOR_UID, { email: CHANCELLOR_EMAIL, email_verified: true })
      .firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, 'communityPosts', 'post-clean-1'), {
        id: 'post-clean-1',
        authorId: CHANCELLOR_UID,
        authorName: 'Mustaqeem Shaikh',
        authorRole: 'admin',
        authorGender: 'male',
        content: 'Welcome to the Autumn Term.',
        category: 'announcement',
        pinned: true,
        flagged: false,
        likes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    const studentDb = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(studentDb, 'communityPosts', 'post-clean-1'), {
        likes: 50,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(studentDb, 'blogPosts', 'blog-unauth-1'), {
        id: 'blog-unauth-1',
        title: 'Unauthorized Article',
        excerpt: 'Should be rejected',
        content: 'Blocked body',
        authorName: 'Alice',
        authorBadge: 'Student',
        readTime: '2 min',
        bannerUrl: '',
        tags: [],
        isPublished: true,
        publishedAt: '2026-01-01T00:00:00.000Z',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('UserPreferences: Owner can create, read, and update UI theme preference; blocks cross-user access & invalid values', async () => {
    const aliceDb = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('student-bob', { email_verified: true }).firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui'), {
        id: 'ui',
        userId: 'student-alice',
        theme: 'light',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(getDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui')));
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui'), {
        theme: 'dark',
        readNotificationIds: ['evt:evt-1', 'rec:course-seerah-101:rec-private-1'],
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-user read & write rejected
    await assertFails(getDoc(doc(bobDb, 'users', 'student-alice', 'preferences', 'ui')));
    await assertFails(
      updateDoc(doc(bobDb, 'users', 'student-alice', 'preferences', 'ui'), {
        theme: 'light',
        updatedAt: serverTimestamp(),
      })
    );

    // Invalid theme enum, invalid readNotificationIds, or shadow field rejected
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui'), {
        theme: 'neon',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui'), {
        readNotificationIds: Array.from({ length: 101 }, (_, idx) => `id-${idx}`),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'student-alice', 'preferences', 'ui'), {
        theme: 'light',
        isAdmin: true,
        updatedAt: serverTimestamp(),
      } as Record<string, unknown>)
    );
  });

  test('CourseReviews & InstructorReviews: Authors can publish/edit their own bounded 1-5 reviews; blocks spoofing, out-of-range ratings, and cross-user edits', async () => {
    const aliceDb = testEnv.authenticatedContext('student-alice', { email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('student-bob', { email_verified: true }).firestore();

    const validCourseReviewId = 'course-seerah-101_student-alice';
    await assertSucceeds(
      setDoc(doc(aliceDb, 'courseReviews', validCourseReviewId), {
        id: validCourseReviewId,
        courseId: 'course-seerah-101',
        authorId: 'student-alice',
        authorName: 'Alice Khan',
        authorGender: 'female',
        rating: 5,
        comment: 'Deeply structured Seerah methodology and clear timeline breakdowns.',
        isVerifiedEnrollment: true,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    const validInstructorReviewId = 'teacher-umar_student-alice';
    await assertSucceeds(
      setDoc(doc(aliceDb, 'instructorReviews', validInstructorReviewId), {
        id: validInstructorReviewId,
        instructorId: 'teacher-umar',
        instructorName: 'Shaykh Umar Al-Madani',
        authorId: 'student-alice',
        authorName: 'Alice Khan',
        authorGender: 'female',
        courseId: 'course-seerah-101',
        courseTitle: 'Prophetic Biography (Seerah)',
        rating: 5,
        comment: 'Patient pedagogy with primary source references in every class.',
        isVerifiedStudent: true,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Public list of published reviews succeeds
    const reviewsQuery = query(collection(bobDb, 'courseReviews'), where('isPublished', '==', true));
    assert.ok(await assertSucceeds(getDocs(reviewsQuery)));

    // Author can update their own review rating & comment
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'courseReviews', validCourseReviewId), {
        rating: 4,
        comment: 'Updated thoughtful review after completing Module 3.',
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-user tamper rejected
    await assertFails(
      updateDoc(doc(bobDb, 'courseReviews', validCourseReviewId), {
        rating: 1,
        comment: 'Sabotaged comment',
        updatedAt: serverTimestamp(),
      })
    );

    // Out-of-range rating & author spoofing rejected
    await assertFails(
      setDoc(doc(bobDb, 'courseReviews', 'course-seerah-101_student-bob'), {
        id: 'course-seerah-101_student-bob',
        courseId: 'course-seerah-101',
        authorId: 'student-bob',
        authorName: 'Bob',
        authorGender: 'male',
        rating: 6,
        comment: 'Invalid star score',
        isVerifiedEnrollment: false,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertFails(
      setDoc(doc(bobDb, 'instructorReviews', 'teacher-umar_student-alice'), {
        id: 'teacher-umar_student-alice',
        instructorId: 'teacher-umar',
        instructorName: 'Shaykh Umar Al-Madani',
        authorId: 'student-alice',
        authorName: 'Spoofed Alice',
        authorGender: 'female',
        rating: 1,
        comment: 'Impersonated review',
        isVerifiedStudent: false,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });
});

