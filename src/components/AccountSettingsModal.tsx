import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { User } from '../types';
import {
  getAvailableTimezones,
  getBrowserDetectedTimezone,
  getSavedTimezonePreference,
  getTimezoneShortOffset,
  setSavedTimezonePreference,
} from '../utils/timezone';
import { getAuthHeaders, setStoredCachedUser } from '../services/firebaseService';

interface AccountSettingsModalProps {
  isOpen: boolean;
  initialTab?: 'timezone' | 'password';
  currentUser: User | null;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
  onNotify?: (kind: 'success' | 'error' | 'info', message: string) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  initialTab = 'timezone',
  currentUser,
  onClose,
  onUserUpdated,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'timezone' | 'password'>(initialTab);
  const [now, setNow] = useState<Date>(() => new Date());

  // Timezone state
  const detectedTz = useMemo(() => getBrowserDetectedTimezone(), []);
  const allTimezones = useMemo(() => getAvailableTimezones(), []);
  const [timezoneMode, setTimezoneMode] = useState<'auto' | 'custom'>(() =>
    currentUser?.timezone || getSavedTimezonePreference() ? 'custom' : 'auto'
  );
  const [selectedTz, setSelectedTz] = useState<string>(
    () => currentUser?.timezone || getSavedTimezonePreference() || detectedTz
  );
  const [tzSearch, setTzSearch] = useState('');
  const [tzSaving, setTzSaving] = useState(false);
  const [tzFeedback, setTzFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    const saved = currentUser?.timezone || getSavedTimezonePreference();
    setTimezoneMode(saved ? 'custom' : 'auto');
    setSelectedTz(saved || detectedTz);
    setTzFeedback(null);
    setPwFeedback(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [isOpen, initialTab, currentUser?.timezone, detectedTz]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onEsc);
    };
  }, [isOpen, onClose]);

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return allTimezones;
    return allTimezones.filter(
      (opt) =>
        opt.id.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q) ||
        opt.offset.toLowerCase().includes(q)
    );
  }, [allTimezones, tzSearch]);

  if (!isOpen) return null;

  const previewTz = timezoneMode === 'auto' ? detectedTz : selectedTz;
  const previewTime = new Intl.DateTimeFormat('en-US', {
    timeZone: previewTz,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now);
  const previewDate = new Intl.DateTimeFormat('en-US', {
    timeZone: previewTz,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(now);
  const previewOffset = getTimezoneShortOffset(previewTz);

  const handleSaveTimezone = async (e: React.FormEvent) => {
    e.preventDefault();
    setTzSaving(true);
    setTzFeedback(null);
    const targetTz = timezoneMode === 'auto' ? null : selectedTz;

    try {
      if (currentUser) {
        const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
        const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/timezone`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            timezone: targetTz || '',
            email: currentUser.email,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to save timezone preference.');
        }
        setSavedTimezonePreference(data.timezone || null);
        const updatedUser: User = {
          ...currentUser,
          ...data,
          timezone: data.timezone || undefined,
        };
        setStoredCachedUser(updatedUser);
        onUserUpdated(updatedUser);
      } else {
        setSavedTimezonePreference(targetTz);
      }

      const confirmation = targetTz
        ? `Saved timezone set to ${targetTz} (${getTimezoneShortOffset(targetTz)}).`
        : `Timezone reset to automatic browser detection (${detectedTz}).`;
      setTzFeedback({ kind: 'success', text: confirmation });
      onNotify?.('success', confirmation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save timezone preference.';
      setTzFeedback({ kind: 'error', text: msg });
      onNotify?.('error', msg);
    } finally {
      setTzSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPwFeedback(null);

    if (newPassword.trim().length < 6) {
      setPwFeedback({ kind: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ kind: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPwSaving(true);
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update password.');
      }

      const updatedUser: User = {
        ...currentUser,
        ...(data.user || {}),
        hasCustomPassword: true,
      };
      setStoredCachedUser(updatedUser);
      onUserUpdated(updatedUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      const msg = data?.message || 'Password updated successfully.';
      setPwFeedback({ kind: 'success', text: msg });
      onNotify?.('success', msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update password.';
      setPwFeedback({ kind: 'error', text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0B1C34] border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="account-settings-title"
              className="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Account Settings &amp; Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentUser
                ? `${currentUser.firstName} ${currentUser.lastName} · ${currentUser.email}`
                : 'Configure your local class schedule timezone'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account settings"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('timezone')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'timezone'
                  ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Timezone &amp; Schedule</span>
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'password'
                    ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password &amp; Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* TAB 1: TIMEZONE PREFERENCES */}
          {activeTab === 'timezone' && (
            <form onSubmit={handleSaveTimezone} className="space-y-5">
              {/* Live Preview Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Active Schedule Clock Preview
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {previewTz} · {previewOffset}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{previewDate}</div>
                </div>
                <div className="flex items-center gap-2 text-lg font-mono font-bold text-[#0284C7] dark:text-[#00F2FE] tabular-nums">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{previewTime}</span>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTimezoneMode('auto')}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    timezoneMode === 'auto'
                      ? 'bg-sky-50 dark:bg-[#00F2FE]/10 border-sky-400 dark:border-[#00F2FE]/60'
                      : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Automatic (Browser Detected)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
                    {detectedTz}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimezoneMode('custom')}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    timezoneMode === 'custom'
                      ? 'bg-sky-50 dark:bg-[#00F2FE]/10 border-sky-400 dark:border-[#00F2FE]/60'
                      : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Saved Custom Timezone
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
                    {selectedTz}
                  </div>
                </button>
              </div>

              {/* Custom IANA Selector */}
              {timezoneMode === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="tz-search-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Search City or Timezone
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="tz-search-input"
                        type="text"
                        value={tzSearch}
                        onChange={(e) => setTzSearch(e.target.value)}
                        placeholder="Search Riyadh, London, New York, Karachi, UTC..."
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="tz-select-dropdown"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Select Timezone ({filteredTimezones.length} available)
                    </label>
                    <select
                      id="tz-select-dropdown"
                      value={selectedTz}
                      onChange={(e) => setSelectedTz(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    >
                      {filteredTimezones.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {tzFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    tzFeedback.kind === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{tzFeedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={tzSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  {tzSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Timezone</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SET / CHANGE PASSWORD */}
          {activeTab === 'password' && currentUser && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE] shrink-0 mt-0.5" />
                <div>
                  {currentUser.hasCustomPassword ? (
                    <span>
                      Verify your existing password to set a new password for{' '}
                      <strong className="text-slate-900 dark:text-white">{currentUser.email}</strong>.
                    </span>
                  ) : currentUser.role === 'student' ? (
                    <span>
                      New student accounts start with default institutional key{' '}
                      <span className="font-mono font-bold text-slate-900 dark:text-[#00F2FE]">
                        6789
                      </span>
                      . Enter your existing key (or leave blank if signed in with Google) to set a permanent password.
                    </span>
                  ) : (
                    <span>
                      Verify your current credential to set a new password for{' '}
                      <strong className="text-slate-900 dark:text-white">{currentUser.email}</strong>.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="acct-current-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Existing Password
                </label>
                <div className="relative">
                  <input
                    id="acct-current-password"
                    type={showCurrentPass ? 'text' : 'password'}
                    required={Boolean(currentUser.hasCustomPassword || currentUser.role !== 'student')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={
                      !currentUser.hasCustomPassword && currentUser.role === 'student'
                        ? 'Enter 6789 (or leave blank if Google-signed)'
                        : 'Enter your current password'
                    }
                    autoComplete="current-password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass((v) => !v)}
                    aria-label={showCurrentPass ? 'Hide existing password' : 'Show existing password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="acct-new-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="acct-new-password"
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((v) => !v)}
                      aria-label={showNewPass ? 'Hide new password' : 'Show new password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="acct-confirm-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="acct-confirm-password"
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                  />
                </div>
              </div>

              {pwFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    pwFeedback.kind === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {pwFeedback.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  {pwSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save New Password</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
