import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import {
  getSavedTimezonePreference,
  getUserTimezone,
  getUserTimezoneShort,
  TIMEZONE_CHANGED_EVENT,
  TIMEZONE_STORAGE_KEY,
} from '../utils/timezone';

interface LiveTimezoneClockProps {
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}

export const LiveTimezoneClock: React.FC<LiveTimezoneClockProps> = ({
  className = '',
  compact = false,
  onClick,
}) => {
  const [time, setTime] = useState<Date>(() => new Date());
  const [tz, setTz] = useState<string>(() => getUserTimezone());
  const [tzShort, setTzShort] = useState<string>(() => getUserTimezoneShort());
  const [isCustomSaved, setIsCustomSaved] = useState<boolean>(() =>
    Boolean(getSavedTimezonePreference())
  );

  useEffect(() => {
    const syncTimezone = () => {
      setTz(getUserTimezone());
      setTzShort(getUserTimezoneShort());
      setIsCustomSaved(Boolean(getSavedTimezonePreference()));
    };

    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === TIMEZONE_STORAGE_KEY) {
        syncTimezone();
      }
    };

    window.addEventListener(TIMEZONE_CHANGED_EVENT, syncTimezone);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener(TIMEZONE_CHANGED_EVENT, syncTimezone);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = timeFormatter.format(time);
  const formattedDate = dateFormatter.format(time);
  const titleText = `${isCustomSaved ? 'Saved' : 'Detected'} timezone: ${tz}${
    onClick ? ' — Click to change or save timezone' : ''
  }`;

  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  if (compact) {
    return (
      <div
        {...interactiveProps}
        title={titleText}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-[#00F2FE]/40 text-xs font-mono text-slate-200 shadow-[0_0_12px_rgba(0,242,254,0.15)] whitespace-nowrap shrink-0 ${
          onClick ? 'cursor-pointer hover:border-[#00F2FE] transition-colors' : ''
        } ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-[#00F2FE]" />
        <span className="text-[#00F2FE] font-bold tabular-nums">{formattedTime}</span>
        <span className="text-slate-400 text-[10px] hidden sm:inline">({tzShort})</span>
      </div>
    );
  }

  return (
    <div
      {...interactiveProps}
      title={titleText}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-[#00F2FE]/40 text-xs font-mono text-slate-200 shadow-[0_0_15px_rgba(0,242,254,0.15)] ${
        onClick ? 'cursor-pointer hover:border-[#00F2FE] transition-colors' : ''
      } ${className}`}
    >
      <div className="w-6 h-6 rounded-lg bg-[#00F2FE]/15 flex items-center justify-center text-[#00F2FE]">
        <Clock className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[#00F2FE] font-bold text-xs tabular-nums">{formattedTime}</span>
          <span className="text-[10px] text-emerald-400 font-semibold uppercase">{tzShort}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {formattedDate} · {isCustomSaved ? 'Saved Timezone' : 'Live Auto-Clock'}
        </div>
      </div>
    </div>
  );
};
