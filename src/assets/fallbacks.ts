import heroAcademiaPoster from './images/hero_academia_poster_1794322500454.jpg';
import courseSeerahThumbnail from './images/course_seerah_thumbnail_1794322500167.jpg';
import blogScholarshipBanner from './images/blog_scholarship_banner_1794322500349.jpg';

export const HERO_POSTER_FALLBACK = heroAcademiaPoster;
export const COURSE_THUMBNAIL_FALLBACK = courseSeerahThumbnail;
export const BLOG_BANNER_FALLBACK = blogScholarshipBanner;

export type MediaKind = 'hero' | 'course' | 'blog';

/**
 * Resolves media URLs safely for Vite bundles. Replaces empty strings,
 * custom fallback tokens, or legacy third-party placeholder URLs with
 * bundled local bespoke illustrations so no image ever fails to load.
 */
export function resolveMediaSrc(src: string | undefined | null, kind: MediaKind): string {
  const trimmed = (src || '').trim();
  const isLegacyPlaceholder =
    !trimmed ||
    trimmed.startsWith('fallback://') ||
    trimmed.includes('images.unsplash.com');

  if (!isLegacyPlaceholder) {
    return trimmed;
  }

  switch (kind) {
    case 'hero':
      return HERO_POSTER_FALLBACK;
    case 'course':
      return COURSE_THUMBNAIL_FALLBACK;
    case 'blog':
      return BLOG_BANNER_FALLBACK;
  }
}
