import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogoFourPiece } from './BrandLogo';

interface LogoPreloaderProps {
  onComplete: () => void;
  customLogoUrl?: string;
  onUploadCustomLogo?: (logoDataUrl: string) => void;
  theme?: 'dark' | 'light';
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const SPLASH_DURATION_MS = 2700;

export const LogoPreloader: React.FC<LogoPreloaderProps> = ({
  onComplete,
  customLogoUrl,
  theme = 'dark',
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const completedRef = useRef(false);

  const isLight = theme === 'light';

  useEffect(() => {
    if (completedRef.current) return;

    const duration = SPLASH_DURATION_MS;
    const exitDelay = 520;

    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      setIsExiting(true);
      window.setTimeout(onComplete, exitDelay);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="dha-logo-preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.52, ease: EASE_OUT_EXPO }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          {/* Architectural Split Curtain Reveal Panels on Exit */}
          <motion.div
            aria-hidden="true"
            initial={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.52, ease: EASE_OUT_EXPO }}
            className={`pointer-events-none absolute inset-x-0 top-0 h-[51%] border-b ${
              isLight
                ? 'bg-[#F8FAFC] border-slate-200/80'
                : 'bg-[#071120] border-cyan-500/20'
            }`}
          />
          <motion.div
            aria-hidden="true"
            initial={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.52, ease: EASE_OUT_EXPO }}
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-[51%] border-t ${
              isLight
                ? 'bg-[#F8FAFC] border-slate-200/80'
                : 'bg-[#071120] border-emerald-500/20'
            }`}
          />

          {/* Radial Stage Illumination */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0.45, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.18 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className={`pointer-events-none absolute inset-0 ${
              isLight
                ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(2,132,199,0.13),rgba(5,150,105,0.06)_42%,transparent_72%)]'
                : 'bg-[radial-gradient(circle_at_50%_45%,rgba(0,242,254,0.17),rgba(16,185,129,0.07)_42%,transparent_72%)]'
            }`}
          />

          {/* Grand Full-Presence Emblem Centerpiece */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
            <motion.div
              initial={{ scale: 0.78, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{
                scale: 1.32,
                rotate: 7,
                y: -26,
                opacity: 0,
              }}
              transition={{ duration: 0.56, ease: EASE_OUT_EXPO }}
              className="relative w-72 h-72 sm:w-88 sm:h-88 md:w-[390px] md:h-[390px] flex items-center justify-center mb-4"
            >
              {/* Expanding Architectural Ripple Waves Radiating From Logo */}
              <motion.div
                aria-hidden="true"
                initial={{ scale: 0.48, opacity: 0 }}
                animate={{ scale: [0.48, 1.35], opacity: [0.75, 0] }}
                transition={{
                  duration: 1.35,
                  delay: 0.1,
                  repeat: Infinity,
                  repeatDelay: 0.25,
                  ease: EASE_OUT_EXPO,
                }}
                className={`pointer-events-none absolute inset-4 rounded-full border-2 ${
                  isLight ? 'border-[#0284C7]/50' : 'border-[#00F2FE]/60'
                }`}
              />
              <motion.div
                aria-hidden="true"
                initial={{ scale: 0.48, opacity: 0 }}
                animate={{ scale: [0.48, 1.28], opacity: [0.6, 0] }}
                transition={{
                  duration: 1.35,
                  delay: 0.52,
                  repeat: Infinity,
                  repeatDelay: 0.25,
                  ease: EASE_OUT_EXPO,
                }}
                className={`pointer-events-none absolute inset-6 rounded-full border ${
                  isLight ? 'border-[#059669]/45' : 'border-[#10B981]/55'
                }`}
              />

              {/* Outer 36-Tick Astrolabe Dial */}
              <svg
                aria-hidden="true"
                viewBox="0 0 360 360"
                className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-slow"
              >
                <circle
                  cx="180"
                  cy="180"
                  r="156"
                  fill="none"
                  stroke={isLight ? '#0284C7' : '#00F2FE'}
                  strokeOpacity={isLight ? '0.45' : '0.55'}
                  strokeWidth="2.4"
                  strokeDasharray="65 32"
                  strokeLinecap="round"
                />
                <circle
                  cx="180"
                  cy="180"
                  r="142"
                  fill="none"
                  stroke={isLight ? '#059669' : '#10B981'}
                  strokeOpacity={isLight ? '0.38' : '0.45'}
                  strokeWidth="1.8"
                  strokeDasharray="28 14 6 14"
                />
              </svg>

              {/* Inner Counter-Rotating Geometric Octagonal Arc Frame */}
              <svg
                aria-hidden="true"
                viewBox="0 0 360 360"
                className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-reverse"
              >
                <polygon
                  points="180,44 276,84 316,180 276,276 180,316 84,276 44,180 84,84"
                  fill="none"
                  stroke={isLight ? '#0284C7' : '#38BDF8'}
                  strokeOpacity={isLight ? '0.32' : '0.4'}
                  strokeWidth="1.8"
                />
              </svg>

              {/* Large Hero 4-Piece Split-and-Join Brand Emblem */}
              <BrandLogoFourPiece
                customLogoUrl={customLogoUrl}
                size="hero"
                theme={theme}
                splitDistance={48}
                pulseSplit={16}
                className="relative z-10"
              />
            </motion.div>

            {/* Masked Wordmark Reveal */}
            <div className="overflow-hidden">
              <motion.h1
                initial={{ y: '105%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-40%', opacity: 0 }}
                transition={{ duration: 0.58, delay: 0.22, ease: EASE_OUT_EXPO }}
                className={`text-3xl sm:text-4xl font-extrabold tracking-[0.07em] ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                DEEN HIJRAH
              </motion.h1>
            </div>

            <div className="overflow-hidden mt-1">
              <motion.div
                initial={{ y: '105%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-40%', opacity: 0 }}
                transition={{ duration: 0.58, delay: 0.32, ease: EASE_OUT_EXPO }}
                className={`text-base sm:text-lg font-bold tracking-[0.32em] uppercase bg-clip-text text-transparent ${
                  isLight
                    ? 'bg-gradient-to-r from-[#0284C7] to-[#059669]'
                    : 'bg-gradient-to-r from-[#00F2FE] to-[#10B981]'
                }`}
              >
                ACADEMIA
              </motion.div>
            </div>

            <motion.div
              aria-hidden="true"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.44, ease: EASE_OUT_EXPO }}
              className={`mt-4 h-px w-48 origin-center ${
                isLight
                  ? 'bg-gradient-to-r from-transparent via-slate-300 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent'
              }`}
            />

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.48, delay: 0.56, ease: EASE_OUT_EXPO }}
              className={`mt-3 text-xs sm:text-sm font-medium tracking-wide ${
                isLight ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Scholastic Tradition · Live Classrooms · Global Timezone
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
