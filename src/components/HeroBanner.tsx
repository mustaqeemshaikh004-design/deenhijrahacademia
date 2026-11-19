import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  BookOpen,
  ArrowRight,
  UserPlus,
  Clock,
  Globe,
  ShieldCheck,
  Sparkles,
  Pin,
} from 'lucide-react';
import type { Course, PlatformSettings } from '../types';
import { resolveMediaSrc } from '../assets/fallbacks';

interface HeroBannerProps {
  settings: PlatformSettings;
  courses?: Course[];
  customLogoUrl?: string;
  isAdmin?: boolean;
  onSelectCourse?: (course: Course) => void;
  onExploreCourses: () => void;
  onOpenEnrollment: () => void;
  totalCoursesCount: number;
  pinnedEventsCount?: number;
  onOpenPinBoard?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  settings,
  courses = [],
  customLogoUrl,
  onSelectCourse,
  onExploreCourses,
  onOpenEnrollment,
  totalCoursesCount,
  pinnedEventsCount = 0,
  onOpenPinBoard,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [settings.heroVideoUrl, settings.heroMode]);

  const showHeroVideo =
    settings.heroMode === 'video' &&
    Boolean(settings.heroVideoUrl?.trim()) &&
    !videoFailed;

  const posterSrc = resolveMediaSrc(settings.heroPosterUrl || settings.heroImageUrl, 'hero');
  const coverSrc = resolveMediaSrc(settings.heroImageUrl, 'hero');

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPaused(false);
    } else {
      videoRef.current.pause();
      setIsPaused(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <section className="relative overflow-hidden bg-[#050C18] text-white border-b border-slate-200 dark:border-slate-800/80">
      {/* Source Code Academy Inspired Cinema Stage */}
      <div className="relative w-full min-h-[540px] lg:min-h-[640px] flex flex-col justify-between">
        {/* Background Video or High-Resolution Cover Frame */}
        <div
          className="absolute inset-0 z-0 overflow-hidden select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {showHeroVideo ? (
            <video
              ref={videoRef}
              key={settings.heroVideoUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onError={() => setVideoFailed(true)}
              poster={posterSrc}
              className="w-full h-full object-cover scale-[1.02] brightness-[0.82]"
            >
              <source
                src={settings.heroVideoUrl}
                type="video/mp4"
                onError={() => setVideoFailed(true)}
              />
            </video>
          ) : (
            <img
              src={coverSrc}
              alt="Deen Hijrah Academia Hero"
              referrerPolicy="no-referrer"
              draggable={false}
              className="w-full h-full object-cover scale-[1.02] brightness-[0.8]"
            />
          )}

          {/* Directional Source-Code-style Scrim for High WCAG Readability over Cinema Media */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#040B16]/95 via-[#071120]/75 to-[#071120]/30 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040B16] via-transparent to-[#040B16]/40 pointer-events-none" />
        </div>

        {/* Non-downloadable Video Controls (Top/Bottom Right Corner) */}
        {showHeroVideo && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              title={isPaused ? 'Play showcase video' : 'Pause showcase video'}
              className="p-2 rounded-xl bg-black/55 hover:bg-black/75 text-white border border-white/15 backdrop-blur-md transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? 'Unmute video' : 'Mute video'}
              className="p-2 rounded-xl bg-black/55 hover:bg-black/75 text-white border border-white/15 backdrop-blur-md transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Foreground Content Overlay (Left-Aligned Source Code Rhythm) */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-8 flex-1 flex flex-col justify-center">
          <div className="max-w-2xl">
            {/* Live Cohort Status Beacon (Source Code Academy Style) */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#040B16]/75 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-medium text-white mb-5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-dha-live-dot shrink-0" />
              <span>Live online classes</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-[#00F2FE] font-mono text-xs">Free Orientation Open</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight text-white leading-[1.12] text-balance">
              {settings.heroHeadline || 'Pursue Sacred Knowledge with Rigor & Elegance'}
            </h1>

            <p className="mt-4 sm:mt-5 text-sm sm:text-base lg:text-lg text-slate-200 leading-relaxed max-w-xl">
              {settings.heroSubheadline ||
                'A sanctuary of classical Islamic scholarship engineered with immersive real-time classrooms, automated Zoom lecture archives, and global timezone intelligence.'}
            </p>

            {/* Primary CTA Cluster */}
            <div className="mt-7 sm:mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onExploreCourses}
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_24px_rgba(0,242,254,0.38)] flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                <span className="tabular-nums">View Courses ({totalCoursesCount})</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={onOpenEnrollment}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4 text-[#00F2FE]" />
                <span>Create Student Account</span>
              </button>

              {onOpenPinBoard && (
                <button
                  type="button"
                  onClick={onOpenPinBoard}
                  className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-slate-950/65 hover:bg-slate-900/90 backdrop-blur-md border border-[#00F2FE]/40 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Pin className="w-4 h-4 text-[#00F2FE]" />
                  <span className="tabular-nums">
                    Notice Pin Board{pinnedEventsCount > 0 ? ` (${pinnedEventsCount})` : ''}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Dock Inside Hero: Source Code Academy Floating Course Thumbnails Shelf (when courses exist) OR Clean Architecture Metrics */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-12">
          {courses.length > 0 ? (
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-3">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F2FE]" />
                  <span>Featured Cohort Thumbnails</span>
                </span>
                <button
                  type="button"
                  onClick={onExploreCourses}
                  className="text-[#00F2FE] hover:underline flex items-center gap-1"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 pt-2">
                {courses.map((course, idx) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => (onSelectCourse ? onSelectCourse(course) : onExploreCourses())}
                    style={{ animationDelay: `${(idx % 5) * 0.45}s` }}
                    className="animate-dha-float group relative w-[150px] sm:w-[168px] aspect-[4/5] rounded-2xl overflow-hidden shrink-0 border border-white/20 hover:border-[#00F2FE] bg-[#0B1C34] shadow-[0_14px_30px_-8px_rgba(0,0,0,0.65)] hover:shadow-[0_18px_36px_-8px_rgba(0,242,254,0.35)] transition-all duration-300 hover:scale-[1.03] text-left"
                  >
                    <img
                      src={resolveMediaSrc(course.thumbnail, 'course')}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 brightness-90 group-hover:brightness-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#040B16] via-[#040B16]/20 to-black/30" />

                    {/* Auto Academy Logo Watermark */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 border border-[#00F2FE]/40 backdrop-blur-md">
                      {customLogoUrl ? (
                        <img src={customLogoUrl} alt="" referrerPolicy="no-referrer" className="w-3 h-3 object-contain" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[#00F2FE]" />
                      )}
                      <span className="text-[8px] font-bold font-mono text-white tracking-wider uppercase">
                        DHA
                      </span>
                    </div>

                    <div className="absolute inset-x-2.5 bottom-2.5 space-y-0.5">
                      <div className="text-[10px] font-mono text-[#00F2FE] truncate">
                        {course.code} · {course.level}
                      </div>
                      <div className="text-xs font-bold text-white leading-snug line-clamp-2 group-hover:text-[#00F2FE] transition-colors">
                        {course.title}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-6 border-t border-white/15 grid grid-cols-2 md:grid-cols-4 gap-5 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#00F2FE] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">100% Auto-Clocked</div>
                  <div className="text-slate-400 text-[11px]">Local timezone display</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#10B981] shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Orientation Free</div>
                  <div className="text-slate-400 text-[11px]">Private cohort lectures gated</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-sky-300 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Zoom Cloud Sync</div>
                  <div className="text-slate-400 text-[11px]">Protected non-downloadable MP4</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Moderated Sanctuary</div>
                  <div className="text-slate-400 text-[11px]">Adab-first community feed</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
