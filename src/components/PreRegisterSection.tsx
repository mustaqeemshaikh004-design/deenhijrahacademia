import React, { useState } from 'react';
import { CheckCircle2, Sparkles, Send, BookOpen } from 'lucide-react';
import type { Course, User } from '../types';

interface PreRegisterSectionProps {
  courses: Course[];
  currentUser: User | null;
  onSelectCourse?: (c: Course) => void;
}

export const PreRegisterSection: React.FC<PreRegisterSectionProps> = ({
  courses,
  currentUser,
  onSelectCourse,
}) => {
  const [fullName, setFullName] = useState(
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''
  );
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [country, setCountry] = useState('');
  const [track, setTrack] = useState(courses[0]?.title || 'Prophetic Seerah & Classical Studies');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/preregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'preregister',
          fullName,
          email,
          phoneWhatsApp,
          country,
          track,
          preferredLanguage,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit pre-registration.');
      setSubmitted(true);
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit pre-registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
      <div className="max-w-3xl space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
          Upcoming Cohorts &amp; Seat Reservation
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Pre-Register for Upcoming Batches
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Reserve your seat for the next academic term directed by Mustaqeem Shaikh. Pre-registered students receive priority orientation access, cohort timetables, and enrollment notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Amina Siddiqui"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp / Phone
              </label>
              <input
                type="tel"
                value={phoneWhatsApp}
                onChange={(e) => setPhoneWhatsApp(e.target.value)}
                placeholder="+44 7700 900123"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Country / Timezone Region
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Canada, UAE, UK, India"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Course / Subject Track
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.code} · {c.title}
                  </option>
                ))}
                <option value="Prophetic Seerah & Classical Studies">
                  Prophetic Seerah &amp; Classical Studies
                </option>
                <option value="Arabic Grammar & Quranic Morphology">
                  Arabic Grammar &amp; Quranic Morphology
                </option>
                <option value="Hadith & Usool Foundation">
                  Hadith &amp; Usool Foundation
                </option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Language Mode
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              >
                <option value="English">English</option>
                <option value="Urdu">Urdu</option>
                <option value="Hindi">Hindi</option>
                <option value="Bi-lingual">Bi-lingual</option>
                <option value="Kashmiri">Kashmiri</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Availability &amp; Academic Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mention preferred weekend/evening hours or current study background..."
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {submitted && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>
                Pre-registration recorded! Admissions will notify you as soon as cohort seats open.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Saving Seat Reservation...' : 'Submit Pre-Registration'}
          </button>
        </form>

        {/* Active Courses Quick Open */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0284C7] dark:text-[#00F2FE] font-mono uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Open for Immediate Enrollment</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Courses currently open allow instant free enrollment — watch the free orientation first, then submit enrollment to unlock class recordings.
            </p>
            {courses.length > 0 && onSelectCourse && (
              <div className="space-y-2.5">
                {courses.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCourse(c)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-[#00F2FE]/60 text-left transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE]">
                        {c.code} · {c.level}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                        {c.title}
                      </div>
                    </div>
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
