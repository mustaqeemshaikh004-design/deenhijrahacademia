import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type BrandLogoMotionMode = 'static' | 'reveal' | 'orbit';

interface BrandLogoProps {
  customLogoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  theme?: 'dark' | 'light';
  animated?: boolean;
  motionMode?: BrandLogoMotionMode;
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-28 h-28',
  hero: 'w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64',
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const BrandLogo: React.FC<BrandLogoProps> = ({
  customLogoUrl,
  size = 'md',
  theme,
  animated = false,
  motionMode,
  className = '',
  alt = 'Deen Hijrah Academia Emblem',
}) => {
  const rawId = useId().replace(/:/g, '');
  const prefersReducedMotion = useReducedMotion();
  const sizeClass = SIZE_CLASSES[size];

  const resolvedMode: BrandLogoMotionMode =
    motionMode ?? (animated ? 'orbit' : 'static');

  const isReveal = resolvedMode === 'reveal';
  const isOrbit = resolvedMode === 'orbit';
  const isAnimated = isReveal || isOrbit;
  const isExplicitLight = theme === 'light';

  if (customLogoUrl && customLogoUrl.trim()) {
    return (
      <motion.div
        initial={
          isReveal
            ? { opacity: 0, scale: 0.28, rotate: -22, y: 26 }
            : isOrbit
            ? { opacity: 0, scale: 0.88 }
            : false
        }
        animate={
          isReveal
            ? {
                opacity: [0, 1, 1, 1],
                scale: [0.28, 1.1, 0.96, 1],
                rotate: [-22, 5, -2, 0],
                y: [26, -8, 2, 0],
              }
            : isOrbit
            ? { opacity: 1, scale: 1 }
            : undefined
        }
        transition={
          isReveal
            ? { duration: 0.95, times: [0, 0.52, 0.78, 1], ease: EASE_OUT_EXPO }
            : { duration: 0.28, ease: EASE_OUT_EXPO }
        }
        className={`relative rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-lg bg-white dark:bg-[#071120] border border-slate-200 dark:border-[#00F2FE]/35 ${sizeClass} ${className}`}
      >
        <motion.div
          className="relative w-full h-full flex items-center justify-center"
          animate={
            isReveal
              ? {
                  y: [0, -7, 0],
                  scale: [1, 1.035, 1],
                  rotate: [0, 1.2, -1.2, 0],
                }
              : undefined
          }
          transition={
            isReveal
              ? { duration: 2.1, delay: 0.8, repeat: Infinity, ease: 'easeInOut' }
              : undefined
          }
        >
          <img
            src={customLogoUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </motion.div>
        {isAnimated && (
          <motion.span
            aria-hidden="true"
            initial={{ x: '-140%' }}
            animate={{ x: '240%' }}
            transition={{
              duration: 0.95,
              delay: isReveal ? 0.45 : 0.08,
              ease: EASE_OUT_EXPO,
              repeat: Infinity,
              repeatDelay: isReveal ? 0.85 : 1.4,
            }}
            className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent"
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={
        isReveal
          ? { scale: 0.28, opacity: 0, rotate: -22, y: 26 }
          : isOrbit
          ? { scale: 0.88, opacity: 0 }
          : false
      }
      animate={
        isReveal
          ? {
              scale: [0.28, 1.1, 0.96, 1],
              opacity: [0, 1, 1, 1],
              rotate: [-22, 5, -2, 0],
              y: [26, -8, 2, 0],
            }
          : isOrbit
          ? { scale: 1, opacity: 1 }
          : undefined
      }
      transition={
        isReveal
          ? { duration: 0.95, times: [0, 0.52, 0.78, 1], ease: EASE_OUT_EXPO }
          : { duration: 0.26, ease: EASE_OUT_EXPO }
      }
      className={`relative flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      aria-label={alt}
    >
      <motion.div
        className={`w-full h-full flex items-center justify-center ${
          isOrbit ? 'animate-dha-logo-float' : ''
        }`}
        animate={
          isReveal
            ? {
                y: [0, -8, 0],
                scale: [1, 1.05, 1],
                rotate: [0, 2, -2, 0],
              }
            : isOrbit
            ? {
                rotate: [0, 4.5, -4.5, 0],
              }
            : undefined
        }
        transition={
          isReveal
            ? { duration: 1.9, delay: 0.4, repeat: Infinity, ease: 'easeInOut' }
            : isOrbit
            ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      >
        <svg
          viewBox="0 0 120 120"
          className="relative w-full h-full drop-shadow-[0_10px_24px_rgba(2,132,199,0.28)] dark:drop-shadow-[0_10px_28px_rgba(0,242,254,0.34)]"
          role="img"
          aria-label={alt}
        >
          <defs>
            <linearGradient id={`bg-${rawId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isExplicitLight ? '#0F172A' : '#08182E'} />
              <stop offset="55%" stopColor={isExplicitLight ? '#0C2D48' : '#0B2340'} />
              <stop offset="100%" stopColor={isExplicitLight ? '#064E3B' : '#071120'} />
            </linearGradient>

            <linearGradient id={`aquaEmerald-${rawId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F2FE" />
              <stop offset="55%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>

            <linearGradient id={`goldAccent-${rawId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            <linearGradient id={`bookGlow-${rawId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.88" />
            </linearGradient>

            <radialGradient id={`coreAura-${rawId}`} cx="50%" cy="46%" r="50%">
              <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.34" />
              <stop offset="65%" stopColor="#10B981" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#071120" stopOpacity="0" />
            </radialGradient>

            <clipPath id={`shieldClip-${rawId}`}>
              <rect x="4" y="4" width="112" height="112" rx="28" />
            </clipPath>
          </defs>

          {/* Astrolabe outer shield backdrop */}
          <motion.rect
            x="4"
            y="4"
            width="112"
            height="112"
            rx="28"
            fill={`url(#bg-${rawId})`}
            initial={isReveal ? { opacity: 0 } : false}
            animate={isReveal ? { opacity: 1 } : undefined}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
          />

          {/* Astrolabe outer shield calligraphic border draw-in */}
          <motion.rect
            x="4"
            y="4"
            width="112"
            height="112"
            rx="28"
            fill="none"
            stroke={`url(#aquaEmerald-${rawId})`}
            strokeWidth="2.4"
            initial={isReveal ? { pathLength: 0, opacity: 0.4 } : false}
            animate={isReveal ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.72, ease: EASE_OUT_EXPO }}
          />

          {/* Ambient celestial radial glow inside shield */}
          <motion.circle
            cx="60"
            cy="56"
            r="46"
            fill={`url(#coreAura-${rawId})`}
            style={{ transformOrigin: '60px 56px' }}
            animate={isReveal ? { scale: [0.9, 1.12, 0.9], opacity: [0.65, 1, 0.65] } : undefined}
            transition={isReveal ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
          />

          {/* Astrolabe compass ticks & dashed ring (continuous smooth orbit when animated) */}
          <motion.g
            style={{ transformOrigin: '60px 60px' }}
            initial={isReveal ? { opacity: 0, scale: 0.75 } : false}
            animate={
              isAnimated
                ? { opacity: 1, scale: 1, rotate: 360 }
                : undefined
            }
            transition={{
              opacity: { duration: 0.4, delay: isReveal ? 0.18 : 0 },
              scale: { duration: 0.5, delay: isReveal ? 0.18 : 0, ease: EASE_OUT_EXPO },
              rotate: { duration: isOrbit ? 10 : 14, repeat: Infinity, ease: 'linear' },
            }}
          >
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="#00F2FE"
              strokeOpacity="0.32"
              strokeWidth="1.2"
              strokeDasharray="3 4"
            />
          </motion.g>

          {/* 8-Point Rub el Hizb sacred interlocking lattice */}
          <g opacity="0.96">
            <motion.rect
              x="27"
              y="27"
              width="66"
              height="66"
              rx="10"
              fill="none"
              stroke={`url(#aquaEmerald-${rawId})`}
              strokeWidth="2.6"
              style={{ transformOrigin: '60px 60px' }}
              initial={isReveal ? { pathLength: 0, rotate: -32, opacity: 0.2 } : false}
              animate={
                isReveal
                  ? { pathLength: 1, rotate: [0, 6, 0], opacity: 1 }
                  : isOrbit
                  ? { rotate: [0, 4, 0] }
                  : undefined
              }
              transition={
                isReveal
                  ? {
                      pathLength: { duration: 0.7, delay: 0.14, ease: EASE_OUT_EXPO },
                      opacity: { duration: 0.4, delay: 0.14 },
                      rotate: { duration: 2.2, delay: 0.2, repeat: Infinity, ease: 'easeInOut' },
                    }
                  : { duration: 2.0, repeat: Infinity, ease: 'easeInOut' }
              }
            />
            <motion.rect
              x="27"
              y="27"
              width="66"
              height="66"
              rx="10"
              fill="none"
              stroke={`url(#aquaEmerald-${rawId})`}
              strokeWidth="2.2"
              style={{ transformOrigin: '60px 60px' }}
              initial={
                isReveal
                  ? { pathLength: 0, rotate: 78, opacity: 0.2 }
                  : { rotate: 45 }
              }
              animate={
                isReveal
                  ? { pathLength: 1, rotate: [45, 39, 45], opacity: 1 }
                  : isOrbit
                  ? { rotate: [45, 41, 45] }
                  : { rotate: 45 }
              }
              transition={
                isReveal
                  ? {
                      pathLength: { duration: 0.7, delay: 0.2, ease: EASE_OUT_EXPO },
                      opacity: { duration: 0.4, delay: 0.2 },
                      rotate: { duration: 2.2, delay: 0.2, repeat: Infinity, ease: 'easeInOut' },
                    }
                  : isOrbit
                  ? { duration: 2.0, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0 }
              }
            />
          </g>

          {/* Architectural Mihrab Sanctuary Archway */}
          <motion.path
            d="M 38 82 L 38 56 C 38 41, 49 32, 60 25 C 71 32, 82 41, 82 56 L 82 82 Z"
            fill="#071120"
            fillOpacity="0.68"
            stroke={`url(#goldAccent-${rawId})`}
            strokeWidth="1.9"
            strokeLinejoin="round"
            initial={isReveal ? { pathLength: 0, fillOpacity: 0 } : false}
            animate={isReveal ? { pathLength: 1, fillOpacity: 0.68 } : undefined}
            transition={{
              pathLength: { duration: 0.62, delay: 0.28, ease: EASE_OUT_EXPO },
              fillOpacity: { duration: 0.4, delay: 0.52 },
            }}
          />

          {/* North Star & Waxing Crescent above the Mihrab Apex */}
          <motion.g
            style={{ transformOrigin: '60px 36px' }}
            initial={isReveal ? { opacity: 0, y: 8, scale: 0.55 } : false}
            animate={
              isReveal
                ? { opacity: 1, y: [0, -2.5, 0], scale: [1, 1.12, 1] }
                : isOrbit
                ? { y: [0, -1.5, 0] }
                : undefined
            }
            transition={
              isReveal
                ? {
                    opacity: { duration: 0.4, delay: 0.45 },
                    y: { duration: 1.6, delay: 0.6, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 1.6, delay: 0.6, repeat: Infinity, ease: 'easeInOut' },
                  }
                : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <path
              d="M 65.5 34.5 A 6.2 6.2 0 1 0 65.5 44.5 A 4.8 4.8 0 1 1 65.5 34.5 Z"
              fill={`url(#goldAccent-${rawId})`}
            />
            <polygon
              points="60,29 61.5,33 65.5,33 62.3,35.4 63.5,39.3 60,36.9 56.5,39.3 57.7,35.4 54.5,33 58.5,33"
              fill="#FDE68A"
            />
          </motion.g>

          {/* Open Illuminated Codex (Book of Knowledge) */}
          <motion.g
            style={{ transformOrigin: '60px 68px' }}
            initial={isReveal ? { opacity: 0, scaleX: 0.12, y: 6 } : false}
            animate={isReveal ? { opacity: 1, scaleX: 1, y: 0 } : undefined}
            transition={{ duration: 0.52, delay: 0.52, ease: EASE_OUT_EXPO }}
          >
            {/* Left Page */}
            <path
              d="M 60 76 C 53 72, 46 72, 41 74.5 L 41 59.5 C 46 57.2, 53 57.5, 60 61.5 Z"
              fill={`url(#bookGlow-${rawId})`}
              stroke="#0284C7"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            {/* Right Page */}
            <path
              d="M 60 76 C 67 72, 74 72, 79 74.5 L 79 59.5 C 74 57.2, 67 57.5, 60 61.5 Z"
              fill={`url(#bookGlow-${rawId})`}
              stroke="#10B981"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            {/* Subtle Script Filigree Lines on Pages */}
            <path
              d="M 45 63.5 Q 51 62 56.5 64.5 M 45 67.5 Q 51 66 56.5 68.5"
              fill="none"
              stroke="#0284C7"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              d="M 75 63.5 Q 69 62 63.5 64.5 M 75 67.5 Q 69 66 63.5 68.5"
              fill="none"
              stroke="#059669"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.7"
            />
            {/* Codex Spine Ribbon & Guiding Beacon */}
            <path
              d="M 60 61.5 L 60 80 L 57.6 77.2 L 60 74.6 L 62.4 77.2 L 60 80"
              fill="#F59E0B"
              stroke="#F59E0B"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <motion.circle
              cx="60"
              cy="54.5"
              r="2.6"
              fill="#00F2FE"
              style={{ transformOrigin: '60px 54.5px' }}
              initial={isReveal ? { scale: 0, opacity: 0 } : false}
              animate={
                isAnimated
                  ? { scale: [1, 1.45, 1], opacity: [0.8, 1, 0.8] }
                  : undefined
              }
              transition={
                isAnimated
                  ? {
                      duration: 1.4,
                      delay: isReveal ? 0.72 : 0.1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : undefined
              }
            />
          </motion.g>

          {/* Cardinal Compass Glints (Sequential architectural illumination) */}
          {[
            { cx: 60, cy: 14, fill: '#00F2FE', delay: 0.58 },
            { cx: 106, cy: 60, fill: '#10B981', delay: 0.66 },
            { cx: 60, cy: 106, fill: '#F59E0B', delay: 0.74 },
            { cx: 14, cy: 60, fill: '#38BDF8', delay: 0.82 },
          ].map((pt, i) => (
            <motion.circle
              key={i}
              cx={pt.cx}
              cy={pt.cy}
              r="2"
              fill={pt.fill}
              style={{ transformOrigin: `${pt.cx}px ${pt.cy}px` }}
              initial={isReveal ? { scale: 0, opacity: 0 } : false}
              animate={
                isReveal
                  ? { scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }
                  : undefined
              }
              transition={
                isReveal
                  ? {
                      duration: 1.6,
                      delay: pt.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : undefined
              }
            />
          ))}

          {/* Architectural diagonal sheen sweep across shield on reveal/orbit */}
          {isAnimated && (
            <g clipPath={`url(#shieldClip-${rawId})`} pointerEvents="none">
              <motion.rect
                x="-40"
                y="-10"
                width="36"
                height="140"
                fill="#FFFFFF"
                fillOpacity="0.18"
                style={{ transformOrigin: '60px 60px' }}
                initial={{ x: -55, skewX: -20 }}
                animate={{ x: 145, skewX: -20 }}
                transition={{
                  duration: 0.9,
                  delay: isReveal ? 0.65 : 0.12,
                  ease: EASE_OUT_EXPO,
                  repeat: Infinity,
                  repeatDelay: isReveal ? 0.8 : 1.5,
                }}
              />
            </g>
          )}
        </svg>
      </motion.div>
    </motion.div>
  );
};

interface BrandLogoFourPieceProps {
  customLogoUrl?: string;
  size?: BrandLogoProps['size'];
  theme?: 'dark' | 'light';
  className?: string;
  alt?: string;
  splitDistance?: number;
  pulseSplit?: number;
}

const LOGO_QUADRANTS = [
  {
    id: 'tl',
    clipPath: 'polygon(0% 0%, 51.5% 0%, 51.5% 51.5%, 0% 51.5%)',
    dx: -1,
    dy: -1,
    rot: -10,
  },
  {
    id: 'tr',
    clipPath: 'polygon(48.5% 0%, 100% 0%, 100% 51.5%, 48.5% 51.5%)',
    dx: 1,
    dy: -1,
    rot: 10,
  },
  {
    id: 'bl',
    clipPath: 'polygon(0% 48.5%, 51.5% 48.5%, 51.5% 100%, 0% 100%)',
    dx: -1,
    dy: 1,
    rot: 10,
  },
  {
    id: 'br',
    clipPath: 'polygon(48.5% 48.5%, 100% 48.5%, 100% 100%, 48.5% 100%)',
    dx: 1,
    dy: 1,
    rot: -10,
  },
];

export const BrandLogoFourPiece: React.FC<BrandLogoFourPieceProps> = ({
  customLogoUrl,
  size = 'xl',
  theme = 'dark',
  className = '',
  alt = 'Deen Hijrah Academia Emblem',
  splitDistance = 24,
  pulseSplit = 12,
}) => {
  const sizeClass = SIZE_CLASSES[size || 'xl'];

  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1], y: [0, -4, 0] }}
      transition={{ duration: 1.75, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      aria-label={alt}
    >
      {LOGO_QUADRANTS.map((q) => (
        <motion.div
          key={q.id}
          initial={{
            x: q.dx * splitDistance,
            y: q.dy * splitDistance,
            rotate: q.rot * 1.2,
            scale: 0.8,
            opacity: 0.3,
          }}
          animate={{
            x: [q.dx * splitDistance, 0, 0, q.dx * pulseSplit, 0],
            y: [q.dy * splitDistance, 0, 0, q.dy * pulseSplit, 0],
            rotate: [q.rot, 0, 0, q.rot * 0.5, 0],
            scale: [0.82, 1, 1, 0.92, 1],
            opacity: [0.4, 1, 1, 0.9, 1],
          }}
          transition={{
            duration: 1.55,
            times: [0, 0.28, 0.54, 0.78, 1],
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            style={{ clipPath: q.clipPath }}
            className="w-full h-full flex items-center justify-center"
          >
            <BrandLogo
              customLogoUrl={customLogoUrl}
              size={size}
              theme={theme}
              motionMode="orbit"
              className="w-full h-full"
              alt={alt}
            />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

