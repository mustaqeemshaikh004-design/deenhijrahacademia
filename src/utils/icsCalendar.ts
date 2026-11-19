import type { CalendarEvent } from '../types';

function escapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatUtcTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join('\r\n');
}

export function buildIcsContentForEvent(event: CalendarEvent): string {
  const startParsed = new Date(event.startUtc);
  const start = Number.isNaN(startParsed.getTime()) ? new Date() : startParsed;

  const endParsed = event.endUtc ? new Date(event.endUtc) : new Date(start.getTime() + 60 * 60 * 1000);
  const end =
    Number.isNaN(endParsed.getTime()) || endParsed.getTime() <= start.getTime()
      ? new Date(start.getTime() + 60 * 60 * 1000)
      : endParsed;

  const descLines: string[] = [];
  if (event.courseTitle) descLines.push(`Program: ${event.courseTitle}`);
  if (event.instructorName) descLines.push(`Instructor: ${event.instructorName}`);
  if (event.description) descLines.push(event.description);
  if (event.joinUrl) descLines.push(`Live Classroom Link: ${event.joinUrl}`);
  if (event.meetingId) descLines.push(`Zoom Meeting ID: ${event.meetingId}`);
  if (event.meetingPasscode) descLines.push(`Passcode: ${event.meetingPasscode}`);
  descLines.push('Academy: Deen Hijrah Academia (Tuition-Free Sacred Learning)');

  const location = event.joinUrl || event.locationOrLabel || 'Deen Hijrah Academia Virtual Hall';
  const uid = `${event.id.replace(/[^a-zA-Z0-9._-]/g, '-')}@deenhijrahacademia.edu`;

  const rawLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Deen Hijrah Academia//Academic Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Deen Hijrah Academia',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcTimestamp(new Date())}`,
    `DTSTART:${formatUtcTimestamp(start)}`,
    `DTEND:${formatUtcTimestamp(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(descLines.join('\n'))}`,
    `LOCATION:${escapeIcsText(location)}`,
    'STATUS:CONFIRMED',
    ...(event.joinUrl ? [`URL:${event.joinUrl}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return rawLines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function downloadEventAsIcs(event: CalendarEvent): void {
  const icsContent = buildIcsContentForEvent(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const slug =
    event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'academy-event';

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
