import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogoFourPiece } from './BrandLogo';
import { CircularProfileSeal } from './CircularProfileSeal';
import type { UserGender } from '../types';

export interface ProfileLoaderPreview {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  gender?: UserGender;
}

interface NavigationLoaderProps {
  isLoading: boolean;
  targetTabName?: string;
  subtitle?: string;
  customLogoUrl?: string;
  theme?: 'dark' | 'light';
  profilePreview?: ProfileLoaderPreview | null;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const NavigationLoader: React.FC<NavigationLoaderProps> = ({
  isLoading,
  targetTabName = 'Destination',
  subtitle = 'Preparing your academy view...',
  customLogoUrl,
  theme = 'dark',
  profilePreview = null,
}) => {
  const isLight = theme === 'light';

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="dha-nav-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: profilePreview ? 1 : 1.02 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center select-none transition-colors duration-200 ${
            profilePreview
              ? isLight
                ? 'bg-[#F8FAFC] text-slate-900'
                : 'bg-[#0A1628] text-slate-100'
              : isLight
              ? 'bg-[#F8FAFC]/96 backdrop-blur-md text-slate-900'
              : 'bg-[#071120]/96 backdrop-blur-md text-slate-100'
          }`}
        >
          {profilePreview ? (
            <CircularProfileSeal
              name={profilePreview.name}
              avatarUrl={profilePreview.avatarUrl}
              gender={profilePreview.gender}
              theme={theme}
            />
          ) : (
            <>
              {/* Dynamic Breathing Architectural Radial Focus */}
              <motion.div
                aria-hidden="true"
                animate={{ scale: [0.92, 1.12, 0.92], opacity: [0.75, 1, 0.75] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className={`pointer-events-none absolute inset-0 ${
                  isLight
                    ? 'bg-[radial-gradient(circle_at_50%_46%,rgba(2,132,199,0.14),rgba(5,150,105,0.06)_38%,transparent_70%)]'
                    : 'bg-[radial-gradient(circle_at_50%_46%,rgba(0,242,254,0.18),rgba(16,185,129,0.08)_38%,transparent_70%)]'
                }`}
              />

              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.96 }}
                transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
                className="relative z-10 flex flex-col items-center text-center px-6 max-w-md"
              >
                {/* 4-Piece Split-and-Join BrandLogo + Active Fast Counter-Rotating Rings */}
                <div className="relative w-40 h-40 sm:w-44 sm:h-44 mb-5 flex items-center justify-center">
                  {/* Expanding Ripple Wave */}
                  <motion.div
                    aria-hidden="true"
                    animate={{ scale: [0.75, 1.45], opacity: [0.65, 0] }}
                    transition={{ duration: 1.25, repeat: Infinity, ease: EASE_OUT_EXPO }}
                    className={`pointer-events-none absolute inset-4 rounded-full border-2 ${
                      isLight ? 'border-[#0284C7]/45' : 'border-[#00F2FE]/55'
                    }`}
                  />

                  {/* Outer Fast Segmented Orbital Ring */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 160 160"
                    className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-fast"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r="74"
                      fill="none"
                      stroke={isLight ? '#CBD5E1' : '#334155'}
                      strokeOpacity="0.6"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="74"
                      fill="none"
                      stroke={isLight ? '#0284C7' : '#00F2FE'}
                      strokeWidth="3.4"
                      strokeDasharray="72 44"
                      strokeLinecap="round"
                    />
                    <circle cx="80" cy="6" r="3.4" fill={isLight ? '#0284C7' : '#00F2FE'} />
                  </svg>

                  {/* Inner Counter-Rotating Emerald Arcs */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 160 160"
                    className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-reverse"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r="62"
                      fill="none"
                      stroke={isLight ? '#059669' : '#10B981'}
                      strokeOpacity={isLight ? '0.8' : '0.92'}
                      strokeWidth="2.5"
                      strokeDasharray="52 54"
                      strokeLinecap="round"
                    />
                    <circle cx="142" cy="80" r="2.8" fill={isLight ? '#059669' : '#10B981'} />
                  </svg>

                  <BrandLogoFourPiece
                    customLogoUrl={customLogoUrl}
                    size="xl"
                    theme={theme}
                    splitDistance={24}
                    pulseSplit={12}
                    className="relative z-10"
                  />
                </div>

                {/* Clean Masked Destination Reveal */}
                <div className="overflow-hidden">
                  <motion.h3
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={{ duration: 0.34, ease: EASE_OUT_EXPO }}
                    className={`text-lg sm:text-xl font-extrabold tracking-tight line-clamp-2 ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {targetTabName}
                  </motion.h3>
                </div>

                {/* Animated Sliding Shimmer Progress Track */}
                <div
                  aria-hidden="true"
                  className={`relative my-3 h-1 w-40 overflow-hidden rounded-full ${
                    isLight ? 'bg-slate-200' : 'bg-slate-800'
                  }`}
                >
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: ['-100%', '140%'] }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                    className={`h-full w-1/2 rounded-full ${
                      isLight
                        ? 'bg-gradient-to-r from-[#0284C7] via-[#059669] to-[#0284C7]'
                        : 'bg-gradient-to-r from-[#00F2FE] via-[#10B981] to-[#00F2FE]'
                    }`}
                  />
                </div>

                <p
                  className={`text-xs font-medium ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {subtitle}
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
