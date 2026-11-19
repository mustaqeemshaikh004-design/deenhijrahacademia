import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, Compass, Calendar, BookOpen, Clock } from 'lucide-react';

interface NavigationAIAssistantProps {
  onNavigateTab: (tab: string) => void;
  userRole?: string;
}

export const NavigationAIAssistant: React.FC<NavigationAIAssistantProps> = ({
  onNavigateTab,
  userRole = 'student',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; actionTab?: string }>>([
    {
      sender: 'assistant',
      text: 'Assalamu Alaykum! I am your Deen Hijrah Academia Navigation Guide. How can I assist you with cohorts, live lecture schedules, or assessments today?',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (customQuery?: string) => {
    const textToSend = customQuery || query.trim();
    if (!textToSend || isLoading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    if (!customQuery) setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          userRole,
          currentPath: window.location.pathname,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer || 'You can explore all courses from the homepage catalog, or check your schedule in the Live Calendar.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'I can help you navigate to Courses, Live Calendar, Student Portal, or Community Hub.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: 'When is my next live class?', tab: 'schedule' },
    { label: 'Where do I submit homework?', tab: 'student-portal' },
    { label: 'Browse Courses Open for Enrollment', tab: 'courses' },
  ];

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="mb-3 w-80 sm:w-96 rounded-3xl bg-[#0A192F] border border-[#00F2FE]/40 shadow-2xl overflow-hidden flex flex-col h-[440px] text-slate-100"
          >
            {/* Header */}
            <div className="p-3.5 bg-gradient-to-r from-[#0F2942] to-[#0A192F] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00F2FE]/20 flex items-center justify-center text-[#00F2FE]">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Campus Navigation Guide</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Academic Concierge</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="p-2 bg-slate-950/60 border-b border-slate-800 flex gap-1.5 overflow-x-auto text-[11px]">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSend(qp.label);
                    onNavigateTab(qp.tab);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-[#00F2FE]/50 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded-2xl ${
                      m.sender === 'user'
                        ? 'bg-[#00F2FE]/20 text-white border border-[#00F2FE]/40'
                        : 'bg-slate-900 text-slate-200 border border-slate-800'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-slate-500 text-xs italic flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F2FE] animate-spin" />
                  Locating platform coordinates...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-2 border-t border-slate-800 bg-slate-950 flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask where to find classes, quizzes..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="p-2 rounded-xl bg-[#00F2FE] text-slate-950 font-bold disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0F2942] to-[#0A192F] border border-[#00F2FE]/60 text-[#00F2FE] flex items-center justify-center shadow-[0_0_20px_rgba(0,242,254,0.35)] hover:scale-105 transition-all group"
      >
        <Bot className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    </div>
  );
};
