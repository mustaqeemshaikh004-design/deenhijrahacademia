import React, { useState } from 'react';
import {
  Search,
  Plus,
  Sparkles,
  Clock,
  ArrowUpRight,
  Play,
  UserPlus,
  LogIn,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import type { Course, CourseReview } from '../types';
import { resolveMediaSrc } from '../assets/fallbacks';
import { StarRatingDisplay } from './StarRating';

interface CourseCatalogProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onOpenCreateCourse: () => void;
  onSeedSampleCourse: () => void;
  isAdmin: boolean;
  customLogoUrl?: string;
  onNavigateAuth?: (mode: 'signin' | 'signup') => void;
  courseReviews?: CourseReview[];
  onSelectInstructor?: (instructorId: string, instructorName: string) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  courses,
  onSelectCourse,
  onOpenCreateCourse,
  onSeedSampleCourse,
  isAdmin,
  customLogoUrl,
  onNavigateAuth,
  courseReviews = [],
  onSelectInstructor,
}) => {
  const getCourseRatingSummary = (courseId: string) => {
    const list = courseReviews.filter((r) => r.courseId === courseId);
    if (list.length === 0) return null;
    const avg = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / list.length;
    return { average: Number(avg.toFixed(1)), count: list.length };
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || c.level === selectedLevel;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    return matchesSearch && matchesLevel && matchesStatus;
  });

  const isFiltered =
    searchQuery.trim().length > 0 || selectedLevel !== 'all' || selectedStatus !== 'all';
  const showSpotlight = !isFiltered && filteredCourses.length > 1;
  const spotlightCourse = showSpotlight ? filteredCourses[0] : null;
  const gridCourses = showSpotlight ? filteredCourses.slice(1) : filteredCourses;

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
        <div>
          <div className="text-xs font-semibold text-[#0284C7] dark:text-[#00F2FE] tracking-wider uppercase mb-1">
            Academic Curriculum
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Courses Open for Enrollment
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            Live interactive cohorts directed by Mustaqeem Shaikh, with free orientation lectures and protected cohort archives.
          </p>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSeedSampleCourse}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00F2FE]" />
              <span>Quick Seed Sample</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateCourse}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Course</span>
            </button>
          </div>
        )}
      </div>

      {/* Structured 2-Tier Search & Filter Deck */}
      <div className="p-4 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl mb-8 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects, codes, or keywords..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-700/60 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]/70 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
              {filteredCourses.length} of {courses.length} Cohorts
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLevel('all');
                  setSelectedStatus('all');
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[62px]">
              Level
            </span>
            <div className="flex flex-wrap items-center p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              {['all', 'Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize whitespace-nowrap ${
                    selectedLevel === lvl
                      ? 'bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'All Levels' : lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[62px] lg:min-w-0">
              Status
            </span>
            <div className="flex flex-wrap items-center p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              {['all', 'Open for Enrollment', 'Active', 'Coming Soon'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize whitespace-nowrap ${
                    selectedStatus === st
                      ? 'bg-[#10B981]/20 text-[#059669] dark:text-[#10B981] font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All Statuses' : st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Cohort Spotlight + Multi-Column Grid */}
      {filteredCourses.length > 0 ? (
        <div className="space-y-8">
          {spotlightCourse && (() => {
            const maxCap = Math.max(1, spotlightCourse.maxSpots ?? 50);
            const enrolledCount = spotlightCourse.enrolledStudentIds.length;
            const spotsAvailable = Math.max(0, maxCap - enrolledCount);
            const fillPct = Math.min(100, Math.round((enrolledCount / maxCap) * 100));
            const lowSpotsThreshold = Math.max(5, Math.floor(maxCap * 0.2));
            const seatStatusLabel =
              spotsAvailable === 0
                ? 'Batch Full'
                : spotsAvailable <= lowSpotsThreshold
                ? 'Filling Fast'
                : 'Seats Open';
            const seatTextTone =
              spotsAvailable === 0
                ? 'text-rose-600 dark:text-rose-400'
                : spotsAvailable <= lowSpotsThreshold
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400';
            const seatBarColor =
              spotsAvailable === 0
                ? 'bg-rose-500'
                : spotsAvailable <= lowSpotsThreshold
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            return (
              <div
                onClick={() => onSelectCourse(spotlightCourse)}
                className="group relative cursor-pointer rounded-3xl bg-white dark:bg-gradient-to-br dark:from-[#0F233D]/90 dark:to-[#0A192F]/95 border border-slate-200 dark:border-slate-800/90 hover:border-[#00F2FE]/60 transition-all duration-300 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_40px_-14px_rgba(0,0,0,0.65)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch"
              >
                {/* Left 7-col Preview */}
                <div className="lg:col-span-7 relative aspect-video lg:aspect-auto lg:min-h-[300px] overflow-hidden bg-slate-950">
                  <img
                    src={resolveMediaSrc(spotlightCourse.thumbnail, 'course')}
                    alt={spotlightCourse.title}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 brightness-95 group-hover:brightness-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/90 via-transparent to-black/30" />

                  <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-[#00F2FE]/45">
                    {customLogoUrl ? (
                      <img
                        src={customLogoUrl}
                        alt="DHA"
                        referrerPolicy="no-referrer"
                        className="w-3.5 h-3.5 object-contain"
                      />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 text-[#00F2FE]" />
                    )}
                    <span className="text-[10px] font-bold font-mono text-white tracking-wider uppercase">
                      Featured Cohort
                    </span>
                  </div>

                  <div className="absolute top-4 right-4 z-10">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] backdrop-blur-md border ${
                        spotlightCourse.status === 'Open for Enrollment'
                          ? 'bg-[#10B981]/90 text-white border-[#10B981]'
                          : spotlightCourse.status === 'Active'
                          ? 'bg-[#00F2FE]/90 text-slate-950 border-[#00F2FE]'
                          : 'bg-slate-900/90 text-slate-200 border-slate-700'
                      }`}
                    >
                      {spotlightCourse.status}
                    </span>
                  </div>

                  <div className="absolute bottom-3.5 inset-x-4 flex items-center justify-between text-xs font-mono">
                    <span className="text-[#00F2FE] font-semibold tracking-wide">
                      {spotlightCourse.code}
                    </span>
                    {spotlightCourse.videoArchives?.some((r) => r.isOrientation) && (
                      <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                        <Play className="w-3.5 h-3.5 fill-emerald-300" />
                        <span>Orientation Free</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right 5-col Breakdown */}
                <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#0284C7] dark:text-[#00F2FE] uppercase tracking-wider">
                      <span>
                        {spotlightCourse.level} Track ·{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInstructor?.(
                              spotlightCourse.instructorId,
                              spotlightCourse.instructorName
                            );
                          }}
                          className="hover:underline font-bold"
                        >
                          Instructor: {spotlightCourse.instructorName}
                        </button>
                      </span>
                      {(() => {
                        const summary = getCourseRatingSummary(spotlightCourse.id);
                        return summary ? (
                          <StarRatingDisplay
                            rating={summary.average}
                            size="xs"
                            reviewCount={summary.count}
                          />
                        ) : null;
                      })()}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white group-hover:text-[#0284C7] dark:group-hover:text-[#00F2FE] transition-colors leading-snug">
                      {spotlightCourse.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {spotlightCourse.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Enrolled
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                          {enrolledCount}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Spots Left
                        </div>
                        <div className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${seatTextTone}`}>
                          {spotsAvailable}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Lectures
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                          {spotlightCourse.totalLectures}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Fee
                        </div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                          Free ($0)
                        </div>
                      </div>
                    </div>

                    {/* SeerahVerse-style Cohort Seat Availability Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-slate-600 dark:text-slate-300">
                          {enrolledCount} / {maxCap} Students Enrolled
                        </span>
                        <span className={`font-semibold ${seatTextTone}`}>
                          {seatStatusLabel} · {spotsAvailable} Available
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${seatBarColor}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {spotlightCourse.durationLabel || '12 Weeks'} · Fee: $0 (Free)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#0284C7] dark:text-[#00F2FE] font-bold group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                        <span>{spotsAvailable === 0 ? 'Details' : 'Register Free'}</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {gridCourses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {gridCourses.map((course, idx) => {
                const hasOrientation = course.videoArchives?.some((r) => r.isOrientation);
                const maxCap = Math.max(1, course.maxSpots ?? 50);
                const enrolledCount = course.enrolledStudentIds.length;
                const spotsAvailable = Math.max(0, maxCap - enrolledCount);
                const fillPct = Math.min(100, Math.round((enrolledCount / maxCap) * 100));
                const lowSpotsThreshold = Math.max(5, Math.floor(maxCap * 0.2));
                const seatStatusLabel =
                  spotsAvailable === 0
                    ? 'Batch Full'
                    : spotsAvailable <= lowSpotsThreshold
                    ? 'Filling Fast'
                    : 'Seats Open';
                const seatTextTone =
                  spotsAvailable === 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : spotsAvailable <= lowSpotsThreshold
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';
                const seatBarColor =
                  spotsAvailable === 0
                    ? 'bg-rose-500'
                    : spotsAvailable <= lowSpotsThreshold
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={course.id}
                    onClick={() => onSelectCourse(course)}
                    style={{ animationDelay: `${(idx % 4) * 0.55}s` }}
                    className="animate-dha-float group relative cursor-pointer rounded-2xl bg-white dark:bg-gradient-to-b dark:from-[#0F233D]/80 dark:to-[#0A192F]/95 border border-slate-200 dark:border-slate-800/90 hover:border-[#00F2FE]/60 transition-all duration-300 hover:-translate-y-2 shadow-[0_12px_28px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.65)] hover:shadow-[0_24px_45px_-12px_rgba(0,242,254,0.28)] overflow-hidden flex flex-col justify-between"
                  >
                    {/* Ambient Top Glow Hairline */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00F2FE] to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20" />

                    {/* Course Thumbnail Container with Website Watermark */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                      <img
                        src={resolveMediaSrc(course.thumbnail, 'course')}
                        alt={course.title}
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 brightness-95 group-hover:brightness-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F] via-transparent to-black/35" />

                      {/* Official Website Logo Watermark Stamp */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-[#00F2FE]/45 shadow-md">
                        {customLogoUrl ? (
                          <img
                            src={customLogoUrl}
                            alt="DHA"
                            referrerPolicy="no-referrer"
                            className="w-3.5 h-3.5 object-contain"
                          />
                        ) : (
                          <BookOpen className="w-3 h-3 text-[#00F2FE]" />
                        )}
                        <span className="text-[10px] font-bold font-mono text-white tracking-wider uppercase">
                          Deen Hijrah
                        </span>
                      </div>

                      {/* Status Tag Overlay */}
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] backdrop-blur-md shadow-sm border ${
                            course.status === 'Open for Enrollment'
                              ? 'bg-[#10B981]/90 text-white border-[#10B981]'
                              : course.status === 'Active'
                              ? 'bg-[#00F2FE]/90 text-slate-950 border-[#00F2FE]'
                              : 'bg-slate-900/90 text-slate-200 border-slate-700'
                          }`}
                        >
                          {course.status}
                        </span>
                      </div>

                      {/* Bottom Code & Orientation Indicator */}
                      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#00F2FE] font-semibold tracking-wide">
                          {course.code}
                        </span>
                        {hasOrientation && (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                            <Play className="w-3 h-3 fill-emerald-300" />
                            <span>Orientation Free</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                          <span>{course.level} Track</span>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const summary = getCourseRatingSummary(course.id);
                              return summary ? (
                                <StarRatingDisplay
                                  rating={summary.average}
                                  size="xs"
                                  reviewCount={summary.count}
                                />
                              ) : null;
                            })()}
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              Fee: Free ($0)
                            </span>
                          </div>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#0284C7] dark:group-hover:text-[#00F2FE] transition-colors leading-snug line-clamp-2">
                          {course.title}
                        </h3>
                        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {/* Live Cohort Seat Availability Meter */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                            <span className="text-slate-600 dark:text-slate-300">
                              {enrolledCount} Students Enrolled
                            </span>
                            <span className={`font-semibold ${seatTextTone}`}>
                              {spotsAvailable} Spots Left · {seatStatusLabel}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${seatBarColor}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{course.durationLabel || '12 Weeks'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{course.totalLectures} Lectures</span>
                          </div>

                          <div className="flex items-center gap-1 text-[#0284C7] dark:text-[#00F2FE] font-semibold group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                            <span>{spotsAvailable === 0 ? 'Details' : 'Register Free'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clickable Instructor Footer */}
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Instructor</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInstructor?.(course.instructorId, course.instructorName);
                        }}
                        className="text-slate-800 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-[#00F2FE] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <span>{course.instructorName}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Empty Platform State */
        <div className="relative rounded-3xl bg-white dark:bg-gradient-to-b dark:from-[#0F233D]/50 dark:to-[#0A192F]/85 border border-slate-200 dark:border-slate-800/90 p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 dark:bg-gradient-to-br dark:from-[#0F2942] dark:to-[#0A192F] border border-[#00F2FE]/40 flex items-center justify-center text-[#00F2FE] shadow-[0_0_25px_rgba(0,242,254,0.22)] mb-5">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="text-xs font-mono uppercase text-[#0284C7] dark:text-[#00F2FE] tracking-widest mb-1.5">
            {isAdmin ? 'Clean Administrative Slate' : 'Academic Slate Ready'}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isAdmin
              ? 'Curriculum Ready for Course Creation'
              : 'Upcoming Cohorts Opening Soon'}
          </h3>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isAdmin
              ? 'Deen Hijrah Academia is cleanly initialized for fresh course creation, syllabus publishing, and watermarked MP4 lecture archives.'
              : 'Founding Director Mustaqeem Shaikh is preparing upcoming term cohorts with public orientation previews and free enrollment access. Create your student account today to stay ready.'}
          </p>

          {isAdmin ? (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenCreateCourse}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Course
              </button>

              <button
                type="button"
                onClick={onSeedSampleCourse}
                className="px-5 py-2.5 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#10B981]" />
                Quick Populate Sample Course
              </button>
            </div>
          ) : (
            onNavigateAuth && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateAuth('signup')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,242,254,0.28)] flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Student Account
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('signin')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-[#00F2FE]" />
                  Sign In
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
};
