import React, { useState, useEffect, useRef } from 'react';
import { Lock, Play, ShieldAlert, Clock, Loader2, LogIn, FileDown } from 'lucide-react';
import type { CompletedVideoArchive } from '../types';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import {
  CHANCELLOR_EMAIL,
  formatFirebaseAuthError,
  parseFirestoreError,
  syncUserProfileToFirestore,
  verifyAndResolveMp4Stream,
} from '../services/firebaseService';
import { resolveMediaSrc } from '../assets/fallbacks';

interface ProtectedVideoPlayerProps {
  courseId: string;
  recording: CompletedVideoArchive;
  isEnrolled: boolean;
  viewerEmail?: string;
  customLogoUrl?: string;
  onEnroll: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
}

export const ProtectedVideoPlayer: React.FC<ProtectedVideoPlayerProps> = ({
  courseId,
  recording,
  isEnrolled,
  viewerEmail,
  customLogoUrl,
  onEnroll,
  onDelete,
  canManage = false,
  isAdmin = false,
  isStaff = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeMediaKind, setActiveMediaKind] = useState<'teaser' | 'lecture'>('teaser');
  const [autoJoiningNotice, setAutoJoiningNotice] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolvedTeaserUrl, setResolvedTeaserUrl] = useState<string | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const teaserObjectUrlRef = useRef<string | null>(null);

  const hasTeaser = Boolean(recording.teaserUrl || recording.teaserStoragePath);
  const hasStaffPrivileges = Boolean(isAdmin || isStaff);
  const isAccessible = Boolean(recording.isOrientation || isEnrolled || hasStaffPrivileges);

  // Reset state when switching recordings and revoke any ephemeral object URLs
  useEffect(() => {
    setIsPlaying(false);
    setActiveMediaKind(hasTeaser ? 'teaser' : 'lecture');
    setAutoJoiningNotice(false);
    setResolvedUrl(null);
    setResolvedTeaserUrl(null);
    setStreamError(null);
    setNeedsGoogleAuth(false);
  }, [recording.id, recording.videoUrl, recording.teaserUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (teaserObjectUrlRef.current) {
        URL.revokeObjectURL(teaserObjectUrlRef.current);
        teaserObjectUrlRef.current = null;
      }
    };
  }, []);

  const resolveTeaserSource = (): string | null => {
    if (recording.teaserUrl) return recording.teaserUrl;
    if (recording.teaserStoragePath) {
      // Firebase Storage public teaser download pattern
      return `https://firebasestorage.googleapis.com/v0/b/stalwart-meridian-vsmzh.firebasestorage.app/o/${encodeURIComponent(recording.teaserStoragePath)}?alt=media`;
    }
    return null;
  };

  const startProtectedStream = async () => {
    if (!isAccessible || isVerifying) return;
    setIsVerifying(true);
    setStreamError(null);
    setNeedsGoogleAuth(false);

    try {
      const result = await verifyAndResolveMp4Stream(
        courseId,
        recording,
        isEnrolled,
        hasStaffPrivileges
      );
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (result.isObjectUrl) {
        objectUrlRef.current = result.streamUrl;
      }
      setResolvedUrl(result.streamUrl);
      setActiveMediaKind('lecture');
      setIsPlaying(true);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg === 'FIREBASE_AUTH_REQUIRED') {
        setNeedsGoogleAuth(true);
        setStreamError('Sign in with Google to verify enrollment and unlock protected MP4 streaming.');
      } else if (rawMsg === 'ENROLLMENT_REQUIRED') {
        setStreamError('Course enrollment verification required before streaming this MP4 lecture.');
      } else {
        const parsed = parseFirestoreError(err);
        setStreamError(
          parsed.userMessage ||
            'Unable to authorize protected MP4 stream. Ensure you are signed in and enrolled.'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePlayTeaser = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAccessible) {
      onEnroll();
      return;
    }
    const tUrl = resolveTeaserSource();
    if (tUrl) {
      setResolvedTeaserUrl(tUrl);
      setActiveMediaKind('teaser');
      setIsPlaying(true);
      setStreamError(null);
    } else {
      void startProtectedStream();
    }
  };

  // Called when video teaser ends -> Automatically joins and switches seamlessly into full class lecture
  const handleTeaserEnded = () => {
    setAutoJoiningNotice(true);
    setTimeout(() => {
      setAutoJoiningNotice(false);
      if (isAccessible) {
        void startProtectedStream();
      } else {
        setIsPlaying(false);
        setActiveMediaKind('lecture');
      }
    }, 1200);
  };

  const handleSkipToFullClass = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAccessible) {
      void startProtectedStream();
    } else {
      setIsPlaying(false);
      setActiveMediaKind('lecture');
    }
  };

  const handleGoogleVerifyAndPlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVerifying(true);
    setStreamError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const fbUser = res.user;
      const parts = (fbUser.displayName || 'Scholar User').split(' ');
      await syncUserProfileToFirestore({
        id: fbUser.uid,
        firstName: parts[0] || 'Scholar',
        lastName: parts.slice(1).join(' ') || 'User',
        email: fbUser.email || '',
        role: fbUser.email?.toLowerCase() === CHANCELLOR_EMAIL ? 'admin' : 'student',
        gender: 'male',
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
      });
      setIsVerifying(false);
      await startProtectedStream();
    } catch (err: unknown) {
      setIsVerifying(false);
      setStreamError(
        formatFirebaseAuthError(err, 'Google authentication is required for Firebase Storage streaming.')
      );
    }
  };

  const blockShortcutKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const activeVideoUrl = activeMediaKind === 'teaser' ? (resolvedTeaserUrl || resolveTeaserSource()) : resolvedUrl;

  return (
    <div
      onKeyDown={blockShortcutKeys}
      className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between transition-all group"
    >
      {/* Video Container / Thumbnail with Automatic Logo Watermark & Teaser Toggle */}
      <div
        className="relative aspect-video bg-black overflow-hidden select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {isPlaying && activeVideoUrl ? (
          <div className="relative w-full h-full">
            <video
              src={activeVideoUrl}
              controls
              autoPlay
              playsInline
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onEnded={() => {
                if (activeMediaKind === 'teaser') {
                  handleTeaserEnded();
                }
              }}
              onError={() => {
                if (activeMediaKind === 'teaser') {
                  // Fallback seamlessly into full lecture stream if teaser fails
                  void startProtectedStream();
                } else {
                  setIsPlaying(false);
                  setStreamError('Unable to stream MP4 video source. Retry or upload a valid .mp4 archive.');
                }
              }}
              className="w-full h-full object-contain"
            />

            {/* Seamless Auto-Joining Countdown / Banner Overlay */}
            {autoJoiningNotice && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center animate-fadeIn">
                <Loader2 className="w-8 h-8 text-[#00F2FE] animate-spin mb-2" />
                <div className="text-sm font-bold text-white">Teaser Complete &mdash; Auto-Joining Class...</div>
                <p className="text-xs text-slate-300 mt-1">Entering full cohort lecture stream seamlessly.</p>
              </div>
            )}

            {/* Teaser vs Full Lecture Switcher & Watermark Bar */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto z-20">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/80 border border-[#00F2FE]/30 text-[10px] text-white font-mono">
                {customLogoUrl && (
                  <img src={customLogoUrl} alt="" referrerPolicy="no-referrer" className="w-3.5 h-3.5 object-contain" />
                )}
                <span>Deen Hijrah Academia</span>
                <span className="text-slate-400">&bull;</span>
                <span className={activeMediaKind === 'teaser' ? 'text-amber-300 font-bold' : 'text-[#00F2FE] font-bold'}>
                  {activeMediaKind === 'teaser' ? 'Video Teaser Preview' : 'Full Classroom Lecture'}
                </span>
              </div>

              {activeMediaKind === 'teaser' && (
                <button
                  type="button"
                  onClick={handleSkipToFullClass}
                  className="px-2.5 py-1 rounded-lg bg-[#00F2FE] hover:bg-[#00F2FE]/90 text-slate-950 text-[10px] font-bold shadow-md transition-all flex items-center gap-1"
                >
                  <span>Skip to Full Class</span>
                  <span>&rarr;</span>
                </button>
              )}
            </div>

            {viewerEmail && (
              <div className="absolute bottom-2.5 right-2.5 pointer-events-none opacity-45 px-2 py-0.5 rounded bg-black/60 text-[10px] text-slate-200 font-mono">
                {viewerEmail}
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-full bg-slate-950 relative flex items-center justify-center cursor-pointer"
            onClick={() => {
              if (!isAccessible) {
                onEnroll();
                return;
              }
              if (hasTeaser) {
                handlePlayTeaser();
              } else if (!needsGoogleAuth) {
                void startProtectedStream();
              }
            }}
          >
            {/* Background Thumbnail Image */}
            <img
              src={resolveMediaSrc(recording.thumbnailUrl, 'course')}
              alt={recording.title}
              referrerPolicy="no-referrer"
              draggable={false}
              className="w-full h-full object-cover filter brightness-75 group-hover:brightness-90 transition-all duration-300"
            />

            {/* AUTOMATIC WEBSITE LOGO WATERMARK EMBLEM (Always placed on thumbnail) */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-[#00F2FE]/40 shadow-lg pointer-events-none">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt="Deen Hijrah Logo"
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 object-contain"
                />
              ) : (
                <div className="w-4 h-4 text-[#00F2FE]">
                  <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                    <rect x="25" y="25" width="50" height="50" rx="6" />
                    <circle cx="50" cy="50" r="10" fill="#10B981" />
                  </svg>
                </div>
              )}
              <span className="text-[10px] font-bold text-white tracking-wider uppercase font-mono">
                Deen Hijrah
              </span>
            </div>

            {/* Accessible Play Button vs Loading vs Locked Enrollment Gate vs Google Verify */}
            {isVerifying ? (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
                <Loader2 className="w-8 h-8 text-[#00F2FE] animate-spin mb-2" />
                <div className="text-xs font-semibold text-white">Verifying Protected MP4 Stream...</div>
              </div>
            ) : !isAccessible ? (
              <div className="absolute inset-0 bg-black/82 backdrop-blur-[3px] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-2.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Class Recording Locked
                </div>
                <p className="text-[11px] text-slate-300 mt-1 max-w-[250px] leading-relaxed">
                  Only Course Orientation is public. Even on free courses, enroll first to unlock class recordings.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnroll();
                  }}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md"
                >
                  Enroll Free to Unlock
                </button>
              </div>
            ) : needsGoogleAuth || streamError ? (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#00F2FE]/20 border border-[#00F2FE]/40 text-[#00F2FE] flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <p className="text-[11px] text-slate-200 max-w-[230px] leading-relaxed">
                  {streamError}
                </p>
                {needsGoogleAuth ? (
                  <button
                    type="button"
                    onClick={handleGoogleVerifyAndPlay}
                    className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-md inline-flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In with Google &amp; Stream
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startProtectedStream();
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-[#00F2FE] hover:brightness-110 transition-all shadow-md"
                  >
                    Retry Stream
                  </button>
                )}
              </div>
            ) : hasTeaser ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-[#00F2FE] text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(0,242,254,0.5)] group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                </div>
                <div className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-amber-400/40 text-[10px] font-bold text-amber-300 flex items-center gap-1 shadow-md">
                  <span>Watch Video Teaser</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-[#00F2FE]">Auto-Joins Class</span>
                </div>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#00F2FE] to-[#10B981] text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(0,242,254,0.5)] group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              </div>
            )}

            {/* Orientation vs Locked Class Badge */}
            <div className="absolute bottom-2 right-2 z-10 pointer-events-none flex items-center gap-1.5">
              {hasTeaser && isAccessible && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-600/90 text-white shadow-md">
                  Teaser + Class
                </span>
              )}
              {recording.isOrientation ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/90 text-white shadow-md">
                  Free Orientation
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900/90 text-amber-300 border border-amber-500/30 shadow-md">
                  {isAccessible ? 'Enrolled Class' : 'Locked Class'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Info, Supplementary PDF Download & DRM Notice */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#00F2FE]" />
              {recording.duration}
            </span>
            <span>MP4 Stream</span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
            {recording.title}
          </h4>
        </div>

        {/* Supplementary Materials PDF Button */}
        {(recording.supplementaryPdfUrl || recording.supplementaryPdfName) && (
          <div>
            {(isEnrolled || hasStaffPrivileges || recording.isOrientation) && recording.supplementaryPdfUrl ? (
              <a
                href={`${recording.supplementaryPdfUrl}${
                  recording.supplementaryPdfUrl.includes('?') ? '&' : '?'
                }download=1`}
                download={recording.supplementaryPdfName || 'supplementary-materials.pdf'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-[#00F2FE] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Download Supplementary PDF
                  {recording.supplementaryPdfName ? ` (${recording.supplementaryPdfName})` : ''}
                </span>
              </a>
            ) : (
              <button
                type="button"
                onClick={onEnroll}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">
                  Enroll Free to Download PDF
                  {recording.supplementaryPdfName ? ` (${recording.supplementaryPdfName})` : ''}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Anti-Piracy / Non-Downloadable Streaming Notice */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <ShieldAlert className="w-3 h-3 text-[#00F2FE]" />
            <span>Protected Stream · Non-Downloadable &amp; Non-Shareable</span>
          </div>

          {canManage && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-rose-500 hover:text-rose-400 font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
