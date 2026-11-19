import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, Award, Globe, Pin, Trash2, MapPin, Download } from 'lucide-react';
import type { CalendarEvent, Course } from '../types';
import { formatToLocalTime, getUserTimezoneShort } from '../utils/timezone';
import { resolveMediaSrc } from '../assets/fallbacks';
import { downloadEventAsIcs } from '../utils/icsCalendar';

interface AcademicCalendarProps {
  events: CalendarEvent[];
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onOpenPinBoard?: () => void;
  isAdmin?: boolean;
  isStaff?: boolean;
  onDeleteEvent?: (id: string) => void;
  onJoinEventMeeting?: (ev: CalendarEvent) => void;
  onStartEventMeeting?: (ev: CalendarEvent) => void;
}

export const AcademicCalendar: React.FC<AcademicCalendarProps> = ({
  events,
  courses,
  onSelectCourse,
  onOpenPinBoard,
  isAdmin = false,
  isStaff = false,
  onDeleteEvent,
  onJoinEventMeeting,
  onStartEventMeeting,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const userTz = getUserTimezoneShort();

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'all') return true;
    return ev.type === filterType;
  });

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-gradient-to-r dark:from-[#0F2942] dark:to-[#0A192F] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#0284C7] dark:text-[#00F2FE] mb-1">
            <Globe className="w-4 h-4 shrink-0" />
            <span>Global Timezone Auto-Clocking Active</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Academic Schedule &amp; Master Calendar
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            All live cohorts, events, quiz cutoffs, and deadlines convert automatically to your local timezone:{' '}
            <strong className="text-slate-900 dark:text-white font-mono tabular-nums">{userTz}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onOpenPinBoard && (
            <button
              type="button"
              onClick={onOpenPinBoard}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Poster Pin Board</span>
            </button>
          )}

          {/* Interactive Filter Controls */}
          <div className="flex flex-wrap items-center p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            {[
              { key: 'all', label: 'All' },
              { key: 'event', label: 'Academy Events' },
              { key: 'lecture', label: 'Live Lectures' },
              { key: 'quiz', label: 'Pop Quizzes' },
              { key: 'homework', label: 'Deadlines' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-lg transition-all font-medium whitespace-nowrap shrink-0 ${
                  filterType === f.key
                    ? 'bg-white dark:bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev) => {
            const timeObj = formatToLocalTime(ev.startUtc);
            const course = courses.find((c) => c.id === ev.courseId);

            return (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-[#00F2FE]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {ev.posterUrl ? (
                    <img
                      src={resolveMediaSrc(ev.posterUrl, 'hero')}
                      alt={ev.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        ev.type === 'lecture'
                          ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30'
                          : ev.type === 'quiz'
                          ? 'bg-[#00F2FE]/10 text-[#0284C7] dark:text-[#00F2FE] border-[#00F2FE]/30'
                          : ev.type === 'event'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {ev.type === 'lecture' ? (
                        <Video className="w-5 h-5" />
                      ) : ev.type === 'quiz' ? (
                        <Award className="w-5 h-5" />
                      ) : ev.type === 'event' ? (
                        <CalendarIcon className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono uppercase tracking-wider text-[11px]">
                        {ev.type.replace('_', ' ')}
                      </span>
                      {ev.pinnedToBoard && !ev.isDerived && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#0284C7] dark:text-[#00F2FE] font-semibold">Pinned on Board</span>
                        </>
                      )}
                      {ev.courseTitle && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#0284C7] dark:text-[#00F2FE]">
                            {ev.courseTitle}
                          </span>
                        </>
                      )}
                      {ev.locationOrLabel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {ev.locationOrLabel}
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{ev.title}</h4>
                    {ev.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1.5 flex flex-wrap items-center gap-2 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-900 dark:text-white font-semibold">{timeObj.localTimeStr}</span>
                      <span>({ev.dateStr ? `${ev.dateStr} · ` : ''}{timeObj.localDayStr})</span>
                      {ev.instructorName && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                          · Instructor: {ev.instructorName}
                        </span>
                      )}
                      <span>· {timeObj.diffNote}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ev.meetingId && (isAdmin || isStaff) && onStartEventMeeting && (
                    <button
                      type="button"
                      onClick={() => onStartEventMeeting(ev)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Start Meeting (Host)
                    </button>
                  )}

                  {ev.meetingId && onJoinEventMeeting && (
                    <button
                      type="button"
                      onClick={() => onJoinEventMeeting(ev)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Meeting
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => downloadEventAsIcs(ev)}
                    title="Download .ics calendar invite for Google Calendar, Apple Calendar, or Outlook"
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Download .ics File</span>
                  </button>

                  {course && (
                    <button
                      type="button"
                      onClick={() => onSelectCourse(course)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      Open Course
                    </button>
                  )}

                  {isAdmin && !ev.isDerived && onDeleteEvent && (
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(ev.id)}
                      title="Delete Event"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
            No academic calendar events found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};

