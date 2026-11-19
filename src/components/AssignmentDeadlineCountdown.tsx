import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AssignmentDeadlineCountdownProps {
  assignedDateUtc?: string;
  dueDateUtc: string;
  nowMs?: number;
  submittedStatus?: 'submitted' | 'graded';
  compact?: boolean;
}

interface CountdownVisualState {
  remainingMs: number;
  percentRemaining: number;
  formattedCountdown: string;
  urgencyLabel: 'Submitted' | 'Past Due' | 'Urgent' | 'Due Soon' | 'On Track';
  barColorClass: string;
  labelColorClass: string;
  countdownColorClass: string;
}

const DEFAULT_FALLBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function computeDeadlineState(
  dueDateUtc: string,
  nowMs: number,
  assignedDateUtc?: string,
  submittedStatus?: 'submitted' | 'graded'
): CountdownVisualState {
  const dueMs = new Date(dueDateUtc).getTime();
  if (Number.isNaN(dueMs)) {
    return {
      remainingMs: 0,
      percentRemaining: 0,
      formattedCountdown: 'No due date',
      urgencyLabel: submittedStatus ? 'Submitted' : 'On Track',
      barColorClass: 'bg-emerald-500',
      labelColorClass: 'text-emerald-700 dark:text-emerald-400',
      countdownColorClass: 'text-slate-700 dark:text-slate-300',
    };
  }

  const remainingMs = dueMs - nowMs;

  if (submittedStatus) {
    return {
      remainingMs: Math.max(0, remainingMs),
      percentRemaining: 100,
      formattedCountdown:
        submittedStatus === 'graded' ? 'Graded · Completed' : 'Submitted · Under Review',
      urgencyLabel: 'Submitted',
      barColorClass: 'bg-emerald-500',
      labelColorClass: 'text-emerald-700 dark:text-emerald-400',
      countdownColorClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }

  if (remainingMs <= 0) {
    return {
      remainingMs: 0,
      percentRemaining: 0,
      formattedCountdown: 'Deadline Passed',
      urgencyLabel: 'Past Due',
      barColorClass: 'bg-rose-600 dark:bg-rose-500',
      labelColorClass: 'text-rose-700 dark:text-rose-400',
      countdownColorClass: 'text-rose-700 dark:text-rose-400',
    };
  }

  const parsedAssigned = assignedDateUtc ? new Date(assignedDateUtc).getTime() : NaN;
  const totalWindowMs =
    !Number.isNaN(parsedAssigned) && parsedAssigned < dueMs
      ? Math.max(60 * 60 * 1000, dueMs - parsedAssigned)
      : Math.max(DEFAULT_FALLBACK_WINDOW_MS, remainingMs);

  const rawPercent = (remainingMs / totalWindowMs) * 100;
  const percentRemaining = Math.max(4, Math.min(100, Math.round(rawPercent)));

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  const formattedCountdown =
    days > 0 ? `${days}d ${hh}h ${mm}m ${ss}s` : `${hh}h ${mm}m ${ss}s`;

  const hoursLeft = remainingMs / (1000 * 60 * 60);

  if (hoursLeft <= 12 || percentRemaining <= 15) {
    return {
      remainingMs,
      percentRemaining,
      formattedCountdown,
      urgencyLabel: 'Urgent',
      barColorClass: 'bg-rose-500',
      labelColorClass: 'text-rose-700 dark:text-rose-400',
      countdownColorClass: 'text-rose-700 dark:text-rose-400',
    };
  }

  if (hoursLeft <= 48 || percentRemaining <= 40) {
    return {
      remainingMs,
      percentRemaining,
      formattedCountdown,
      urgencyLabel: 'Due Soon',
      barColorClass: 'bg-amber-500',
      labelColorClass: 'text-amber-700 dark:text-amber-300',
      countdownColorClass: 'text-amber-700 dark:text-amber-300',
    };
  }

  return {
    remainingMs,
    percentRemaining,
    formattedCountdown,
    urgencyLabel: 'On Track',
    barColorClass: 'bg-emerald-500',
    labelColorClass: 'text-emerald-700 dark:text-emerald-400',
    countdownColorClass: 'text-sky-700 dark:text-[#00F2FE]',
  };
}

export const AssignmentDeadlineCountdown: React.FC<AssignmentDeadlineCountdownProps> = ({
  assignedDateUtc,
  dueDateUtc,
  nowMs: externalNowMs,
  submittedStatus,
  compact = false,
}) => {
  const [internalNowMs, setInternalNowMs] = useState<number>(() => Date.now());
  const effectiveNow = externalNowMs ?? internalNowMs;

  useEffect(() => {
    if (externalNowMs !== undefined) return;
    const id = window.setInterval(() => setInternalNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [externalNowMs]);

  const state = computeDeadlineState(
    dueDateUtc,
    effectiveNow,
    assignedDateUtc,
    submittedStatus
  );

  const isPastDue = state.urgencyLabel === 'Past Due';
  const isUrgent = state.urgencyLabel === 'Urgent';
  const isSubmitted = state.urgencyLabel === 'Submitted';

  return (
    <div
      className={`rounded-xl bg-white dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 ${
        compact ? 'p-2.5 space-y-1.5' : 'p-3 space-y-2'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
          {isSubmitted ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : isPastDue || isUrgent ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE] shrink-0" />
          )}
          <span>Time Remaining</span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className={state.labelColorClass}>{state.urgencyLabel}</span>
        </div>

        <div
          className={`font-mono font-bold tabular-nums whitespace-nowrap ${state.countdownColorClass}`}
        >
          {state.formattedCountdown}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Assignment time remaining until deadline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percentRemaining}
        className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-500 ${
            isPastDue ? 'bg-rose-500/45 w-full' : state.barColorClass
          }`}
          style={isPastDue ? undefined : { width: `${state.percentRemaining}%` }}
        />
      </div>
    </div>
  );
};
