import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  User as UserIcon,
  ExternalLink,
  SlidersHorizontal,
  Bell,
  Video,
  Pin,
  CheckCheck,
} from 'lucide-react';
import { SymbolicAvatar } from './SymbolicAvatar';
import { LiveTimezoneClock } from './LiveTimezoneClock';
import { BrandLogo } from './BrandLogo';
import type { User, CustomNavItem, InAppNotification } from '../types';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onLogout: () => void;
  onOpenAccountSettings?: (tab?: 'timezone' | 'password') => void;
  customLogoUrl?: string;
  customNavItems?: CustomNavItem[];
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  notifications?: InAppNotification[];
  unreadNotificationsCount?: number;
  onNotificationClick?: (notification: InAppNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}

const RESTRICTED_NAV_KEYS = new Set([
  'admin',
  'portal',
  'teacher',
  'admin-portal',
  'teacher-portal',
  'student-portal',
]);

export const DEFAULT_SEERAHVERSE_LINKS: CustomNavItem[] = [
  { id: '1', key: 'home', label: 'Home', isSystem: true },
  { id: '2', key: 'courses', label: 'Courses', isSystem: true },
  { id: '3', key: 'pre-register', label: 'Pre-Register', isSystem: true },
  { id: '4', key: 'faculty', label: 'Faculty', isSystem: true },
  { id: '5', key: 'blogs', label: 'Articles', isSystem: true },
  { id: '6', key: 'counseling', label: 'Counseling', isSystem: true },
  { id: '7', key: 'about', label: 'About', isSystem: true },
  { id: '8', key: 'contact', label: 'Contact', isSystem: true },
];

const LEGACY_DEFAULT_KEYS = ['home', 'courses', 'blogs', 'faculty', 'about', 'contact'];

export function resolvePublicNavLinks(customNavItems?: CustomNavItem[]): CustomNavItem[] {
  let rawLinks =
    customNavItems && customNavItems.length > 0 ? customNavItems : DEFAULT_SEERAHVERSE_LINKS;

  if (
    rawLinks.length === LEGACY_DEFAULT_KEYS.length &&
    rawLinks.every((item, idx) => item.key.toLowerCase() === LEGACY_DEFAULT_KEYS[idx])
  ) {
    rawLinks = DEFAULT_SEERAHVERSE_LINKS;
  }

  return rawLinks.filter(
    (link) =>
      !RESTRICTED_NAV_KEYS.has(link.key.toLowerCase()) &&
      !RESTRICTED_NAV_KEYS.has(link.label.trim().toLowerCase())
  );
}

