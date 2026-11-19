import React, { useEffect } from 'react';
import { X, Calendar, MapPin, ArrowUpRight, Pin, Trash2, Sparkles, Plus, Video } from 'lucide-react';
import type { CalendarEvent, Course } from '../types';
import { formatToLocalTime, getUserTimezoneShort } from '../utils/timezone';
import { resolveMediaSrc } from '../assets/fallbacks';

interface EventsPinBoardProps {
  isOpen: boolean;
  events: CalendarEvent[];
  courses: Course[];
  customLogoUrl?: string;
  isAdmin?: boolean;
  isStaff?: boolean;
  onClose: () => void;
  onSelectCourse: (course: Course) => void;
  onTogglePinEvent?: (id: string, pinned: boolean) => Promise<void>;
  onDeleteEvent?: (id: string) => Promise<void>;
  onManageEvents?: () => void;
  onJoinEventMeeting?: (ev: CalendarEvent) => void;
  onStartEventMeeting?: (ev: CalendarEvent) => void;
}

const PIN_COLOR_STYLES: Record<
  NonNullable<CalendarEvent['pinColor']>,
  { head: string; rim: string; glow: string; ribbon: string }
> = {
  aqua: {
    head: 'from-[#67E8F9] to-[#0284C7]',
    rim: 'border-[#00F2FE]/80',
    glow: 'shadow-[0_6px_14px_rgba(0,242,254,0.45)]',
    ribbon: 'text-[#0284C7] dark:text-[#00F2FE]',
  },
  emerald: {
    head: 'from-[#6EE7B7] to-[#059669]',
    rim: 'border-[#10B981]/80',
    glow: 'shadow-[0_6px_14px_rgba(16,185,129,0.45)]',
    ribbon: 'text-emerald-700 dark:text-emerald-400',
  },
  crimson: {
    head: 'from-[#FCA5A5] to-[#DC2626]',
    rim: 'border-[#EF4444]/80',
    glow: 'shadow-[0_6px_14px_rgba(239,68,68,0.45)]',
    ribbon: 'text-rose-700 dark:text-rose-400',
  },
  amber: {
    head: 'from-[#FDE68A] to-[#D97706]',
    rim: 'border-[#F59E0B]/80',
    glow: 'shadow-[0_6px_14px_rgba(245,158,11,0.45)]',
    ribbon: 'text-amber-700 dark:text-amber-300',
  },
};

