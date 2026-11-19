import React, { useEffect, useState } from 'react';
import type { UserGender } from '../types';

interface SymbolicAvatarProps {
  gender?: UserGender;
  avatarUrl?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const SymbolicAvatar: React.FC<SymbolicAvatarProps> = ({
  gender = 'male',
  avatarUrl,
  name = 'User',
  size = 'md',
  className = '',
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [avatarUrl]);

  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl',
  };

  const dimension = sizeMap[size] || sizeMap.md;

  if (avatarUrl && !imgError) {
    return (
      <div
        className={`${dimension} rounded-full aspect-square shrink-0 relative overflow-hidden border border-[#0284C7]/35 dark:border-[#00F2FE]/40 bg-slate-200 dark:bg-slate-800 shadow-sm ${className}`}
      >
        {!imgLoaded && (
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-tr from-sky-200 via-slate-200 to-emerald-200 dark:from-[#0F2942] dark:via-slate-800 dark:to-[#0A192F]"
          />
        )}
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    );
  }

  // Geometric / Calligraphic symbolic vector avatars tailored for Male / Female accounts
  if (gender === 'female') {
    return (
      <div
        title={`${name} (Sisters Account)`}
        className={`${dimension} rounded-full aspect-square shrink-0 relative flex items-center justify-center bg-gradient-to-tr from-[#1E1B4B] via-[#312E81] to-[#0A192F] border border-[#00F2FE]/45 text-[#00F2FE] shadow-inner select-none overflow-hidden ${className}`}
      >
        {/* Sacred geometric 8-point rosette / floral star motif */}
        <svg viewBox="0 0 40 40" className="w-3/4 h-3/4 drop-shadow-[0_0_6px_rgba(0,242,254,0.6)]">
          <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
          <path
            d="M20 7 C23 15 25 17 33 20 C25 23 23 25 20 33 C17 25 15 23 7 20 C15 17 17 15 20 7 Z"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle cx="20" cy="20" r="3.5" fill="currentColor" fillOpacity="0.8" />
          <circle cx="20" cy="11" r="1.5" fill="#10B981" />
          <circle cx="29" cy="20" r="1.5" fill="#10B981" />
          <circle cx="20" cy="29" r="1.5" fill="#10B981" />
          <circle cx="11" cy="20" r="1.5" fill="#10B981" />
        </svg>
      </div>
    );
  }

  // Male Account: Majestic Calligraphic / Octagram Minaret Arch Motif
  return (
    <div
      title={`${name} (Brothers Account)`}
      className={`${dimension} rounded-full aspect-square shrink-0 relative flex items-center justify-center bg-gradient-to-tr from-[#0F2942] via-[#0A192F] to-[#04101E] border border-[#10B981]/45 text-[#10B981] shadow-inner select-none overflow-hidden ${className}`}
    >
      <svg viewBox="0 0 40 40" className="w-3/4 h-3/4 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]">
        {/* Interlocking geometric octagram (Khatam) with apex arch */}
        <rect x="10" y="10" width="20" height="20" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" rx="2" />
        <rect
          x="10"
          y="10"
          width="20"
          height="20"
          fill="none"
          stroke="#00F2FE"
          strokeWidth="1.2"
          transform="rotate(45 20 20)"
          rx="2"
        />
        <path
          d="M16 26 V18 C16 14 20 11 20 11 C20 11 24 14 24 18 V26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="2" fill="#00F2FE" />
      </svg>
    </div>
  );
};
