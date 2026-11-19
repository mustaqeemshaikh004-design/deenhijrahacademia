import React, { useState, useEffect } from 'react';
import {
  Play,
  Lock,
  CheckCircle2,
  Clock,
  FileDown,
  Video,
  Unlock,
  Sparkles,
} from 'lucide-react';
import type { CompletedVideoArchive, Course } from '../types';
import { ProtectedVideoPlayer } from './ProtectedVideoPlayer';
import { resolveMediaSrc } from '../assets/fallbacks';

interface CourseRecordingsWorkspaceProps {
  course: Course;
  isEnrolled: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
  viewerEmail?: string;
  customLogoUrl?: string;
  onEnroll: () => void;
  onDeleteRecording?: (recId: string) => void;
  canManage?: boolean;
}

export const CourseRecordingsWorkspace: React.FC<CourseRecordingsWorkspaceProps> = ({
  course,
  isEnrolled,
  isAdmin = false,
  isStaff = false,
  viewerEmail,
  customLogoUrl,
  onEnroll,
  onDeleteRecording,
  canManage = false,
}) => {
  const recordings = course.videoArchives || [];
  const orientationLectures = recordings.filter((r) => Boolean(r.isOrientation));
  const cohortLectures = recordings.filter((r) => !r.isOrientation);
  const hasStaffPrivileges = Boolean(isAdmin || isStaff);

  const pickDefaultRecording = (): CompletedVideoArchive | null => {
    if (orientationLectures.length > 0) return orientationLectures[0];
    return recordings[0] || null;
  };

  const [selectedId, setSelectedId] = useState<string>(
    () => pickDefaultRecording()?.id || ''
  );

  useEffect(() => {
    const exists = recordings.some((r) => r.id === selectedId);
    if (!exists) {
      setSelectedId(pickDefaultRecording()?.id || '');
    }
  }, [course.id, recordings.length]);

  const selectedRecording =
    recordings.find((r) => r.id === selectedId) || pickDefaultRecording();

  const selectedIndex = selectedRecording
    ? recordings.findIndex((r) => r.id === selectedRecording.id)
    : -1;

  const isSelectedAccessible = selectedRecording
    ? Boolean(selectedRecording.isOrientation || isEnrolled || hasStaffPrivileges)
    : false;

  const openCount = isEnrolled || hasStaffPrivileges
    ? recordings.length
    : orientationLectures.length;
  const lockedCount = Math.max(0, recordings.length - openCount);

  if (recordings.length === 0) {
    return (
      <div className="p-10 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-[#0284C7] dark:text-[#00F2FE]">
          <Video className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          No Lecture Recordings Published Yet
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          Orientation previews and recorded cohort sessions will appear in this curriculum workspace as soon as they are uploaded or synced from live classes.
        </p>
      </div>
    );
  }

  const renderPlaylistItem = (rec: CompletedVideoArchive, orderNum: number) => {
    const isSelected = selectedRecording?.id === rec.id;
    const unlocked = Boolean(rec.isOrientation || isEnrolled || hasStaffPrivileges);
    return (
      <button
        key={rec.id}
        type="button"
        onClick={() => setSelectedId(rec.id)}
        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
          isSelected
            ? 'bg-sky-50/90 dark:bg-[#00F2FE]/10 border-[#0284C7] dark:border-[#00F2FE]/60 shadow-sm'
            : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Mini Thumbnail with Lock / Play State */}
        <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-200 dark:border-slate-800">
          <img
            src={resolveMediaSrc(rec.thumbnailUrl, 'course')}
            alt={rec.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover ${!unlocked ? 'brightness-50 blur-[1px]' : 'brightness-90'}`}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {unlocked ? (
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isSelected
                    ? 'bg-[#00F2FE] text-slate-950'
                    : 'bg-black/75 text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-rose-950/90 border border-rose-400/50 text-rose-300 flex items-center justify-center">
                <Lock className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>

        {/* Lesson Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span>
              Lesson {String(orderNum).padStart(2, '0')} · {rec.duration}
            </span>
            {rec.isOrientation ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Orientation
              </span>
            ) : unlocked ? (
              <span className="text-[#0284C7] dark:text-[#00F2FE] font-semibold">
                Unlocked
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Locked
              </span>
            )}
          </div>
          <div
            className={`text-xs font-bold mt-1 line-clamp-2 leading-snug ${
              isSelected
                ? 'text-slate-950 dark:text-white'
                : unlocked
                ? 'text-slate-800 dark:text-slate-200'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {rec.title}
          </div>
          {rec.supplementaryPdfName && (
            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <FileDown className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
              <span className="truncate">{rec.supplementaryPdfName}</span>
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Access Policy Header Bar (Clean Zero-Pill Architecture) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#0284C7] dark:text-[#00F2FE] uppercase tracking-wider font-semibold">
            Curriculum Recordings Stage · {course.code}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {isEnrolled || hasStaffPrivileges
              ? `Full cohort archive unlocked — ${recordings.length} recorded sessions and study sheets ready.`
              : `Orientation lectures are open for preview (${orientationLectures.length}). All ${cohortLectures.length} class recordings remain locked until you complete free course enrollment.`}
          </p>
        </div>

        {!isEnrolled && !hasStaffPrivileges ? (
          <button
            type="button"
            onClick={onEnroll}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Enroll Free to Unlock All ({lockedCount})
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>All Recordings Unlocked</span>
          </div>
        )}
      </div>

      {/* SourceCode Academy 2-Zone Video Stage + Structured Curriculum Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Learning Stage (Left 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedRecording && (
            <>
              <ProtectedVideoPlayer
                courseId={course.id}
                recording={selectedRecording}
                isEnrolled={isEnrolled}
                isAdmin={isAdmin}
                isStaff={isStaff}
                viewerEmail={viewerEmail}
                customLogoUrl={customLogoUrl}
                onEnroll={onEnroll}
                canManage={canManage}
                onDelete={
                  onDeleteRecording
                    ? () => onDeleteRecording(selectedRecording.id)
                    : undefined
                }
              />

              {/* Active Lesson Summary Footer */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#0284C7] dark:text-[#00F2FE] font-bold">
                      Session {String(selectedIndex + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedRecording.duration}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Instructor: {course.instructorName}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      isSelectedAccessible
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }`}
                  >
                    {isSelectedAccessible ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        {selectedRecording.isOrientation ? 'Free Orientation' : 'Enrolled Access'}
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Locked Class Recording
                      </>
                    )}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {selectedRecording.title}
                </h3>
              </div>
            </>
          )}
        </div>

        {/* Structured Curriculum Playlist Sidebar (Right 4 cols) */}
        <aside className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 p-4 space-y-4 lg:sticky lg:top-20 max-h-[720px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Course Recordings
              </h4>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {openCount} Open · {lockedCount} Locked
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] font-semibold">
              {recordings.length} Total
            </span>
          </div>

          {/* Section 01: Free Course Orientation */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
              01 · Course Orientation (Public)
            </div>
            {orientationLectures.length > 0 ? (
              <div className="space-y-2">
                {orientationLectures.map((rec) =>
                  renderPlaylistItem(
                    rec,
                    recordings.findIndex((r) => r.id === rec.id) + 1
                  )
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                No public orientation uploaded for this cohort yet.
              </div>
            )}
          </div>

          {/* Section 02: Enrolled Cohort Class Recordings */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
              <span>02 · Cohort Class Recordings</span>
              {!isEnrolled && !hasStaffPrivileges && (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>
            {cohortLectures.length > 0 ? (
              <div className="space-y-2">
                {cohortLectures.map((rec) =>
                  renderPlaylistItem(
                    rec,
                    recordings.findIndex((r) => r.id === rec.id) + 1
                  )
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                Subsequent weekly cohort sessions will archive here as classes conclude.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