export function formatNotificationTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Recent';
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onLogout,
  onOpenAccountSettings,
  customLogoUrl,
  customNavItems,
  theme = 'dark',
  onToggleTheme,
  notifications = [],
  unreadNotificationsCount = 0,
  onNotificationClick,
  onMarkAllNotificationsRead,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileMenuOpen && !notifMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (profileMenuOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifMenuOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotifMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [profileMenuOpen, notifMenuOpen]);

  // Never display Admin, Teacher, or Portal links in the top navbar
  const navLinks = resolvePublicNavLinks(customNavItems);

  const handleNavClick = (key: string) => {
    setActiveTab(key);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleOpenDashboard = () => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
      handleNavClick('admin-portal');
    } else if (currentUser.role === 'teacher') {
      handleNavClick('teacher-portal');
    } else {
      handleNavClick('student-portal');
    }
  };

  const isLight = theme === 'light';
  const roleLabel =
    currentUser?.role === 'admin'
      ? 'Chancellor'
      : currentUser?.role === 'teacher'
      ? 'Faculty Teacher'
      : 'Student Profile';

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-200 border-b ${
        isLight
          ? 'bg-white/95 text-slate-800 border-slate-200/90 shadow-sm backdrop-blur-md'
          : 'bg-[#071120]/95 text-slate-100 border-slate-800/80 backdrop-blur-xl'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Clean Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group min-w-0 whitespace-nowrap shrink-0"
          >
            <BrandLogo
              customLogoUrl={customLogoUrl}
              size="sm"
              theme={theme}
              animated
              className="group-hover:scale-105 transition-transform"
            />
            <span
              className={`text-sm sm:text-base font-extrabold tracking-tight group-hover:text-[#0284C7] dark:group-hover:text-[#00F2FE] transition-colors whitespace-nowrap ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Deen Hijrah Academia
            </span>
          </button>
        </div>

        {/* Zone 2: SeerahVerse Single-Row Public Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-[13px] font-medium shrink-0">
          {navLinks.map((link) => {
            const isActive =
              activeTab === link.key ||
              (link.key === 'blogs' && activeTab === 'blog-detail') ||
              (link.key === 'courses' && (activeTab === 'course-detail' || activeTab === 'course-registration'));
            return (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNavClick(link.key)}
                className={`px-2 xl:px-2.5 py-2 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? isLight
                      ? 'border-[#0284C7] text-[#0284C7] font-bold'
                      : 'border-[#00F2FE] text-[#00F2FE] font-bold'
                    : isLight
                    ? 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    : 'border-transparent text-slate-300 hover:text-white hover:border-slate-600'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Post-Login Timezone Clock, Theme Switch, and Persistent Profile / Auth CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentUser && (
            <div className="hidden 2xl:flex items-center shrink-0">
              <LiveTimezoneClock
                compact
                onClick={onOpenAccountSettings ? () => onOpenAccountSettings('timezone') : undefined}
              />
            </div>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
              className={`p-2 rounded-xl transition-colors border shrink-0 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800'
              }`}
            >
              {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          )}

          {currentUser && (
            <div className="relative shrink-0" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setNotifMenuOpen((prev) => !prev);
                }}
                aria-expanded={notifMenuOpen}
                aria-label={
                  unreadNotificationsCount > 0
                    ? `Notifications (${unreadNotificationsCount} unread)`
                    : 'Notifications'
                }
                title={
                  unreadNotificationsCount > 0
                    ? `${unreadNotificationsCount} unread alert${unreadNotificationsCount === 1 ? '' : 's'}`
                    : 'Notifications'
                }
                className={`relative p-2 rounded-xl transition-colors border shrink-0 ${
                  notifMenuOpen
                    ? isLight
                      ? 'bg-sky-50 text-[#0284C7] border-[#0284C7]/40'
                      : 'bg-slate-800 text-[#00F2FE] border-[#00F2FE]/40'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 text-[10px] font-extrabold leading-none flex items-center justify-center shadow-[0_0_10px_rgba(0,242,254,0.55)] tabular-nums">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border shadow-2xl overflow-hidden z-50 origin-top-right ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-900'
                        : 'bg-[#0A192F] border-slate-700 text-slate-100'
                    }`}
                  >
                    <div
                      className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
                        isLight ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800 bg-[#071120]/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Bell className={`w-4 h-4 ${isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'}`} />
                        <span className="text-xs font-bold tracking-wide uppercase">
                          Notifications
                        </span>
                        {unreadNotificationsCount > 0 && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-semibold ${
                              isLight
                                ? 'bg-sky-100 text-[#0284C7]'
                                : 'bg-[#00F2FE]/15 text-[#00F2FE]'
                            }`}
                          >
                            {unreadNotificationsCount} new
                          </span>
                        )}
                      </div>

                      {unreadNotificationsCount > 0 && onMarkAllNotificationsRead && (
                        <button
                          type="button"
                          onClick={() => onMarkAllNotificationsRead()}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                            isLight
                              ? 'text-[#0284C7] hover:text-sky-800'
                              : 'text-[#00F2FE] hover:text-cyan-200'
                          }`}
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/80">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-8 text-center space-y-2">
                          <div
                            className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center ${
                              isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            <Bell className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-semibold">You&apos;re all caught up</p>
                          <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            Alerts appear here when new lecture recordings are added to your enrolled courses or when academy events are pinned.
                          </p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => {
                              setNotifMenuOpen(false);
                              onNotificationClick?.(notif);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                              !notif.read
                                ? isLight
                                  ? 'bg-sky-50/70 hover:bg-sky-100/70'
                                  : 'bg-[#0F2942]/65 hover:bg-[#133556]'
                                : isLight
                                ? 'hover:bg-slate-50'
                                : 'hover:bg-slate-900/50'
                            }`}
                          >
                            <div
                              className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                notif.type === 'recording'
                                  ? isLight
                                    ? 'bg-sky-100 text-[#0284C7] border-sky-200'
                                    : 'bg-[#00F2FE]/10 text-[#00F2FE] border-[#00F2FE]/25'
                                  : isLight
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              }`}
                            >
                              {notif.type === 'recording' ? (
                                <Video className="w-4 h-4" />
                              ) : (
                                <Pin className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[10px] font-mono uppercase tracking-wider ${
                                    notif.type === 'recording'
                                      ? isLight
                                        ? 'text-[#0284C7]'
                                        : 'text-[#00F2FE]'
                                      : isLight
                                      ? 'text-emerald-700'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {notif.type === 'recording' ? 'New Recording' : 'Pinned Event'}
                                </span>
                                <span className={`text-[10px] font-mono shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatNotificationTime(notif.timestamp)}
                                </span>
                              </div>
                              <p
                                className={`text-xs leading-snug line-clamp-2 ${
                                  !notif.read ? 'font-bold' : 'font-medium opacity-85'
                                }`}
                              >
                                {notif.title}
                              </p>
                              <p className={`text-[11px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {notif.subtitle}
                              </p>
                            </div>

                            {!notif.read && (
                              <span
                                aria-label="Unread"
                                className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                                  isLight ? 'bg-[#0284C7]' : 'bg-[#00F2FE]'
                                }`}
                              />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {currentUser ? (
            <div className="relative flex items-center gap-1.5 sm:gap-2" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifMenuOpen(false);
                  setProfileMenuOpen((prev) => !prev);
                }}
                aria-expanded={profileMenuOpen}
                aria-label={`Open profile menu for ${currentUser.firstName} ${currentUser.lastName}`}
                className={`group relative rounded-full p-1 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F2FE] shrink-0 ${
                  profileMenuOpen
                    ? 'shadow-[0_0_18px_rgba(0,242,254,0.5)]'
                    : 'shadow-sm hover:shadow-[0_0_14px_rgba(0,242,254,0.38)]'
                }`}
                title={`${currentUser.firstName} ${currentUser.lastName} · ${roleLabel}`}
              >
                {/* Live Rotating Circular Profile Halo Ring */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 48 48"
                  className="pointer-events-none absolute inset-0 w-full h-full animate-dha-spin-slow"
                >
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke={isLight ? '#0284C7' : '#00F2FE'}
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke={isLight ? '#0284C7' : '#00F2FE'}
                    strokeWidth="2.4"
                    strokeDasharray="36 32"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.4"
                    strokeDasharray="18 50"
                    strokeDashoffset="44"
                    strokeLinecap="round"
                  />
                </svg>

                <div className={`relative z-10 rounded-full p-[1.5px] ${isLight ? 'bg-white' : 'bg-[#071120]'}`}>
                  <SymbolicAvatar
                    gender={currentUser.gender}
                    avatarUrl={currentUser.avatarUrl}
                    name={`${currentUser.firstName} ${currentUser.lastName}`}
                    size="md"
                  />
                </div>
              </button>

              <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border shadow-2xl p-4 space-y-3 z-50 origin-top-right ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900'
                      : 'bg-[#0A192F] border-slate-700 text-slate-100'
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 pb-3 border-b ${
                      isLight ? 'border-slate-200' : 'border-slate-800'
                    }`}
                  >
                    <div className="rounded-full p-0.5 bg-gradient-to-tr from-[#00F2FE]/70 to-[#10B981]/70 shrink-0">
                      <div className={`rounded-full p-[1.5px] ${isLight ? 'bg-white' : 'bg-[#0A192F]'}`}>
                        <SymbolicAvatar
                          gender={currentUser.gender}
                          avatarUrl={currentUser.avatarUrl}
                          name={`${currentUser.firstName} ${currentUser.lastName}`}
                          size="lg"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">
                        {currentUser.firstName} {currentUser.lastName}
                      </div>
                      <div
                        className={`text-[11px] font-mono truncate ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {currentUser.email}
                      </div>
                      <div
                        className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${
                          isLight ? 'text-sky-700' : 'text-[#00F2FE]'
                        }`}
                      >
                        {roleLabel}
                      </div>
                    </div>
                  </div>

                  <div className="xl:hidden">
                    <LiveTimezoneClock
                      compact
                      onClick={
                        onOpenAccountSettings
                          ? () => {
                              setProfileMenuOpen(false);
                              onOpenAccountSettings('timezone');
                            }
                          : undefined
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handleOpenDashboard}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        isLight
                          ? 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200'
                          : 'bg-[#0F2942] hover:bg-[#133556] text-white border border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <UserIcon className={`w-3.5 h-3.5 ${isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'}`} />
                        Open Profile &amp; Workspace
                      </span>
                    </button>

                    {onOpenAccountSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onOpenAccountSettings('timezone');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          isLight
                            ? 'text-slate-700 hover:bg-slate-100'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                          Timezone &amp; Password Settings
                        </span>
                      </button>
                    )}

                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '?tab=home'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isLight
                          ? 'text-slate-600 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Current View in New Tab
                      </span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>

              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                  activeTab === 'signin'
                    ? 'bg-[#00F2FE]/15 text-[#0284C7] dark:text-[#00F2FE] border-[#00F2FE]/40'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_12px_rgba(0,242,254,0.3)] whitespace-nowrap shrink-0"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-1.5 rounded-lg transition-colors shrink-0 ${
              isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
            }`}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slideout Drawer */}
      {mobileMenuOpen && (
        <div
          className={`lg:hidden border-t px-4 pt-3 pb-5 space-y-3 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#071120] border-slate-800'
          }`}
        >
          {currentUser && (
            <button
              type="button"
              onClick={handleOpenDashboard}
              className={`w-full pb-3 border-b flex items-center justify-between text-left ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <SymbolicAvatar
                  gender={currentUser.gender}
                  avatarUrl={currentUser.avatarUrl}
                  name={`${currentUser.firstName} ${currentUser.lastName}`}
                  size="sm"
                />
                <div className="text-xs">
                  <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <LiveTimezoneClock compact />
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {navLinks.map((link) => (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNavClick(link.key)}
                className={`p-2.5 rounded-xl text-left transition-colors font-medium ${
                  activeTab === link.key ||
                  (link.key === 'blogs' && activeTab === 'blog-detail') ||
                  (link.key === 'courses' && activeTab === 'course-detail')
                    ? 'bg-[#00F2FE]/20 text-[#0284C7] dark:text-[#00F2FE] font-bold border border-[#00F2FE]/40'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {currentUser ? (
            <div
              className={`pt-2 border-t flex items-center justify-end ${
                isLight ? 'border-slate-200' : 'border-slate-800/80'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div
              className={`pt-3 border-t grid grid-cols-2 gap-2 ${
                isLight ? 'border-slate-200' : 'border-slate-800/80'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onOpenAuth('signin');
                  setMobileMenuOpen(false);
                }}
                className={`py-2.5 rounded-xl text-xs font-semibold border ${
                  isLight
                    ? 'bg-slate-100 text-slate-800 border-slate-200'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenAuth('signup');
                  setMobileMenuOpen(false);
                }}
                className="py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981]"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
