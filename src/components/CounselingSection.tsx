import React, { useState } from 'react';
import { CheckCircle2, Compass, Send, Clock, ShieldCheck } from 'lucide-react';
import type { User } from '../types';
import { getUserTimezoneShort } from '../utils/timezone';

interface CounselingSectionProps {
  currentUser: User | null;
}

export const CounselingSection: React.FC<CounselingSectionProps> = ({ currentUser }) => {
  const [fullName, setFullName] = useState(
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''
  );
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [topic, setTopic] = useState('Course & Curriculum Guidance');
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
          kind: 'counseling',
          fullName,
          email,
          phoneWhatsApp,
          track: topic,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule counseling request.');
      setSubmitted(true);
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send counseling request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
      <div className="max-w-3xl space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#00F2FE] font-semibold">
          Scholarly Advising &amp; Student Support
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Academic Counseling &amp; Mentorship
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Request personalized academic advising to select the right study track, balance classical coursework with daily responsibilities, or clarify prerequisites directly with our leadership.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Compass className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
              <span>Study Roadmap Planning</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Receive tailored guidance on whether to start with Beginner orientation foundations or Intermediate Seerah and textual study.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>Timezone-Matched Sessions</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Consultations are coordinated across global regions, aligned automatically with your detected zone ({getUserTimezoneShort()}).
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Confidential Scholarly Care</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All student inquiries are reviewed personally by Founding Director Mustaqeem Shaikh.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Bilal Ahmad"
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
                WhatsApp / Phone Number
              </label>
              <input
                type="tel"
                value={phoneWhatsApp}
                onChange={(e) => setPhoneWhatsApp(e.target.value)}
                placeholder="+1 555 234 5678"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Counseling Focus
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              >
                <option value="Course & Curriculum Guidance">
                  Course &amp; Curriculum Guidance
                </option>
                <option value="Beginner Foundation Placement">
                  Beginner Foundation Placement
                </option>
                <option value="Study Schedule & Time Management">
                  Study Schedule &amp; Time Management
                </option>
                <option value="Youth & Family Learning Advice">
                  Youth &amp; Family Learning Advice
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Questions or Context
            </label>
            <textarea
              rows={4}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share what you would like to discuss with our academic advisor..."
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
                Counseling request submitted! We will contact you with an advising slot shortly.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Submitting Request...' : 'Request Academic Counseling'}
          </button>
        </form>
      </div>
    </section>
  );
};
