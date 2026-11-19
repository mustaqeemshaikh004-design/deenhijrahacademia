import React from 'react';
import { BookOpen, ShieldCheck, Globe, Award } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section
      id="about-section"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-slate-800/80"
    >
      <div className="max-w-3xl mb-12">
        <div className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] tracking-wider uppercase mb-1">
          Scholastic Mission &amp; Heritage
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          About Deen Hijrah Academia
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Deen Hijrah Academia is dedicated to reviving classical Islamic pedagogy through state-of-the-art interactive digital infrastructure, pairing structured transmission with modern clarity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#00F2FE]/10 border border-[#00F2FE]/30 text-[#0284C7] dark:text-[#00F2FE] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Authentic Classical Lineage
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Our curriculum builds upon primary classical sources (Nawawi, Ibn Hajar, Ghazali, Suyuti) taught by instructors holding verified sanad (chains of scholastic transmission).
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-[#059669] dark:text-[#10B981] flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Global Timezone Intelligence
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Eliminating timezone confusion with automatic browser geo-clocking, synchronized Zoom live sessions, and protected MP4 lecture archives.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Strict Moderated Sanctuary
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            An adab-first campus where automated safety moderation enforces ethical Islamic decorum across community posts, group chats, and student submissions.
          </p>
        </div>
      </div>

      <div className="p-8 rounded-3xl bg-gradient-to-r from-[#0F2942] via-[#0A192F] to-[#071120] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 text-white">
        <div>
          <h4 className="text-lg font-bold text-white">Structured Academic Mastery</h4>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Our integrated assessment pipelines (Pop Quizzes, Homework, and Capstone Projects) cultivate continuous mastery and recognized institutional progress.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-xs text-[#00F2FE]">
          <Award className="w-4 h-4 text-emerald-400" />
          <span>Certifications &amp; Verified Transcripts</span>
        </div>
      </div>
    </section>
  );
};
