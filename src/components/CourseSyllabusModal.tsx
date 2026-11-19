import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  Video,
  FileText,
  CheckCircle2,
  Sparkles,
  Bot,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Course, User } from '../types';
import { formatToLocalTime, getUserTimezoneShort } from '../utils/timezone';

import { CourseRecordingsWorkspace } from './CourseRecordingsWorkspace';

interface CourseSyllabusModalProps {
  course: Course | null;
  onClose: () => void;
  currentUser: User | null;
  onEnroll: (courseId: string) => Promise<void>;
  onJoinClassWithAttendance: (courseId: string, scheduleId: string) => void;
  onStartMeeting?: (info: {
    title: string;
    courseId: string;
    courseTitle: string;
    scheduleId: string;
    instructorName: string;
    meetingId: string;
    meetingPasscode?: string;
    joinUrl?: string;
  }) => void;
  onNavigateToPortal: (courseId: string) => void;
  customLogoUrl?: string;
}

export const CourseSyllabusModal: React.FC<CourseSyllabusModalProps> = ({
  course,
  onClose,
  currentUser,
  onEnroll,
  onJoinClassWithAttendance,
  onStartMeeting,
  onNavigateToPortal,
  customLogoUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'syllabus' | 'recordings' | 'schedules' | 'materials' | 'tutor'>('syllabus');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

  // Embedded AI Tutor state
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorMessages, setTutorMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([]);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

  if (!course) return null;

  const isEnrolled = currentUser ? course.enrolledStudentIds.includes(currentUser.id) : false;
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const isModuleOpen = (id: string, idx: number) =>
    expandedModules[id] !== undefined ? expandedModules[id] : idx === 0;

  const toggleModule = (id: string, idx: number) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !(prev[id] !== undefined ? prev[id] : idx === 0),
    }));
  };

  const handleEnrollment = async () => {
    if (!currentUser) {
      await onEnroll(course.id);
      return;
    }
    setIsEnrolling(true);
    try {
      await onEnroll(course.id);
      setEnrollmentSuccess(true);
      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00F2FE', '#10B981', '#38BDF8'],
      });
      setTimeout(() => {
        setEnrollmentSuccess(false);
      }, 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuery.trim() || isAskingTutor) return;

    const userText = tutorQuery.trim();
    setTutorMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setTutorQuery('');
    setIsAskingTutor(true);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: course.title,
          moduleContext: course.modules,
          query: userText,
        }),
      });
      const data = await res.json();
      setTutorMessages((prev) => [
        ...prev,
        { sender: 'tutor', text: data.answer || 'Thank you for your question. Please review the syllabus modules.' },
      ]);
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        { sender: 'tutor', text: 'I am temporarily unable to reach the knowledge base. Please check back shortly.' },
      ]);
    } finally {
      setIsAskingTutor(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0A192F] border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Modal Header */}
        <div className="relative p-6 bg-gradient-to-r from-[#0F2942] to-[#0A192F] border-b border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
            <span className="font-mono text-[#00F2FE]">{course.code}</span>
            <span aria-hidden="true">·</span>
            <span>{course.level} Level</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">{course.status}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight pr-8">
            {course.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {course.description}
          </p>

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {isEnrolled ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enrolled Student
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToPortal(course.id);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all flex items-center gap-1"
                >
                  Enter Course Portal →
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEnrollment}
                disabled={isEnrolling}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isEnrolling ? 'Enrolling...' : 'Enroll in Cohort (Instant & Free)'}
              </button>
            )}

            <div className="text-xs text-slate-400">
              Instructor: <span className="text-slate-200 font-medium">{course.instructorName}</span>
            </div>
          </div>

          {/* Toast Notification for Enrollment Success */}
          {enrollmentSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Enrolled Successfully! Welcome to Deen Hijrah Academia. You now have full access to live classrooms, PDF materials, and assessments.
              </span>
            </motion.div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 overflow-x-auto">
          {[
            { key: 'syllabus', label: 'Orientation & Syllabus', icon: BookOpen },
            { key: 'recordings', label: `Lectures (${course.videoArchives.length})`, icon: Video },
            { key: 'schedules', label: 'Live Schedules & Zoom', icon: Calendar },
            { key: 'materials', label: 'Reading Materials', icon: FileText },
            { key: 'tutor', label: 'Course AI Tutor', icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#00F2FE] text-[#00F2FE]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Animated Staggered Syllabus */}
          {activeTab === 'syllabus' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{course.modules.length} Modules in this Curriculum</span>
                <span>Structured Classical Pedagogy</span>
              </div>

              {course.modules.length > 0 ? (
                <div className="space-y-3">
                  {course.modules.map((module, idx) => {
                    const expanded = isModuleOpen(module.id, idx);
                    return (
                      <motion.div
                        key={module.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.3 }}
                        className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleModule(module.id, idx)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                        >
                          <div>
                            <div className="text-[11px] font-mono text-[#00F2FE]">
                              Module {idx + 1} · {module.lecturesCount} Lectures
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                              {module.title}
                            </h4>
                          </div>
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-3 text-xs">
                            <p className="text-slate-300 leading-relaxed">
                              {module.description}
                            </p>

                            {module.learningObjectives && module.learningObjectives.length > 0 && (
                              <div>
                                <div className="font-semibold text-slate-200 mb-1.5">
                                  Learning Objectives:
                                </div>
                                <ul className="space-y-1 text-slate-400 pl-4 list-disc">
                                  {module.learningObjectives.map((obj, i) => (
                                    <li key={i}>{obj}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {module.instructorNotes && (
                              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-slate-300">
                                <span className="font-semibold text-[#10B981]">Instructor Note: </span>
                                {module.instructorNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  No modules published yet. Administrator Mustaqeem or faculty can add modules in the portal.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Lecture Recordings (Orientation free, private locked until enrolled) */}
          {activeTab === 'recordings' && (
            <CourseRecordingsWorkspace
              course={course}
              isEnrolled={isEnrolled}
              isAdmin={currentUser?.role === 'admin'}
              isStaff={isStaff}
              viewerEmail={currentUser?.email}
              customLogoUrl={customLogoUrl}
              onEnroll={handleEnrollment}
            />
          )}

          {/* TAB 3: Live Schedules & Timezone Auto-Clocking */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4 text-[#00F2FE]" />
                  <span>
                    Detected Local Timezone: <strong className="text-white font-mono">{getUserTimezoneShort()}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Auto-Clock Active
                </span>
              </div>

              {course.schedules.length > 0 ? (
                <div className="space-y-3">
                  {course.schedules.map((sch) => {
                    const localTime = formatToLocalTime(sch.timeUtc, sch.dayOfWeek);
                    return (
                      <div
                        key={sch.id}
                        className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-white">{sch.title}</span>
                            {sch.isLiveNow && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                LIVE NOW
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                            Instructor: {sch.instructorName || course.instructorName}
                          </div>

                          <div className="mt-1 text-xs text-slate-300 font-mono flex flex-wrap items-center gap-2">
                            <span className="text-[#00F2FE] font-bold">{localTime.localTimeStr}</span>
                            <span>({sch.dateStr ? `${sch.dateStr} · ` : ''}{localTime.localDayStr})</span>
                            <span className="text-slate-500">· {sch.durationMinutes} mins</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Meeting ID: {sch.zoomMeetingId} · Recording Sync Enabled
                          </div>
                        </div>

                        {/* Join / Start Class Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          {isStaff && onStartMeeting && (
                            <button
                              type="button"
                              onClick={() =>
                                onStartMeeting({
                                  title: sch.title,
                                  courseId: course.id,
                                  courseTitle: course.title,
                                  scheduleId: sch.id,
                                  instructorName: sch.instructorName || course.instructorName,
                                  meetingId: sch.zoomMeetingId,
                                  meetingPasscode: sch.zoomPasscode,
                                  joinUrl: sch.zoomJoinUrl,
                                })
                              }
                              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Start Meeting (Host)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onJoinClassWithAttendance(course.id, sch.id)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,242,254,0.3)] whitespace-nowrap"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Meeting
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  No live sessions scheduled currently.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Course Materials & Lecture Supplementary PDFs */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              {/* Lecture Supplementary PDFs for Enrolled Students / Staff */}
              {course.videoArchives.some((rec) => rec.supplementaryPdfUrl) && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-[#00F2FE] uppercase tracking-wider font-mono">
                    Lecture Supplementary Materials (PDF)
                  </div>
                  {course.videoArchives
                    .filter((rec) => rec.supplementaryPdfUrl)
                    .map((rec) => (
                      <div
                        key={`supp-${rec.id}`}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-[#00F2FE]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#00F2FE]/15 flex items-center justify-center text-[#00F2FE] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {rec.supplementaryPdfName || `${rec.title} — Supplementary PDF`}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Attached to Lecture: {rec.title}
                            </div>
                          </div>
                        </div>

                        {isEnrolled || isStaff ? (
                          <a
                            href={`${rec.supplementaryPdfUrl}${
                              rec.supplementaryPdfUrl!.includes('?') ? '&' : '?'
                            }download=1`}
                            download={rec.supplementaryPdfName || 'supplementary-materials.pdf'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 font-bold text-xs text-center whitespace-nowrap"
                          >
                            Download Supplementary PDF
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={handleEnrollment}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs whitespace-nowrap"
                          >
                            Enroll Free to Download
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {course.materials.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Curriculum Reading Files
                  </div>
                  {course.materials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[#00F2FE]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{mat.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {mat.fileType.toUpperCase()} · {mat.size}
                          </div>
                        </div>
                      </div>

                      <a
                        href={
                          !mat.fileUrl || mat.fileUrl.startsWith('#')
                            ? `/api/courses/${encodeURIComponent(course.id)}/materials/${encodeURIComponent(mat.id)}/download`
                            : mat.fileUrl
                        }
                        download
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : !course.videoArchives.some((rec) => rec.supplementaryPdfUrl) ? (
                <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  No supplementary reading files uploaded yet.
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 4: Embedded Course AI Cluster Manager (AI Tutor) */}
          {activeTab === 'tutor' && (
            <div className="flex flex-col h-[340px] bg-slate-950/70 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <Bot className="w-4 h-4 text-[#00F2FE]" />
                  <span className="font-semibold">Course AI Tutor (Module Cluster)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Trained on {course.title}</span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-3 rounded-2xl bg-slate-900 text-slate-300 border border-slate-800">
                    Assalamu Alaykum! I am your AI Course Cluster Tutor for &quot;{course.title}&quot;. You can ask me any question about the curriculum modules, learning objectives, or classical references.
                  </div>
                </div>
                {tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl ${
                        msg.sender === 'user'
                          ? 'bg-[#00F2FE]/20 text-slate-100 border border-[#00F2FE]/40'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAskingTutor && (
                  <div className="text-slate-500 text-xs italic flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#00F2FE] animate-spin" />
                    Consulting course cluster knowledge...
                  </div>
                )}
              </div>

              <form onSubmit={handleAskTutor} className="p-2 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={tutorQuery}
                  onChange={(e) => setTutorQuery(e.target.value)}
                  placeholder="Ask a question about this course syllabus or readings..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                />
                <button
                  type="submit"
                  disabled={isAskingTutor || !tutorQuery.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#00F2FE] hover:bg-[#00F2FE]/90 text-slate-950 font-semibold text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
