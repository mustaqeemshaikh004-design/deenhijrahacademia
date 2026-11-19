import type { AcademicAssessment, Course, CourseModule, QuizQuestion } from '../types';

export const MODULE_QUIZ_ID_PREFIX = 'module-quiz-';
export const MODULE_COMPLETION_EVENT = 'dha-module-completion-changed';

/**
 * Generates a deterministic post-module knowledge check quiz directly from a course module's
 * syllabus metadata when an instructor has not manually attached a custom pop_quiz to that module.
 * Safe for both client (browser) and Node/Express (`server.ts`) auto-grading validation.
 */
export function buildModuleCheckpointQuiz(
  course: Course,
  mod: CourseModule,
  moduleIndex: number
): AcademicAssessment {
  const stageNum = moduleIndex + 1;
  const objectives = Array.isArray(mod.learningObjectives)
    ? mod.learningObjectives.map((o) => String(o).trim()).filter(Boolean)
    : [];
  const otherModules = (course.modules || []).filter((m) => m.id !== mod.id);

  const primaryObjective =
    objectives[0] || `Master the foundational concepts introduced in ${mod.title}`;
  const secondaryObjective =
    objectives[1] ||
    (mod.instructorNotes
      ? mod.instructorNotes.slice(0, 120)
      : `Apply ${mod.title} principles within ${course.title}`);

  const questions: QuizQuestion[] = [
    {
      id: `${mod.id}-mq-1`,
      question: `Which primary learning objective is covered in Stage ${stageNum} ("${mod.title}")?`,
      options: [
        primaryObjective,
        otherModules[0]?.learningObjectives?.[0] ||
          'Unrelated post-graduation administrative onboarding',
        'Course tuition billing and fee waivers only',
        'External third-party platform certification fees',
      ],
      correctIndex: 0,
      explanation: `Stage ${stageNum} (${mod.title}) focuses specifically on: ${primaryObjective}.`,
    },
    {
      id: `${mod.id}-mq-2`,
      question: `How many structured lectures are included in "${mod.title}" under ${course.title}?`,
      options: [
        `${Math.max(1, (mod.lecturesCount || 3) + 5)} Lectures`,
        `${mod.lecturesCount || 1} ${(mod.lecturesCount || 1) === 1 ? 'Lecture' : 'Lectures'}`,
        `${Math.max(2, (mod.lecturesCount || 3) + 9)} Lectures`,
        '0 Lectures (Self-reading only)',
      ],
      correctIndex: 1,
      explanation: `"${mod.title}" is structured across ${mod.lecturesCount || 1} ${(mod.lecturesCount || 1) === 1 ? 'lecture' : 'lectures'} led by ${course.instructorName}.`,
    },
    {
      id: `${mod.id}-mq-3`,
      question: `After completing Stage ${stageNum}, which follow-up mastery focus aligns with "${mod.title}"?`,
      options: [
        'Skipping instructor feedback and live session participation',
        'Waiting until the end of the term without reviewing notes',
        secondaryObjective,
        'Replacing primary course study with unverified external blogs',
      ],
      correctIndex: 2,
      explanation: `Stage ${stageNum} reinforces: ${secondaryObjective}.`,
    },
  ];

  return {
    id: `${MODULE_QUIZ_ID_PREFIX}${mod.id}`,
    courseId: course.id,
    moduleId: mod.id,
    moduleTitle: mod.title,
    title: `Module ${stageNum} Assessment: ${mod.title}`,
    description: `Auto-graded post-module mastery check covering "${mod.title}" in ${course.title}.`,
    type: 'pop_quiz',
    assignedDateUtc: new Date().toISOString(),
    dueDateUtc:
      course.enrollmentDeadlineUtc ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    points: 100,
    durationMinutes: 15,
    passingScorePercent: 70,
    allowFileUpload: false,
    createdBy: course.instructorName,
    quizQuestions: questions,
  };
}

/**
 * Finds the best assessment for a completed module:
 * 1) Instructor-created quiz/exam explicitly assigned to this module (`moduleId === mod.id`)
 * 2) Deterministic post-module checkpoint quiz generated from the module's syllabus data.
 */
export function findQuizForModule(
  course: Course,
  mod: CourseModule,
  moduleIndex: number
): AcademicAssessment {
  const explicit = (course.assignments || []).find(
    (a) =>
      a.moduleId === mod.id &&
      (a.type === 'pop_quiz' || a.type === 'exam') &&
      Array.isArray(a.quizQuestions) &&
      a.quizQuestions.length > 0
  );
  if (explicit) {
    return {
      ...explicit,
      moduleId: explicit.moduleId || mod.id,
      moduleTitle: explicit.moduleTitle || mod.title,
    };
  }
  return buildModuleCheckpointQuiz(course, mod, moduleIndex);
}

/**
 * Resolves either a stored assignment on `course.assignments` OR a `module-quiz-<moduleId>` ID.
 */
export function resolveCourseAssessmentById(
  course: Course,
  assessmentId: string
): AcademicAssessment | null {
  const direct = (course.assignments || []).find((a) => a.id === assessmentId);
  if (direct) return direct;

  if (assessmentId.startsWith(MODULE_QUIZ_ID_PREFIX)) {
    const targetModId = assessmentId.slice(MODULE_QUIZ_ID_PREFIX.length);
    const modIdx = (course.modules || []).findIndex((m) => m.id === targetModId);
    if (modIdx >= 0) {
      return buildModuleCheckpointQuiz(course, course.modules[modIdx], modIdx);
    }
  }
  return null;
}

/**
 * Resolves a human-readable title for any submission (formal assignment, general coursework, or post-module quiz).
 */
export function resolveAssessmentTitle(
  course: Course | undefined,
  assessmentId: string
): string {
  if (assessmentId === 'general-coursework') {
    return 'Coursework / Practice Submission';
  }
  if (course) {
    const resolved = resolveCourseAssessmentById(course, assessmentId);
    if (resolved) return resolved.title;
  }
  if (assessmentId.startsWith(MODULE_QUIZ_ID_PREFIX)) {
    return 'Module Completion Quiz';
  }
  return `Assignment (${assessmentId})`;
}

// Browser-only module completion storage helpers
function getCompletionKey(studentId: string, courseId: string): string {
  return `dha_completed_modules_${studentId}_${courseId}`;
}

export function loadCompletedModuleIds(studentId: string, courseId: string): string[] {
  if (typeof window === 'undefined' || !studentId || !courseId) return [];
  try {
    const raw = window.localStorage.getItem(getCompletionKey(studentId, courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCompletedModuleIds(
  studentId: string,
  courseId: string,
  moduleIds: string[]
): string[] {
  const unique = Array.from(new Set(moduleIds));
  if (typeof window !== 'undefined' && studentId && courseId) {
    try {
      window.localStorage.setItem(getCompletionKey(studentId, courseId), JSON.stringify(unique));
      window.dispatchEvent(
        new CustomEvent(MODULE_COMPLETION_EVENT, {
          detail: { studentId, courseId, moduleIds: unique },
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }
  return unique;
}
