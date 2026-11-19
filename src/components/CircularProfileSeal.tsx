import React from 'react';
import { motion } from 'motion/react';
import { SymbolicAvatar } from './SymbolicAvatar';
import type { UserGender } from '../types';

interface CircularProfileSealProps {
  name?: string;
  avatarUrl?: string;
  gender?: UserGender;
  theme?: 'dark' | 'light';
  className?: string;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface QuadrantDef {
  id: 'tl' | 'tr' | 'bl' | 'br';
  clipPath: string;
  dx: number;
  dy: number;
  rot: number;
}

const QUADRANTS: QuadrantDef[] = [
  {
    id: 'tl',
    clipPath: 'polygon(0% 0%, 51.5% 0%, 51.5% 51.5%, 0% 51.5%)',
    dx: -1,
    dy: -1,
    rot: -12,
  },
  {
    id: 'tr',
    clipPath: 'polygon(48.5% 0%, 100% 0%, 100% 51.5%, 48.5% 51.5%)',
    dx: 1,
    dy: -1,
    rot: 12,
  },
  {
    id: 'bl',
    clipPath: 'polygon(0% 48.5%, 51.5% 48.5%, 51.5% 100%, 0% 100%)',
    dx: -1,
    dy: 1,
    rot: 12,
  },
  {
    id: 'br',
    clipPath: 'polygon(48.5% 48.5%, 100% 48.5%, 100% 100%, 48.5% 100%)',
    dx: 1,
    dy: 1,
    rot: -12,
  },
];

export const CircularProfileSeal: React.FC<CircularProfileSealProps> = ({
  name = 'Academy Member',
  avatarUrl,
  gender = 'male',
  theme = 'dark',
  className = '',
}) => {
  const isLight = theme === 'light';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${name} profile`}
      className={`relative flex items-center justify-center select-none ${className}`}
    >
      {/* Dynamic Breathing Ambient Radial Halo */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [0.9, 1.22, 0.9], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`pointer-events-none absolute -inset-14 rounded-full blur-2xl ${
          isLight
            ? 'bg-[radial-gradient(circle,rgba(2,132,199,0.22)_0%,rgba(5,150,105,0.1)_46%,transparent_74%)]'
            : 'bg-[radial-gradient(circle,rgba(0,242,254,0.25)_0%,rgba(16,185,129,0.12)_46%,transparent_74%)]'
        }`}
      />

      {/* Expanding Concentric Ripple Wave */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [0.85, 1.55], opacity: [0.7, 0] }}
        transition={{ duration: 1.25, repeat: Infinity, ease: EASE_OUT_EXPO }}
        className={`pointer-events-none absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 ${
          isLight ? 'border-[#0284C7]/55' : 'border-[#00F2FE]/60'
        }`}
      />

      {/* Active Moving Dual-Ring + 4-Piece Circular Profile Assembly */}
      <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
        {/* Outer Fast Spinning 4-Arc Kinetic Loader Ring + Orbital Comet */}
        <svg
          aria-hidden="true"
          viewBox="0 0 160 160"
          className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-fast"
        >
          <circle
            cx="80"
            cy="80"
            r="73"
            fill="none"
            stroke={isLight ? '#CBD5E1' : '#334155'}
            strokeOpacity={isLight ? '0.65' : '0.45'}
            strokeWidth="1.5"
          />
          <circle
            cx="80"
            cy="80"
            r="73"
            fill="none"
            stroke={isLight ? '#0284C7' : '#00F2FE'}
            strokeWidth="3.5"
            strokeDasharray="68 47"
            strokeLinecap="round"
          />
          <circle cx="80" cy="7" r="3.6" fill={isLight ? '#0284C7' : '#00F2FE'} />
        </svg>

        {/* Inner Counter-Rotating Emerald Dual-Arc Ring */}
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
            strokeOpacity={isLight ? '0.85' : '0.95'}
            strokeWidth="2.6"
            strokeDasharray="58 136"
            strokeLinecap="round"
          />
          <circle cx="142" cy="80" r="2.8" fill={isLight ? '#059669' : '#10B981'} />
        </svg>

        {/* 4-Piece Split-and-Join Circular Profile Centerpiece */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10 w-24 h-24 sm:w-[6.5rem] sm:h-[6.5rem] flex items-center justify-center"
        >
          {QUADRANTS.map((q) => (
            <motion.div
              key={q.id}
              initial={{
                x: q.dx * 26,
                y: q.dy * 26,
                rotate: q.rot,
                scale: 0.78,
                opacity: 0.3,
              }}
              animate={{
                x: [q.dx * 24, 0, 0, q.dx * 13, 0],
                y: [q.dy * 24, 0, 0, q.dy * 13, 0],
                rotate: [q.rot, 0, 0, q.rot * 0.55, 0],
                scale: [0.84, 1, 1, 0.92, 1],
                opacity: [0.45, 1, 1, 0.9, 1],
              }}
              transition={{
                duration: 1.45,
                times: [0, 0.28, 0.52, 0.78, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                style={{ clipPath: q.clipPath }}
                className="w-full h-full flex items-center justify-center"
              >
                <div
                  className={`w-full h-full rounded-full p-1 shadow-xl flex items-center justify-center ${
                    isLight
                      ? 'bg-white ring-2 ring-sky-500/45'
                      : 'bg-[#081224] ring-2 ring-[#00F2FE]/55'
                  }`}
                >
                  <SymbolicAvatar
                    gender={gender}
                    avatarUrl={avatarUrl}
                    name={name}
                    size="2xl"
                    className="w-full h-full"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <span className="sr-only">Loading {name} profile</span>
    </div>
  );
};
