export type UserRole = 'admin' | 'teacher' | 'student';
export type UserGender = 'male' | 'female';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  gender: UserGender;
  avatarUrl?: string;
  avatarStoragePath?: string;
  timezone?: string;
  preferredTheme?: 'dark' | 'light';
  hasCustomPassword?: boolean;
  createdAt: string;
  lastActive?: string;
  customLogoUrl?: string;
}

export type CourseStatus = 'Open for Enrollment' | 'Active' | 'Coming Soon';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  learningObjectives: string[];
  instructorNotes: string;
  lecturesCount: number;
}

export interface LiveSchedule {
  id: string;
  title: string;
  dateStr?: string; // YYYY-MM-DD
  dayOfWeek: string;
  timeUtc: string; // ISO or "14:00" UTC format
  durationMinutes: number;
  instructorId?: string;
  instructorName?: string;
  zoomMeetingId: string;
  zoomPasscode: string;
  zoomJoinUrl: string;
  zoomStartUrl: string;
  isLiveNow: boolean;
  recordingStatus: 'idle' | 'recording' | 'processing' | 'synced';
}

export interface CompletedVideoArchive {
  id: string;
  title: string;
  duration: string;
  recordedAt: string;
  videoUrl: string;
  storagePath?: string;
  teaserUrl?: string;
  teaserStoragePath?: string;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  supplementaryPdfUrl?: string;
  supplementaryPdfName?: string;
  supplementaryPdfStoragePath?: string;
  mimeType?: 'video/mp4';
  nonDownloadable?: boolean;
  nonShareable?: boolean;
  isOrientation?: boolean;
  locked?: boolean;
  syncedFromZoomWebhook: boolean;
  fileSize: string;
}

export interface EnrollmentIntakePayload {
  courseId: string;
  studentId?: string;
  fullName: string;
  email: string;
  phoneWhatsApp?: string;
  age?: string;
  gender: UserGender;
  country?: string;
  city?: string;
  educationBackground?: string;
  preferredLanguage?: 'English' | 'Urdu' | 'Hindi' | 'Bi-lingual' | 'Kashmiri';
  motivation?: string;
  submittedAt?: string;
}

export interface PreRegistrationPayload {
  id: string;
  kind: 'preregister' | 'counseling';
  fullName: string;
  email: string;
  phoneWhatsApp?: string;
  country?: string;
  track?: string;
  preferredLanguage?: string;
  notes?: string;
  submittedAt: string;
}

export interface CourseMaterial {
  id: string;
  title: string;
  fileType: 'pdf' | 'notes' | 'slides';
  fileUrl: string;
  uploadDate: string;
  size: string;
}

export type AssessmentType = 'homework' | 'pop_quiz' | 'exam' | 'standard_assignment' | 'major_project';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AcademicAssessment {
  id: string;
  courseId: string;
  moduleId?: string;
  moduleTitle?: string;
  title: string;
  description: string;
  type: AssessmentType;
  assignedDateUtc?: string;
  dueDateUtc: string;
  points: number;
  durationMinutes?: number;
  passingScorePercent?: number;
  allowFileUpload?: boolean;
  createdBy?: string;
  rubric?: string[];
  quizQuestions?: QuizQuestion[];
  projectMilestones?: string[];
  attachments?: { name: string; url: string }[];
}

export interface StudentSubmission {
  id: string;
  assessmentId: string;
  courseId: string;
  moduleId?: string;
  moduleTitle?: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  type: AssessmentType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  linkUrl?: string;
  quizAnswers?: number[];
  quizScore?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
  grade?: number;
  maxPoints: number;
  feedback?: string;
  status: 'submitted' | 'graded';
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  scheduleId: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  status: 'Present' | 'Late' | 'Absent';
  timezoneDetected: string;
  verifiedByTeacher: boolean;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  status: CourseStatus;
  level: CourseLevel;
  thumbnail: string;
  modules: CourseModule[];
  schedules: LiveSchedule[];
  videoArchives: CompletedVideoArchive[];
  materials: CourseMaterial[];
  assignments: AcademicAssessment[];
  enrolledStudentIds: string[];
  totalLectures: number;
  maxSpots?: number;
  durationLabel?: string;
  enrollmentDeadlineUtc?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorGender: UserGender;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorGender: UserGender;
  authorAvatar?: string;
  content: string;
  mediaUrl?: string;
  category: 'announcement' | 'community';
  pinned: boolean;
  createdAt: string;
  likes: number;
  likedByUserIds: string[];
  comments: PostComment[];
  flagged: boolean;
  flagReason?: string;
}

export interface ChatMessage {
  id: string;
  courseId?: string;
  channelId?: string; // e.g. "general" or direct student-teacher dm
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderGender: UserGender;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  flagged: boolean;
}

export interface ModerationLog {
  id: string;
  source: 'community_post' | 'chat_message';
  authorId: string;
  authorName: string;
  content: string;
  flaggedKeyword: string;
  action: 'blocked' | 'flagged_for_review';
  timestamp: string;
  reviewedByMustaqeem: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  courseId?: string;
  courseTitle?: string;
  startUtc: string;
  endUtc: string;
  dateStr?: string;
  dayOfWeek?: string;
  timeUtc?: string;
  instructorId?: string;
  instructorName?: string;
  meetingId?: string;
  meetingPasscode?: string;
  joinUrl?: string;
  hostStartUrl?: string;
  isLiveNow?: boolean;
  autoRecord?: boolean;
  type: 'lecture' | 'quiz' | 'homework' | 'project' | 'academic_date' | 'event';
  pinnedToBoard?: boolean;
  pinColor?: 'aqua' | 'emerald' | 'crimson' | 'amber';
  locationOrLabel?: string;
  isDerived?: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorBadge: string;
  readTime: string;
  bannerUrl: string;
  publishedAt: string;
  tags: string[];
}

export interface CustomNavItem {
  id: string;
  label: string;
  key: string;
  isSystem?: boolean;
}

export interface PlatformSettings {
  heroMode: 'video' | 'image';
  heroVideoUrl: string;
  heroPosterUrl: string;
  heroImageUrl: string;
  heroHeadline: string;
  heroSubheadline: string;
  customLogoUrl: string;
  customNavItems: CustomNavItem[];
}

export interface StudentSubjectProgress {
  courseId: string;
  courseTitle: string;
  enrolled: boolean;
  completedLectures: number;
  totalLectures: number;
  attendanceCount: number;
  totalAttendanceSessions: number;
  attendancePercentage: number;
  attendanceHistory: AttendanceRecord[];
  submissions: StudentSubmission[];
  quizScores: { quizTitle: string; score: number; max: number; date: string }[];
  overallGradePercent: number;
}
