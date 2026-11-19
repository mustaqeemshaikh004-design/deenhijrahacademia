/**
 * Global Timezone & Saved Preference Utilities
 * Uses the user's saved timezone preference when set, falling back to browser auto-detection.
 */

export const TIMEZONE_STORAGE_KEY = 'dha_saved_timezone';
export const TIMEZONE_CHANGED_EVENT = 'dha-timezone-changed';

export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserDetectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getSavedTimezonePreference(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (raw && isValidTimezone(raw)) {
      return raw.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function setSavedTimezonePreference(tz: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = tz ? tz.trim() : '';
    if (clean && isValidTimezone(clean)) {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent(TIMEZONE_CHANGED_EVENT, { detail: clean && isValidTimezone(clean) ? clean : null })
    );
  } catch {
    // Ignore storage unavailability
  }
}

export function getUserTimezone(): string {
  const saved = getSavedTimezonePreference();
  if (saved) return saved;
  return getBrowserDetectedTimezone();
}

export function getTimezoneShortOffset(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : tz;
  } catch {
    return 'UTC';
  }
}

export function getUserTimezoneShort(): string {
  try {
    const tz = getUserTimezone();
    const short = getTimezoneShortOffset(tz);
    return `${short} (${tz})`;
  } catch {
    return 'UTC';
  }
}

const FEATURED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export interface TimezoneOption {
  id: string;
  label: string;
  offset: string;
}

export function getAvailableTimezones(): TimezoneOption[] {
  const seen = new Set<string>();
  const allIds: string[] = [];

  const detected = getBrowserDetectedTimezone();
  if (detected && isValidTimezone(detected)) {
    seen.add(detected);
    allIds.push(detected);
  }

  for (const tz of FEATURED_TIMEZONES) {
    if (!seen.has(tz) && isValidTimezone(tz)) {
      seen.add(tz);
      allIds.push(tz);
    }
  }

  try {
    const supportedValuesOf = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    if (typeof supportedValuesOf === 'function') {
      for (const tz of supportedValuesOf('timeZone')) {
        if (!seen.has(tz) && isValidTimezone(tz)) {
          seen.add(tz);
          allIds.push(tz);
        }
      }
    }
  } catch {
    // Fallback to featured list if Intl.supportedValuesOf is unavailable
  }

  return allIds.map((id) => {
    const offset = getTimezoneShortOffset(id);
    const cityLabel = id.replace(/_/g, ' ').replace(/\//g, ' · ');
    return {
      id,
      offset,
      label: `${cityLabel} (${offset})`,
    };
  });
}

/**
 * Format a class time or ISO timestamp for the user's saved or detected local timezone.
 * Accepts time like "14:00" UTC or ISO string.
 */
export function formatToLocalTime(
  timeUtcOrIso: string,
  dayOfWeek?: string
): {
  localTimeStr: string;
  localDayStr: string;
  timezoneLabel: string;
  diffNote: string;
} {
  const savedTz = getSavedTimezonePreference();
  const userTz = savedTz || getBrowserDetectedTimezone();
  let date: Date;

  if (timeUtcOrIso.includes('T') || timeUtcOrIso.includes('-')) {
    date = new Date(timeUtcOrIso);
  } else {
    const [hours, minutes] = timeUtcOrIso.split(':').map(Number);
    const now = new Date();
    date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours || 12, minutes || 0)
    );
  }

  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: userTz,
    weekday: 'long',
  });

  const localTimeStr = timeFormatter.format(date);
  const localDayStr = dayOfWeek ? dayOfWeek : dayFormatter.format(date);
  const tzShort = getUserTimezoneShort();

  return {
    localTimeStr,
    localDayStr,
    timezoneLabel: tzShort,
    diffNote: savedTz ? `Saved timezone: ${userTz}` : `Auto-clocked to ${userTz}`,
  };
}
