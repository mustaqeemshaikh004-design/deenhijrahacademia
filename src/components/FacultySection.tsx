import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SymbolicAvatar } from './SymbolicAvatar';

export const FacultySection: React.FC = () => {
  const leadScholar = {
    name: 'Mustaqeem Shaikh',
    role: 'Founding Director & Lead Academic Steward',
    specialty: 'Institutional Architecture & Scholastic Oversight',
    bio: 'Leading curriculum governance, academic admissions, live scholarly instruction, and digital classroom infrastructure for Deen Hijrah Academia.',
    gender: 'male' as const,
    email: 'faculty.director@deenhijrahacademia.edu',
    titleLabel: 'Founding Director',
  };

  return (
    <section
      id="faculty-section"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-slate-800/80"
    >
      <div className="max-w-3xl mb-10">
        <div className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] tracking-wider uppercase mb-1">
          Scholastic Leadership
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
          Scholastic Direction
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          All cohorts, live classrooms, and curriculum oversight at Deen Hijrah Academia are directed personally by our Founding Director.
        </p>
      </div>

      <div className="max-w-4xl rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 hover:border-[#00F2FE]/40 transition-colors p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <SymbolicAvatar gender={leadScholar.gender} name={leadScholar.name} size="xl" />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono mb-1.5">
              <span className="text-amber-600 dark:text-amber-300 font-semibold">
                {leadScholar.titleLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>{leadScholar.specialty}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {leadScholar.name}
            </h3>

            <div className="text-xs sm:text-sm text-[#0284C7] dark:text-[#00F2FE] font-semibold mt-1">
              {leadScholar.role}
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {leadScholar.bio}
            </p>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="truncate">{leadScholar.email}</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Verified Academic Director</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
