import type { Course } from '../types';

export function toCourseSlug(title: string): string {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'course';
}

export function findCourseBySlugOrId(courses: Course[], slugOrId?: string | null): Course | null {
  if (!slugOrId) return null;
  const normalized = slugOrId.trim().toLowerCase();
  return (
    courses.find((c) => c.id.toLowerCase() === normalized) ||
    courses.find((c) => c.code.toLowerCase() === normalized) ||
    courses.find((c) => toCourseSlug(c.title) === normalized) ||
    courses.find((c) => normalized.includes(toCourseSlug(c.title)) && toCourseSlug(c.title).length > 3) ||
    null
  );
}