export const EventsPinBoard: React.FC<EventsPinBoardProps> = ({
  isOpen,
  events,
  courses,
  customLogoUrl,
  isAdmin = false,
  isStaff = false,
  onClose,
  onSelectCourse,
  onTogglePinEvent,
  onDeleteEvent,
  onManageEvents,
  onJoinEventMeeting,
  onStartEventMeeting,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pinnedEvents = events.filter((ev) => !ev.isDerived && ev.pinnedToBoard !== false);
  const localTz = getUserTimezoneShort();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="events-pin-board-title"
      onClick={onClose}
    >
      {/* Rectangular Architectural Poster Board Frame */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl bg-slate-100 dark:bg-[#081528] border-[6px] border-slate-300 dark:border-[#1E3352] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.85)] overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* 4 Corner Metallic Grommets / Frame Pins */}
        <span
          aria-hidden="true"
          className="absolute top-2.5 left-2.5 z-30 w-3 h-3 rounded-full bg-gradient-to-br from-slate-200 to-slate-500 dark:from-slate-400 dark:to-slate-700 border border-white/40 shadow-inner pointer-events-none"
        />
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-2.5 z-30 w-3 h-3 rounded-full bg-gradient-to-br from-slate-200 to-slate-500 dark:from-slate-400 dark:to-slate-700 border border-white/40 shadow-inner pointer-events-none"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 left-2.5 z-30 w-3 h-3 rounded-full bg-gradient-to-br from-slate-200 to-slate-500 dark:from-slate-400 dark:to-slate-700 border border-white/40 shadow-inner pointer-events-none"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-2.5 z-30 w-3 h-3 rounded-full bg-gradient-to-br from-slate-200 to-slate-500 dark:from-slate-400 dark:to-slate-700 border border-white/40 shadow-inner pointer-events-none"
        />

        {/* Board Top Frame Header */}
        <div className="px-7 sm:px-9 py-4 bg-white dark:bg-[#0B1C34] border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0A192F] border border-[#00F2FE]/45 p-1.5 flex items-center justify-center shrink-0">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt="Deen Hijrah Academia"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Pin className="w-4 h-4 text-[#00F2FE]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono text-[#0284C7] dark:text-[#00F2FE]">
                <span>Deen Hijrah Academia</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{pinnedEvents.length} Pinned</span>
                <span aria-hidden="true">·</span>
                <span>Local Time ({localTz})</span>
              </div>
              <h2
                id="events-pin-board-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate"
              >
                Upcoming Events &amp; Campus Notice Board
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && onManageEvents && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageEvents();
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage Events</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close events poster board"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cork / Architectural Pegboard Field */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-9 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px]">
          {pinnedEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 pt-2">
              {pinnedEvents.map((ev) => {
                const pinStyle = PIN_COLOR_STYLES[ev.pinColor || 'aqua'];
                const timeObj = formatToLocalTime(ev.startUtc);
                const linkedCourse = ev.courseId
                  ? courses.find((c) => c.id === ev.courseId)
                  : undefined;

                return (
                  <article
                    key={ev.id}
                    className="relative pt-4 group sm:odd:-rotate-1 sm:even:rotate-1 hover:rotate-0 transition-transform duration-200 flex flex-col"
                  >
                    {/* Physical 3D Pushpin Head */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${pinStyle.head} border-2 ${pinStyle.rim} ${pinStyle.glow} flex items-center justify-center`}
                      >
                        <span className="w-2 h-2 rounded-full bg-white/80" />
                      </div>
                      <div className="w-1 h-2.5 bg-slate-500 dark:bg-slate-400 rounded-b-full -mt-0.5 shadow" />
                    </div>

                    {/* Pinned Rectangular Poster Sheet */}
                    <div className="flex-1 flex flex-col justify-between bg-white dark:bg-[#0D213B] border border-slate-200 dark:border-slate-700/90 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.22)] dark:shadow-[0_18px_36px_-10px_rgba(0,0,0,0.75)] rounded-md overflow-hidden">
                      {/* Poster Top Media */}
                      <div className="relative aspect-[16/10] w-full bg-[#071426] overflow-hidden">
                        {ev.posterUrl ? (
                          <img
                            src={resolveMediaSrc(ev.posterUrl, 'hero')}
                            alt={ev.title}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0F2942] via-[#0A192F] to-[#071120] flex flex-col items-center justify-center p-4 text-center">
                            <svg
                              viewBox="0 0 100 100"
                              className="w-12 h-12 text-[#00F2FE]/80 mb-1"
                              aria-hidden="true"
                            >
                              <rect
                                x="24"
                                y="24"
                                width="52"
                                height="52"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                rx="4"
                              />
                              <rect
                                x="24"
                                y="24"
                                width="52"
                                height="52"
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="3"
                                rx="4"
                                transform="rotate(45 50 50)"
                              />
                            </svg>
                            <span className="text-[11px] font-mono text-slate-300 tracking-wider">
                              Official Academia Notice
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />

                        {/* Automatic Deen Hijrah Academia Logo Watermark */}
                        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/85 border border-[#00F2FE]/45 pointer-events-none">
                          {customLogoUrl ? (
                            <img
                              src={customLogoUrl}
                              alt="Deen Hijrah Academia"
                              referrerPolicy="no-referrer"
                              className="w-3.5 h-3.5 object-contain"
                            />
                          ) : (
                            <Sparkles className="w-3 h-3 text-[#00F2FE]" />
                          )}
                          <span className="text-[10px] font-bold font-mono text-white tracking-wider uppercase">
                            Deen Hijrah
                          </span>
                        </div>

                        {/* Date & Time Scrim Bottom */}
                        <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[11px] font-mono text-white tabular-nums">
                          <span className="font-semibold text-[#00F2FE]">{timeObj.localDayStr}</span>
                          <span>{timeObj.localTimeStr}</span>
                        </div>
                      </div>

                      {/* Poster Sheet Details */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className={`flex flex-wrap items-center gap-1.5 text-[11px] font-medium ${pinStyle.ribbon}`}>
                            <span className="capitalize">{ev.type.replace('_', ' ')}</span>
                            {ev.locationOrLabel && (
                              <>
                                <span aria-hidden="true" className="text-slate-400">·</span>
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  {ev.locationOrLabel}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                            {ev.title}
                          </h3>

                          {ev.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                              {ev.description}
                            </p>
                          )}

                          {ev.instructorName && (
                            <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              Instructor: {ev.instructorName}
                            </div>
                          )}

                          {ev.courseTitle && (
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                              Course: {ev.courseTitle}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            {ev.meetingId && (isAdmin || isStaff) && onStartEventMeeting && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onStartEventMeeting(ev);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <Video className="w-3 h-3" />
                                <span>Start Host</span>
                              </button>
                            )}

                            {ev.meetingId && onJoinEventMeeting ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onJoinEventMeeting(ev);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <Video className="w-3 h-3" />
                                <span>Join Meeting</span>
                              </button>
                            ) : linkedCourse ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onSelectCourse(linkedCourse);
                                }}
                                className="font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                              >
                                <span>Open Course</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                <Calendar className="w-3 h-3" />
                                {timeObj.timezoneLabel}
                              </span>
                            )}
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-2 shrink-0">
                              {onTogglePinEvent && (
                                <button
                                  type="button"
                                  onClick={() => void onTogglePinEvent(ev.id, false)}
                                  className="text-[11px] font-medium text-amber-600 dark:text-amber-300 hover:underline whitespace-nowrap shrink-0"
                                >
                                  Unpin
                                </button>
                              )}
                              {onDeleteEvent && (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteEvent(ev.id)}
                                  aria-label={`Delete event ${ev.title}`}
                                  className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="max-w-lg mx-auto my-8 p-8 rounded-2xl bg-white dark:bg-[#0D213B] border border-slate-200 dark:border-slate-700 text-center space-y-3 shadow-lg">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#00F2FE]/15 border border-[#00F2FE]/40 text-[#0284C7] dark:text-[#00F2FE] flex items-center justify-center">
                <Pin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Pinned Events on the Notice Board Yet
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Upcoming seminars, cohort launch posters, and academy announcements pinned by Administrator Mustaqeem appear here with local timezone scheduling.
              </p>
              {isAdmin && onManageEvents && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageEvents();
                  }}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pin First Event</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Board Bottom Frame Bar */}
        <div className="px-7 sm:px-9 py-3.5 bg-white dark:bg-[#0B1C34] border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Reopen anytime from the homepage or Schedule page.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:text-slate-950 dark:bg-gradient-to-r dark:from-[#00F2FE] dark:to-[#10B981] dark:hover:brightness-110 transition-all whitespace-nowrap shrink-0"
          >
            Continue to Academia
          </button>
        </div>
      </div>
    </div>
  );
};
