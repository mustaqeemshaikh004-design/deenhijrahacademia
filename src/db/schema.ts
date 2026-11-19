import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  AcademicAssessment,
  CourseMaterial,
  CourseModule,
  CustomNavItem,
  LiveSchedule,
  PostComment,
} from '../types.ts';

// 1. Users Table (Linked via Firebase Auth UID or Institutional ID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull().default('Scholar'),
  lastName: text('last_name').notNull().default('User'),
  role: text('role').notNull().default('student'),
  gender: text('gender').notNull().default('male'),
  accessCode: text('access_code'),
  avatarUrl: text('avatar_url'),
  avatarStoragePath: text('avatar_storage_path'),
  timezone: text('timezone'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 2. Courses Catalog Table
export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  instructorId: text('instructor_id').notNull(),
  instructorName: text('instructor_name').notNull(),
  status: text('status').notNull().default('Open for Enrollment'),
  level: text('level').notNull().default('Beginner'),
  thumbnail: text('thumbnail').notNull(),
  totalLectures: integer('total_lectures').notNull().default(12),
  maxSpots: integer('max_spots').notNull().default(50),
  durationLabel: text('duration_label').notNull().default('12 Weeks'),
  enrollmentDeadlineUtc: text('enrollment_deadline_utc').notNull().default(''),
  modulesJson: jsonb('modules_json').$type<CourseModule[]>().notNull().default([]),
  schedulesJson: jsonb('schedules_json').$type<LiveSchedule[]>().notNull().default([]),
  materialsJson: jsonb('materials_json').$type<CourseMaterial[]>().notNull().default([]),
  assignmentsJson: jsonb('assignments_json').$type<AcademicAssessment[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Course Enrollments Join Table (Master Access Gate for Private Recordings)
export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    courseId: text('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    userUid: text('user_uid')
      .references(() => users.uid, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('active'),
    enrolledAt: timestamp('enrolled_at').defaultNow(),
  },
  (table) => [uniqueIndex('enrollments_course_user_idx').on(table.courseId, table.userUid)]
);

// 4. Course MP4 Recordings Table (Linked to Firebase Storage Paths & DRM Policy)
export const recordings = pgTable('recordings', {
  id: text('id').primaryKey(),
  courseId: text('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  duration: text('duration').notNull(),
  videoUrl: text('video_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  teaserUrl: text('teaser_url').notNull().default(''),
  teaserStoragePath: text('teaser_storage_path').notNull().default(''),
  thumbnailUrl: text('thumbnail_url').notNull().default(''),
  thumbnailStoragePath: text('thumbnail_storage_path').notNull().default(''),
  supplementaryPdfUrl: text('supplementary_pdf_url').notNull().default(''),
  supplementaryPdfName: text('supplementary_pdf_name').notNull().default(''),
  supplementaryPdfStoragePath: text('supplementary_pdf_storage_path').notNull().default(''),
  mimeType: text('mime_type').notNull().default('video/mp4'),
  nonDownloadable: boolean('non_downloadable').notNull().default(true),
  nonShareable: boolean('non_shareable').notNull().default(true),
  isOrientation: boolean('is_orientation').notNull().default(false),
  syncedFromZoomWebhook: boolean('synced_from_zoom_webhook').notNull().default(false),
  fileSize: text('file_size').notNull().default('150 MB'),
  recordedAt: text('recorded_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Attendance Logs Table
export const attendanceRecords = pgTable('attendance_records', {
  id: text('id').primaryKey(),
  courseId: text('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  scheduleId: text('schedule_id').notNull(),
  studentUid: text('student_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  studentName: text('student_name').notNull(),
  status: text('status').notNull(),
  timezoneDetected: text('timezone_detected').notNull(),
  verifiedByTeacher: boolean('verified_by_teacher').notNull().default(true),
  timestamp: text('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Student Submissions & Auto-Graded Assessments Table
export const submissions = pgTable('submissions', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull(),
  courseId: text('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  studentUid: text('student_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  studentName: text('student_name').notNull(),
  type: text('type').notNull(),
  content: text('content'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  quizAnswersJson: jsonb('quiz_answers_json').$type<number[]>(),
  quizScore: integer('quiz_score'),
  grade: integer('grade'),
  maxPoints: integer('max_points').notNull(),
  feedback: text('feedback'),
  status: text('status').notNull(),
  submittedAt: text('submitted_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Community Feed Posts Table
export const communityPosts = pgTable('community_posts', {
  id: text('id').primaryKey(),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role').notNull(),
  authorGender: text('author_gender').notNull(),
  authorAvatar: text('author_avatar'),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  category: text('category').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  flagged: boolean('flagged').notNull().default(false),
  likes: integer('likes').notNull().default(0),
  likedByUserUidsJson: jsonb('liked_by_user_uids_json').$type<string[]>().notNull().default([]),
  commentsJson: jsonb('comments_json').$type<PostComment[]>().notNull().default([]),
  createdAt: text('created_at').notNull(),
  insertedAt: timestamp('inserted_at').defaultNow(),
});

// 8. Real-Time Chat Messages Table
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  courseId: text('course_id'),
  channelId: text('channel_id'),
  senderUid: text('sender_uid').notNull(),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role').notNull(),
  senderGender: text('sender_gender').notNull(),
  content: text('content').notNull(),
  flagged: boolean('flagged').notNull().default(false),
  timestamp: text('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Automated Safety & Moderation Logs Table
export const moderationLogs = pgTable('moderation_logs', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  content: text('content').notNull(),
  flaggedKeyword: text('flagged_keyword').notNull(),
  action: text('action').notNull(),
  reviewedByMustaqeem: boolean('reviewed_by_mustaqeem').notNull().default(false),
  timestamp: text('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Blogs & Articles Table
export const blogPosts = pgTable('blog_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  content: text('content').notNull(),
  authorName: text('author_name').notNull(),
  authorBadge: text('author_badge').notNull(),
  readTime: text('read_time').notNull(),
  bannerUrl: text('banner_url').notNull(),
  tagsJson: jsonb('tags_json').$type<string[]>().notNull().default([]),
  publishedAt: text('published_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Platform Hero & Branding Settings Table
export const platformSettings = pgTable('platform_settings', {
  id: text('id').primaryKey(),
  heroMode: text('hero_mode').notNull().default('video'),
  heroVideoUrl: text('hero_video_url').notNull(),
  heroPosterUrl: text('hero_poster_url').notNull().default(''),
  heroImageUrl: text('hero_image_url').notNull(),
  heroHeadline: text('hero_headline').notNull(),
  heroSubheadline: text('hero_subheadline').notNull(),
  customLogoUrl: text('custom_logo_url').notNull().default(''),
  customNavItemsJson: jsonb('custom_nav_items_json').$type<CustomNavItem[]>().notNull().default([]),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 12. Pinned Poster Board & Calendar Events Table
export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  posterUrl: text('poster_url').notNull().default(''),
  courseId: text('course_id'),
  courseTitle: text('course_title'),
  startUtc: text('start_utc').notNull(),
  endUtc: text('end_utc').notNull(),
  dateStr: text('date_str').notNull().default(''),
  dayOfWeek: text('day_of_week').notNull().default(''),
  timeUtc: text('time_utc').notNull().default(''),
  instructorId: text('instructor_id').notNull().default(''),
  instructorName: text('instructor_name').notNull().default(''),
  meetingId: text('meeting_id').notNull().default(''),
  meetingPasscode: text('meeting_passcode').notNull().default(''),
  joinUrl: text('join_url').notNull().default(''),
  hostStartUrl: text('host_start_url').notNull().default(''),
  isLiveNow: boolean('is_live_now').notNull().default(false),
  autoRecord: boolean('auto_record').notNull().default(true),
  type: text('type').notNull().default('event'),
  pinnedToBoard: boolean('pinned_to_board').notNull().default(true),
  pinColor: text('pin_color').notNull().default('aqua'),
  locationOrLabel: text('location_or_label').notNull().default('Global Online Sanctuary'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 13. Persistent Uploaded Media Assets Table (Thumbnails, Logos, Event Posters, Avatars)
export const uploadedAssets = pgTable('uploaded_assets', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Persistent Auth Sessions Table (Reload-safe login state without client secrets)
export const authSessions = pgTable('auth_sessions', {
  token: text('token').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  attendanceRecords: many(attendanceRecords),
  submissions: many(submissions),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  enrollments: many(enrollments),
  recordings: many(recordings),
  attendanceRecords: many(attendanceRecords),
  submissions: many(submissions),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [enrollments.userUid],
    references: [users.uid],
  }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  course: one(courses, {
    fields: [recordings.courseId],
    references: [courses.id],
  }),
}));

export const attendanceRelations = relations(attendanceRecords, ({ one }) => ({
  course: one(courses, {
    fields: [attendanceRecords.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [attendanceRecords.studentUid],
    references: [users.uid],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  course: one(courses, {
    fields: [submissions.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [submissions.studentUid],
    references: [users.uid],
  }),
}));
