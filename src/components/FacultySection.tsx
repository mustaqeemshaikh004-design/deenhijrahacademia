import React, { useMemo } from 'react';
import { CheckCircle2, ArrowUpRight, BookOpen, MessageSquare } from 'lucide-react';
import type { Course, FacultyProfile, InstructorReview } from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { StarRatingDisplay } from './StarRating';

interface FacultySectionProps {
  facultyProfiles?: FacultyProfile[];
  courses?: Course[];
  instructorReviews?: InstructorReview[];
  onSelectFaculty?: (faculty: FacultyProfile) => void;
}

const DEFAULT_LEAD_SCHOLAR: FacultyProfile = {
  id: 'admin-mustaqeem',
  firstName: 'Mustaqeem',
  lastName: 'Shaikh',
  fullName: 'Mustaqeem Shaikh',
  title: 'Founding Director',
  roleLabel: 'Founding Director & Lead Academic Steward',
  specialty: 'Institutional Architecture, Seerah & Scholastic Oversight',
  bio: 'Leading curriculum governance, academic admissions, live scholarly instruction, and digital classroom infrastructure for Deen Hijrah Academia.',
  qualifications: [
    'Founding Director & Academic Chancellor — Deen Hijrah Academia',
    'Curriculum Architect for Seerah & Classical Studies',
    'Verified Lead Scholarly Instructor',
  ],
  gender: 'male',
  email: 'faculty.director@deenhijrahacademia.edu',
  isVerifiedDirector: true,
};

export const FacultySection: React.FC<FacultySectionProps> = ({
  facultyProfiles = [],
  courses = [],
  instructorReviews = [],
  onSelectFaculty,
}) => {
  const displayFaculty = useMemo(() => {
    const byKey = new Map<string, FacultyProfile>();
    const seedList =
      facultyProfiles.length > 0 ? facultyProfiles : [DEFAULT_LEAD_SCHOLAR];

    for (const f of seedList) {
      byKey.set(f.id, f);
    }

    // Ensure every active course instructor also appears as clickable faculty
    for (const c of courses) {
      const name = (c.instructorName || '').trim();
      if (!name) continue;
      const existing = Array.from(byKey.values()).find(
        (f) =>
          (c.instructorId && f.id === c.instructorId) ||
          f.fullName.trim().toLowerCase() === name.toLowerCase()
      );
      if (!existing) {
        const parts = name.split(/\s+/);
        const key = c.instructorId || `faculty-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        byKey.set(key, {
          id: key,
          firstName: parts[0] || name,
          lastName: parts.slice(1).join(' '),
          fullName: name,
          title: 'Course Instructor',
          roleLabel: 'Program Instructor & Mentor',
          specialty: c.title,
          bio: `Dedicated academy instructor leading ${c.title}, live cohort sessions, and weekly curriculum guidance.`,
          qualifications: [
            `Lead Instructor — ${c.code || 'Academy Program'}`,
            'Live Cohort & Assessment Guidance',
          ],
          gender: 'male',
          isVerifiedDirector: false,
        });
      }
    }

    return Array.from(byKey.values()).map((prof) => {
      const targetName = prof.fullName.trim().toLowerCase();
      const matchingCourses = courses.filter(
        (c) =>
          c.instructorId === prof.id ||
          c.instructorName.trim().toLowerCase() === targetName
      );
      const matchingReviews = instructorReviews.filter(
        (r) =>
          r.instructorId === prof.id ||
          r.instructorName.trim().toLowerCase() === targetName
      );
      const avg =
        matchingReviews.length > 0
          ? Number(
              (
                matchingReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
                matchingReviews.length
              ).toFixed(1)
            )
          : prof.averageRating || 0;

      return {
        ...prof,
        coursesTaughtCount: Math.max(matchingCourses.length, prof.coursesTaughtCount || 0),
        averageRating: avg,
        reviewCount: Math.max(matchingReviews.length, prof.reviewCount || 0),
      };
    });
  }, [facultyProfiles, courses, instructorReviews]);

  const isSingleCard = displayFaculty.length === 1;

  return (
    <section
      id="faculty-section"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-slate-800/80"
    >
      <div className="max-w-3xl mb-10">
        <div className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] tracking-wider uppercase mb-1">
          Scholastic Leadership &amp; Faculty
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
          Scholastic Direction &amp; Teaching Faculty
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Click any faculty profile to read their biography, qualifications, courses taught, and student instructor reviews.
        </p>
      </div>

      <div
        className={
          isSingleCard
            ? 'max-w-4xl'
            : 'grid grid-cols-1 lg:grid-cols-2 gap-6'
        }
      >
        {displayFaculty.map((scholar) => (
          <button
            key={scholar.id}
            type="button"
            onClick={() => onSelectFaculty?.(scholar)}
            className="w-full text-left group rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 hover:border-[#0284C7]/60 dark:hover:border-[#00F2FE]/60 hover:-translate-y-0.5 transition-all p-6 sm:p-8 shadow-sm hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F2FE]"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="shrink-0">
                <SymbolicAvatar
                  gender={scholar.gender}
                  name={scholar.fullName}
                  avatarUrl={scholar.avatarUrl}
                  size="xl"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <span className="text-amber-600 dark:text-amber-300 font-semibold">
                      {scholar.title}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[240px]">{scholar.specialty}</span>
                  </div>

                  <StarRatingDisplay
                    rating={scholar.averageRating || 0}
                    size="xs"
                    reviewCount={scholar.reviewCount || 0}
                  />
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white group-hover:text-[#0284C7] dark:group-hover:text-[#00F2FE] transition-colors tracking-tight">
                  {scholar.fullName}
                </h3>

                <div className="text-xs sm:text-sm text-[#0284C7] dark:text-[#00F2FE] font-semibold mt-1">
                  {scholar.roleLabel}
                </div>

                <p className="mt-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                  {scholar.bio}
                </p>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 font-mono">
                    {scholar.isVerifiedDirector && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Verified Director</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>{scholar.coursesTaughtCount || 0} Courses</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>{scholar.reviewCount || 0} Reviews</span>
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-bold text-[#0284C7] dark:text-[#00F2FE] group-hover:translate-x-0.5 transition-transform">
                    <span>Read Bio &amp; Reviews</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
