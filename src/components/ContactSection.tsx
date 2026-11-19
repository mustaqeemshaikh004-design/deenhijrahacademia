import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, Globe, Shield } from 'lucide-react';
import { getUserTimezoneShort } from '../utils/timezone';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Course Admission Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 6000);
    }, 700);
  };

  return (
    <section
      id="contact-section"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-slate-800/80"
    >
      <div className="max-w-3xl mb-12">
        <div className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] tracking-wider uppercase mb-1">
          Admissions &amp; Direct Helpdesk
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Contact Deen Hijrah Academia
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Have inquiries regarding admissions, cohort schedules, or academic prerequisites? Our admissions office and faculty are available worldwide with auto-timezone coordination.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center gap-2.5 text-[#0284C7] dark:text-[#00F2FE] text-sm font-bold">
              <Mail className="w-4 h-4" />
              <span>Official Institutional Inquiries</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
              admissions@deenhijrahacademia.edu
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              support@deenhijrahacademia.edu
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center gap-2.5 text-[#059669] dark:text-[#10B981] text-sm font-bold">
              <Globe className="w-4 h-4" />
              <span>Global Virtual Campus</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Synchronized to your local timezone ({getUserTimezoneShort()})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Primary Academic Center: London · Dubai · New York Virtual Cohorts
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 text-sm font-bold">
              <Shield className="w-4 h-4" />
              <span>Academic Registrar Office</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Dedicated student credential support, course enrollment guidance, and transcript verification.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zayd Farooq"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. student@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Inquiry Topic
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
              >
                <option value="Course Admission Inquiry">Course Admission &amp; Cohort Registration</option>
                <option value="Technical or Zoom Support">Live Zoom Classroom &amp; Attendance Support</option>
                <option value="Curriculum & Syllabus Question">Curriculum, Books &amp; Reading Materials</option>
                <option value="Academic Advising">Academic Advising &amp; Transcripts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Details
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your question, admission inquiry, or feedback..."
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
              />
            </div>

            {submitted && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Thank you! Your inquiry has been dispatched to Deen Hijrah Academia Admissions.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Dispatching Message...' : 'Send Inquiry to Academia'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
