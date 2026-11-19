import { jsPDF } from 'jspdf';
import type {
  AttendanceRecord,
  Course,
  StudentSubmission,
  User,
} from '../types';
import { formatToLocalTime, getUserTimezoneShort } from './timezone';
import { resolveAssessmentTitle } from './moduleQuizHelper';

export interface ReportCardPdfInput {
  student: User;
  courses: Course[];
  submissions: StudentSubmission[];
  attendanceLogs: AttendanceRecord[];
  scopeCourseId?: string; // Omit or pass 'all' for full academic transcript
}

interface ReportLineItem {
  title: string;
  typeLabel: string;
  statusLabel: 'Graded' | 'Awaiting Review' | 'Not Submitted';
  scoreEarned?: number;
  maxPoints: number;
  percent?: number;
  dateLabel: string;
  feedback?: string;
}

function sanitizePdfText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    // Strip characters outside printable Latin-1 supplement so Helvetica never prints tofu/garbage
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

function formatAssessmentTypeLabel(type: string): string {
  switch (type) {
    case 'pop_quiz':
      return 'Animated Quiz';
    case 'exam':
      return 'Timed Exam';
    case 'homework':
      return 'Homework';
    case 'standard_assignment':
      return 'Assignment';
    case 'major_project':
      return 'Major Project';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function getLetterGrade(percent: number | null): string {
  if (percent === null) return 'Pending';
  if (percent >= 93) return 'A';
  if (percent >= 90) return 'A-';
  if (percent >= 87) return 'B+';
  if (percent >= 83) return 'B';
  if (percent >= 80) return 'B-';
  if (percent >= 77) return 'C+';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'Needs Improvement';
}

export function generateStudentReportCardPdf({
  student,
  courses,
  submissions,
  attendanceLogs,
  scopeCourseId,
}: ReportCardPdfInput): { fileName: string; courseCount: number; itemCount: number } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 20;

  const isSingleCourse = Boolean(scopeCourseId && scopeCourseId !== 'all');
  const targetCourses = isSingleCourse
    ? courses.filter((c) => c.id === scopeCourseId)
    : (() => {
        const enrolled = courses.filter((c) => c.enrolledStudentIds.includes(student.id));
        const withSubmissions = courses.filter((c) =>
          submissions.some((s) => s.courseId === c.id)
        );
        const combined = [...enrolled];
        withSubmissions.forEach((c) => {
          if (!combined.some((existing) => existing.id === c.id)) {
            combined.push(c);
          }
        });
        return combined.length > 0 ? combined : courses.slice(0, 1);
      })();

  // Build normalized rows per course
  const courseSections = targetCourses.map((course) => {
    const courseSubs = submissions.filter((s) => s.courseId === course.id);
    const items: ReportLineItem[] = [];

    // 1. Formal course assessments
    (course.assignments || []).forEach((ass) => {
      const matchingSubs = courseSubs
        .filter((s) => s.assessmentId === ass.id)
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      const latestSub = matchingSubs[0];

      if (latestSub) {
        const numericScore = latestSub.grade ?? latestSub.quizScore;
        const hasNumeric = typeof numericScore === 'number';
        const maxPts = latestSub.maxPoints || ass.points || 100;
        const pct =
          hasNumeric && maxPts > 0 ? Math.round((numericScore / maxPts) * 100) : undefined;
        const submittedLocal = formatToLocalTime(latestSub.submittedAt);

        items.push({
          title: sanitizePdfText(ass.title) || 'Course Assessment',
          typeLabel: formatAssessmentTypeLabel(ass.type),
          statusLabel: latestSub.status === 'graded' ? 'Graded' : 'Awaiting Review',
          scoreEarned: hasNumeric ? numericScore : undefined,
          maxPoints: maxPts,
          percent: pct,
          dateLabel: sanitizePdfText(
            `Submitted ${submittedLocal.localDayStr} · ${submittedLocal.localTimeStr}`
          ),
          feedback: sanitizePdfText(latestSub.feedback),
        });
      } else {
        const dueLocal = formatToLocalTime(ass.dueDateUtc);
        items.push({
          title: sanitizePdfText(ass.title) || 'Course Assessment',
          typeLabel: formatAssessmentTypeLabel(ass.type),
          statusLabel: 'Not Submitted',
          maxPoints: ass.points || 100,
          dateLabel: sanitizePdfText(`Due ${dueLocal.localDayStr} · ${dueLocal.localTimeStr}`),
        });
      }
    });

    // 2. General coursework or orphan submissions not matched to a formal assessment
    const formalIds = new Set((course.assignments || []).map((a) => a.id));
    courseSubs
      .filter((s) => s.assessmentId === 'general-coursework' || !formalIds.has(s.assessmentId))
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
      .forEach((sub, idx) => {
        const numericScore = sub.grade ?? sub.quizScore;
        const hasNumeric = typeof numericScore === 'number';
        const maxPts = sub.maxPoints || 100;
        const pct =
          hasNumeric && maxPts > 0 ? Math.round((numericScore / maxPts) * 100) : undefined;
        const submittedLocal = formatToLocalTime(sub.submittedAt);

        items.push({
          title:
            sub.assessmentId === 'general-coursework'
              ? `Coursework Submission${idx > 0 ? ` #${idx + 1}` : ''}`
              : sanitizePdfText(resolveAssessmentTitle(course, sub.assessmentId)),
          typeLabel: formatAssessmentTypeLabel(sub.type || 'homework'),
          statusLabel: sub.status === 'graded' ? 'Graded' : 'Awaiting Review',
          scoreEarned: hasNumeric ? numericScore : undefined,
          maxPoints: maxPts,
          percent: pct,
          dateLabel: sanitizePdfText(
            `Submitted ${submittedLocal.localDayStr} · ${submittedLocal.localTimeStr}`
          ),
          feedback: sanitizePdfText(sub.feedback),
        });
      });

    const gradedItems = items.filter(
      (it) => it.statusLabel === 'Graded' && typeof it.scoreEarned === 'number'
    );
    const earnedSum = gradedItems.reduce((sum, it) => sum + (it.scoreEarned ?? 0), 0);
    const possibleSum = gradedItems.reduce((sum, it) => sum + Math.max(1, it.maxPoints), 0);
    const courseAvgPercent =
      possibleSum > 0 ? Math.round((earnedSum / possibleSum) * 100) : null;

    const courseAtt = attendanceLogs.filter((a) => a.courseId === course.id);
    const expectedSess = Math.max(1, course.schedules?.length || 1);
    const attendancePct =
      courseAtt.length > 0
        ? Math.min(100, Math.round((courseAtt.length / Math.max(expectedSess, courseAtt.length)) * 100))
        : 0;

    return {
      course,
      items,
      gradedCount: gradedItems.length,
      submittedCount: items.filter((it) => it.statusLabel !== 'Not Submitted').length,
      earnedSum,
      possibleSum,
      courseAvgPercent,
      attendanceCount: courseAtt.length,
      attendancePct,
    };
  });

  // Overall totals across included courses
  const totalEarned = courseSections.reduce((s, sec) => s + sec.earnedSum, 0);
  const totalPossible = courseSections.reduce((s, sec) => s + sec.possibleSum, 0);
  const overallPercent =
    totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;
  const totalGraded = courseSections.reduce((s, sec) => s + sec.gradedCount, 0);
  const totalSubmitted = courseSections.reduce((s, sec) => s + sec.submittedCount, 0);
  const totalItems = courseSections.reduce((s, sec) => s + sec.items.length, 0);
  const overallAttendanceCount = courseSections.reduce(
    (s, sec) => s + sec.attendanceCount,
    0
  );

  // Page cursor tracking
  let y = 0;

  const drawContinuationHeader = () => {
    doc.setFillColor(10, 25, 47);
    doc.rect(0, 0, pageWidth, 14, 'F');
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 14, pageWidth, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('DEEN HIJRAH ACADEMIA  |  STUDENT REPORT CARD (CONTINUED)', marginX, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(186, 230, 253);
    doc.text(
      sanitizePdfText(`${student.firstName} ${student.lastName}`),
      pageWidth - marginX,
      9,
      { align: 'right' }
    );
    y = 24;
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      drawContinuationHeader();
    }
  };

  // ================= PAGE 1 INSTITUTIONAL HEADER =================
  doc.setFillColor(10, 25, 47);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 34, pageWidth / 2, 1.2, 'F');
  doc.setFillColor(2, 132, 199);
  doc.rect(pageWidth / 2, 34, pageWidth / 2, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('DEEN HIJRAH ACADEMIA', marginX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(125, 211, 252);
  doc.text('Official Student Academic Progress & Assessment Report Card', marginX, 21);

  const tzLabel = sanitizePdfText(getUserTimezoneShort());
  const issuedNow = new Date();
  const issuedStr = sanitizePdfText(
    `${issuedNow.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })} (${tzLabel})`
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('ISSUED ON', pageWidth - marginX, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(issuedStr, pageWidth - marginX, 19, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    isSingleCourse && targetCourses[0]
      ? sanitizePdfText(`Course Scope: ${targetCourses[0].code}`)
      : 'Scope: Full Academic Transcript',
    pageWidth - marginX,
    26,
    { align: 'right' }
  );

  y = 43;

  // ================= STUDENT IDENTITY & EXECUTIVE SUMMARY CARD =================
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, contentWidth, 34, 2.5, 2.5, 'FD');

  // Student info left column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SCHOLAR PROFILE', marginX + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(`${student.firstName} ${student.lastName}`), marginX + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(sanitizePdfText(student.email), marginX + 5, y + 20);
  doc.text(
    sanitizePdfText(`Institutional ID: ${student.id}`),
    marginX + 5,
    y + 26.5
  );

  // Vertical divider inside profile card
  const statsStartX = marginX + contentWidth * 0.52;
  doc.setDrawColor(226, 232, 240);
  doc.line(statsStartX - 4, y + 5, statsStartX - 4, y + 29);

  // 3 KPI blocks right half
  const colW = (contentWidth * 0.48) / 3;

  // KPI 1: Overall Average
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL STANDING', statsStartX, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (overallPercent !== null) {
    doc.setTextColor(5, 150, 105);
    doc.text(`${getLetterGrade(overallPercent)} (${overallPercent}%)`, statsStartX, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${totalEarned} / ${totalPossible} pts`, statsStartX, y + 23.5);
  } else {
    doc.setTextColor(2, 132, 199);
    doc.text('Pending', statsStartX, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Awaiting grades', statsStartX, y + 23.5);
  }

  // KPI 2: Graded Items
  const kpi2X = statsStartX + colW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADED WORK', kpi2X, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalGraded} / ${totalSubmitted}`, kpi2X, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${totalItems} assigned`, kpi2X, y + 23.5);

  // KPI 3: Attendance
  const kpi3X = statsStartX + colW * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ATTENDANCE LOGS', kpi3X, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(2, 132, 199);
  doc.text(`${overallAttendanceCount}`, kpi3X, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Verified joins', kpi3X, y + 23.5);

  y += 42;

  // ================= COURSE-BY-COURSE GRADEBOOK & FEEDBACK =================
  if (courseSections.length === 0) {
    ensureSpace(24);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'No enrolled courses or assessment submissions are currently recorded on this account.',
      marginX + 6,
      y + 12
    );
    y += 26;
  }

  courseSections.forEach((section, secIdx) => {
    ensureSpace(28);

    // Course Header Bar
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, y, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const courseHeading = sanitizePdfText(
      `${section.course.code} - ${section.course.title}`
    );
    doc.text(courseHeading, marginX + 4, y + 6.5, { maxWidth: contentWidth - 52 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      sanitizePdfText(
        `Instructor: ${section.course.instructorName}  ·  Level: ${section.course.level}  ·  Attendance: ${section.attendancePct}% (${section.attendanceCount} logs)`
      ),
      marginX + 4,
      y + 12.5
    );

    // Course Average right-aligned
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (section.courseAvgPercent !== null) {
      doc.setTextColor(5, 150, 105);
      doc.text(
        `${getLetterGrade(section.courseAvgPercent)} (${section.courseAvgPercent}%)`,
        pageWidth - marginX - 4,
        y + 7,
        { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${section.earnedSum}/${section.possibleSum} pts`,
        pageWidth - marginX - 4,
        y + 12.5,
        { align: 'right' }
      );
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text('In Progress', pageWidth - marginX - 4, y + 9.5, { align: 'right' });
    }

    y += 19;

    if (section.items.length === 0) {
      ensureSpace(14);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'No assignments, quizzes, exams, or coursework submissions recorded for this course yet.',
        marginX + 3,
        y + 5
      );
      y += 12;
    } else {
      // Column subheader
      ensureSpace(10);
      doc.setFillColor(15, 23, 42);
      doc.rect(marginX, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(226, 232, 240);
      doc.text('ASSIGNMENT / ASSESSMENT', marginX + 3, y + 4.8);
      doc.text('STATUS', marginX + 102, y + 4.8);
      doc.text('GRADE / SCORE', pageWidth - marginX - 3, y + 4.8, { align: 'right' });
      y += 7;

      section.items.forEach((item, itemIdx) => {
        const titleLines: string[] = doc.splitTextToSize(item.title, 92);
        const feedbackText = item.feedback
          ? item.feedback
          : item.statusLabel === 'Not Submitted'
          ? ''
          : 'No written instructor comments added yet.';
        const feedbackLines: string[] = feedbackText
          ? doc.splitTextToSize(`Instructor Feedback: ${feedbackText}`, contentWidth - 10)
          : [];

        const titleBlockH = Math.max(1, titleLines.length) * 4.2 + 5; // + metadata subline
        const feedbackBlockH =
          feedbackLines.length > 0 ? feedbackLines.length * 3.9 + 4.5 : 0;
        const rowHeight = Math.max(13, titleBlockH + feedbackBlockH + 4);

        ensureSpace(rowHeight + 2);

        // Alternating crisp background
        if (itemIdx % 2 === 0) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, contentWidth, rowHeight, 'FD');

        // Left: Assignment title + Type/Timestamp metadata
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(titleLines, marginX + 3, y + 5.2);

        const metaY = y + 5.2 + titleLines.length * 4.1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          sanitizePdfText(`${item.typeLabel}  ·  ${item.dateLabel}`),
          marginX + 3,
          metaY
        );

        // Middle: Status label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        if (item.statusLabel === 'Graded') {
          doc.setTextColor(5, 150, 105);
        } else if (item.statusLabel === 'Awaiting Review') {
          doc.setTextColor(217, 119, 6);
        } else {
          doc.setTextColor(100, 116, 139);
        }
        doc.text(item.statusLabel, marginX + 102, y + 5.5);

        // Right: Numeric Grade + Percent
        if (typeof item.scoreEarned === 'number') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(2, 132, 199);
          doc.text(
            `${item.scoreEarned} / ${item.maxPoints}`,
            pageWidth - marginX - 3,
            y + 5.4,
            { align: 'right' }
          );
          if (typeof item.percent === 'number') {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`${item.percent}%`, pageWidth - marginX - 3, y + 9.8, {
              align: 'right',
            });
          }
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`-- / ${item.maxPoints} pts`, pageWidth - marginX - 3, y + 5.5, {
            align: 'right',
          });
        }

        // Bottom inside row: Instructor Feedback box
        if (feedbackLines.length > 0) {
          const fbY = y + titleBlockH + 1.5;
          const fbBoxH = feedbackLines.length * 3.9 + 3;
          doc.setFillColor(
            item.feedback ? 236 : 241,
            item.feedback ? 253 : 245,
            item.feedback ? 245 : 249
          );
          doc.setDrawColor(
            item.feedback ? 167 : 226,
            item.feedback ? 243 : 232,
            item.feedback ? 208 : 240
          );
          doc.roundedRect(marginX + 3, fbY, contentWidth - 6, fbBoxH, 1.2, 1.2, 'FD');

          doc.setFont('helvetica', item.feedback ? 'normal' : 'italic');
          doc.setFontSize(7.8);
          if (item.feedback) {
            doc.setTextColor(6, 78, 59);
          } else {
            doc.setTextColor(100, 116, 139);
          }
          doc.text(feedbackLines, marginX + 5, fbY + 3.8);
        }

        y += rowHeight;
      });
    }

    if (secIdx < courseSections.length - 1) {
      y += 8;
    }
  });

  // ================= REGISTRAR VERIFICATION BLOCK =================
  ensureSpace(24);
  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('ACADEMIC VERIFICATION', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Generated directly from Deen Hijrah Academia live student assessment and instructor grading records.',
    marginX,
    y + 4.5
  );

  // Add page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(`Deen Hijrah Academia  ·  Student Report Card (${student.firstName} ${student.lastName})`),
      marginX,
      pageHeight - 8.5
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8.5, {
      align: 'right',
    });
  }

  const safeStudentSlug = `${student.firstName}_${student.lastName}`
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Student';
  const scopeSlug =
    isSingleCourse && targetCourses[0]
      ? `_${targetCourses[0].code.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
      : '_All_Courses';
  const dateSlug = issuedNow.toISOString().slice(0, 10);
  const fileName = `Deen_Hijrah_Report_Card_${safeStudentSlug}${scopeSlug}_${dateSlug}.pdf`;

  doc.save(fileName);

  return {
    fileName,
    courseCount: courseSections.length,
    itemCount: totalItems,
  };
}
