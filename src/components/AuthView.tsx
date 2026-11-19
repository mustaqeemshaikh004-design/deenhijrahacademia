import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  Globe,
  ShieldCheck,
  GraduationCap,
  HelpCircle,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  Award,
  Phone,
  MapPin,
} from 'lucide-react';
import type { User, UserGender } from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';
import { BrandLogo } from './BrandLogo';
import { auth, googleProvider, sendPasswordResetEmail, signInWithPopup } from '../firebase';
import {
  syncUserProfileToFirestore,
  setStoredSessionToken,
  setStoredCachedUser,
  formatFirebaseAuthError,
} from '../services/firebaseService';
import { setSavedTimezonePreference, getSavedTimezonePreference } from '../utils/timezone';

interface AuthViewProps {
  initialMode?: 'signin' | 'signup';
  initialSignupType?: 'student' | 'instructor';
  onSignupTypeChange?: (type: 'student' | 'instructor') => void;
  onAuthenticated: (user: User, adminSessionToken?: string) => void;
  onNavigateTab?: (tab: string) => void;
  customLogoUrl?: string;
  isModal?: boolean;
  onClose?: () => void;
}

const EXPERTISE_TRACKS = [
  'Seerah & Prophetic History',
  'Quranic Tafsir & Sciences',
  'Hadith & Mustalah al-Hadith',
  'Classical Arabic & Nahw',
  'Fiqh & Usul al-Fiqh',
  'Aqidah & Tazkiyah',
];

const QUICK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Australia/Sydney',
];

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode = 'signin',
  initialSignupType = 'student',
  onSignupTypeChange,
  onAuthenticated,
  onNavigateTab,
  customLogoUrl,
  isModal = false,
  onClose,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Sign In State (Never prefill admin email/secret keys)
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [resetTab, setResetTab] = useState<'existing' | 'email'>('existing');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCurrentPassword, setResetCurrentPassword] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPasswords, setShowResetPasswords] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sign Up Path & Fields (Seerahverse Student vs Instructor path framing)
  const [signupPath, setSignupPath] = useState<'student' | 'instructor'>(initialSignupType);
  useEffect(() => {
    setSignupPath(initialSignupType);
  }, [initialSignupType]);

  const handleSelectSignupPath = (nextPath: 'student' | 'instructor') => {
    setSignupPath(nextPath);
    setErrorMsg('');
    setSuccessNotice(null);
    if (onSignupTypeChange) {
      onSignupTypeChange(nextPath);
    }
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [useCustomCredentials, setUseCustomCredentials] = useState(true);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [timezonePref, setTimezonePref] = useState<string>(
    () => getSavedTimezonePreference() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [expertiseTrack, setExpertiseTrack] = useState<string>(EXPERTISE_TRACKS[0]);
  const [qualifications, setQualifications] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const firstSlug = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'scholar';
  const lastSlug = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
  const previewEmail =
    firstName.trim() && lastName.trim()
      ? `${firstSlug}.${lastSlug}@deenhijrahacademia.edu`
      : 'firstname.lastname@deenhijrahacademia.edu';

  const routeAfterAuth = (user: User, adminSessionToken?: string) => {
    const targetTab =
      user.role === 'admin'
        ? 'admin-portal'
        : user.role === 'teacher'
        ? 'teacher-portal'
        : 'student-portal';
    onAuthenticated(user, adminSessionToken);
    if (onClose) onClose();
    if (onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInEmail.trim(),
          password: signInPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      const sessionToken = data.sessionToken || data.adminSessionToken || '';
      if (sessionToken) {
        setStoredSessionToken(sessionToken);
      }
      setStoredCachedUser(data.user);
      if (data.user.timezone) {
        setSavedTimezonePreference(data.user.timezone);
      }
      setSuccessNotice(`Welcome back, ${data.user.firstName}! Timezone Clock Activated.`);
      setTimeout(() => routeAfterAuth(data.user, data.adminSessionToken || sessionToken), 350);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetWithExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    const emailTarget = (resetEmail || signInEmail).trim().toLowerCase();
    if (!emailTarget || !resetCurrentPassword || !resetNewPassword) {
      setResetFeedback({
        kind: 'error',
        text: 'Please fill in your email address, existing password, and new password.',
      });
      return;
    }
    if (resetNewPassword.trim().length < 6) {
      setResetFeedback({
        kind: 'error',
        text: 'New password must be at least 6 characters long.',
      });
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetFeedback({
        kind: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    setResetBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTarget,
          currentPassword: resetCurrentPassword,
          newPassword: resetNewPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to reset password.');
      }
      setSignInEmail(emailTarget);
      setSignInPassword('');
      setResetCurrentPassword('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setResetFeedback({
        kind: 'success',
        text:
          data?.message ||
          'New password saved! You can now sign in above using your updated password.',
      });
    } catch (err: unknown) {
      setResetFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to update password.',
      });
    } finally {
      setResetBusy(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    const emailTarget = (resetEmail || signInEmail).trim().toLowerCase();
    if (!emailTarget) {
      setResetFeedback({
        kind: 'error',
        text: 'Please enter the email address associated with your account.',
      });
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, emailTarget);
      setResetFeedback({
        kind: 'success',
        text: `If ${emailTarget} uses email/password Firebase sign-in, a reset link has been sent. Google users should sign in with Google below; new student accounts default to key 6789.`,
      });
    } catch {
      setResetFeedback({
        kind: 'success',
        text: `For Google accounts, click "Continue with Google" below. Newly onboarded student accounts use default key 6789 (which you can change anytime via "Using Existing Password"), or write to admissions@deenhijrahacademia.edu.`,
      });
    } finally {
      setResetBusy(false);
    }
  };

  const handleGoogleSignIn = async (explicitRequestedRole?: 'student' | 'teacher') => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const displayName = fbUser.displayName || 'Scholar User';
      const [first, ...rest] = displayName.split(' ');
      const last = rest.join(' ') || 'User';
      const email = fbUser.email || '';

      const idToken = await fbUser.getIdToken();

      const resolvedRequestedRole =
        explicitRequestedRole ||
        (mode === 'signup' ? (signupPath === 'instructor' ? 'teacher' : 'student') : undefined);

      const res = await fetch('/api/auth/google-callback', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: fbUser.uid,
          email,
          firstName: first,
          lastName: last,
          avatarUrl: fbUser.photoURL || undefined,
          ...(resolvedRequestedRole ? { requestedRole: resolvedRequestedRole } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.error || 'Could not complete Google session synchronization.'
        );
      }

      const data = await res.json();
      await Promise.allSettled([
        syncUserProfileToFirestore({
          ...data.user,
          id: fbUser.uid,
          email: fbUser.email || data.user.email,
          avatarUrl: fbUser.photoURL || data.user.avatarUrl,
        }),
      ]);

      const sessionToken = data.sessionToken || data.adminSessionToken || '';
      if (sessionToken) {
        setStoredSessionToken(sessionToken);
      }
      setStoredCachedUser(data.user);
      setSuccessNotice(
        `Signed in with Google! Welcome, ${data.user.firstName}. Global Clock Activated.`
      );
      setTimeout(() => routeAfterAuth(data.user, data.adminSessionToken || sessionToken), 350);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setErrorMsg(
        formatFirebaseAuthError(err, 'Google sign-in was canceled or encountered an issue.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Please enter both your First Name and Last Name.');
      return;
    }

    const isInstructor = signupPath === 'instructor';
    const needsCustomEmail = isInstructor || useCustomCredentials;

    if (needsCustomEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (needsCustomEmail && signupPassword.trim().length < 6) {
      setErrorMsg('Please enter a password of at least 6 characters.');
      return;
    }

    if (isInstructor && !qualifications.trim()) {
      setErrorMsg('Please summarize your academic qualifications or Ijazah/teaching background.');
      return;
    }

    if (!agreedTerms) {
      setErrorMsg('Please confirm the Code of Academic Integrity before creating your account.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        accountType: isInstructor ? 'Instructor' : 'Student',
        phoneWhatsApp: phoneWhatsApp.trim(),
        country: country.trim(),
        city: city.trim(),
        timezone: timezonePref,
      };

      if (needsCustomEmail) {
        payload.email = signupEmail.trim().toLowerCase();
        payload.password = signupPassword.trim();
      }
      if (isInstructor) {
        payload.expertise = expertiseTrack;
        payload.qualifications = qualifications.trim();
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken);
      }
      setStoredCachedUser(data.user);
      if (timezonePref) {
        setSavedTimezonePreference(timezonePref);
      }
      setSuccessNotice(
        isInstructor
          ? `Instructor account activated (${data.user.email}). Entering Faculty Portal...`
          : `Student account created (${data.user.email}). Welcome, ${data.user.firstName}!`
      );
      setTimeout(() => routeAfterAuth(data.user, data.sessionToken), 400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className={`w-full ${
        isModal
          ? 'p-0'
          : 'min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center'
      }`}
    >
      <div className="w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0B1C34] shadow-2xl grid grid-cols-1 lg:grid-cols-12 transition-colors">
        {/* LEFT BRAND COLUMN (Seerahverse Academic Identity Panel) */}
        <div className="lg:col-span-5 relative bg-gradient-to-br from-[#0F2942] via-[#0A192F] to-[#06101E] text-white p-7 sm:p-10 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Subtle Ambient Radial Glow */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#00F2FE]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#10B981]/15 blur-3xl" />

          <div className="relative z-10 space-y-6">
            {onNavigateTab && !isModal && (
              <button
                type="button"
                onClick={() => onNavigateTab('home')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-[#00F2FE] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to home</span>
              </button>
            )}

            <div className="flex items-center gap-3.5">
              <BrandLogo customLogoUrl={customLogoUrl} size="lg" theme="dark" animated />
              <div>
                <div className="text-lg font-extrabold tracking-tight text-white">
                  Deen Hijrah Academia
                </div>
                <div className="text-[11px] font-mono text-[#00F2FE] tracking-wide">
                  Where Knowledge Meets Character
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-white">
                {mode === 'signin'
                  ? 'Welcome Back to Your Study Sanctuary'
                  : signupPath === 'instructor'
                  ? 'Join as a Scholar & Course Instructor'
                  : 'Begin Your Classical & Modern Journey'}
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {mode === 'signup' && signupPath === 'instructor'
                  ? 'Teach live global cohorts, configure student seat caps and time limits, grade submissions, and mentor seekers of knowledge.'
                  : 'Access live classroom cohorts, automatic timezone clocking, free orientation streams, and verified lecture archives in one unified campus.'}
              </p>
            </div>

            <div className="space-y-3.5 pt-2 text-xs text-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#00F2FE]/15 border border-[#00F2FE]/30 text-[#00F2FE] flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Orientation Open to Everyone</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Preview course orientations before completing free enrollment to unlock cohort videos.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Global Timezone Auto-Clock</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Live study clock activates across your session automatically once you sign in.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">Protected Firebase & Cloud Security</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Unified single sign-on via institutional email or verified Google Workspace auth.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Mail className="w-3.5 h-3.5 text-[#00F2FE]" />
              <span>admissions@deenhijrahacademia.edu</span>
            </div>
            <div>Global Admissions Support · Response within 24 hours</div>
          </div>
        </div>

        {/* RIGHT AUTH FORM COLUMN (Seerahverse Clean Form Surface) */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-[#0B1C34] text-slate-900 dark:text-slate-100">
          {/* Clean Seerahverse Mode Switcher */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
                setSuccessNotice(null);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signin'
                  ? 'bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
                setSuccessNotice(null);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-[#00F2FE] to-[#10B981] text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/50 text-xs text-rose-700 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/50 text-xs text-emerald-700 dark:text-emerald-200 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* SIGN IN VIEW */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Welcome Back
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Sign in to your Deen Hijrah Academia account
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotHelp((v) => !v);
                      setResetEmail((prev) => prev || signInEmail);
                      setResetFeedback(null);
                    }}
                    className="text-xs font-medium text-[#0284C7] dark:text-[#00F2FE] hover:underline flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Forgot or reset password?</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00F2FE] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {showForgotHelp && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00F2FE]" />
                        <span>Password Reset &amp; Update</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowForgotHelp(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setResetTab('existing');
                          setResetFeedback(null);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                          resetTab === 'existing'
                            ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Have Existing Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTab('email');
                          setResetFeedback(null);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                          resetTab === 'email'
                            ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Forgot Password
                      </button>
                    </div>

                    {resetTab === 'existing' ? (
                      <div className="space-y-2.5 text-xs">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Verify your current password (newly onboarded student accounts start with default key{' '}
                          <span className="font-mono font-bold text-slate-800 dark:text-[#00F2FE]">
                            6789
                          </span>
                          ) to set a new password.
                        </p>
                        <input
                          type="email"
                          value={resetEmail || signInEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="Your account email"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                        />
                        <div className="relative">
                          <input
                            type={showResetPasswords ? 'text' : 'password'}
                            value={resetCurrentPassword}
                            onChange={(e) => setResetCurrentPassword(e.target.value)}
                            placeholder="Existing password (or 6789 if unchanged)"
                            className="w-full pl-3 pr-9 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPasswords((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            aria-label={showResetPasswords ? 'Hide reset passwords' : 'Show reset passwords'}
                          >
                            {showResetPasswords ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type={showResetPasswords ? 'text' : 'password'}
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            placeholder="New password (min 6 chars)"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                          />
                          <input
                            type={showResetPasswords ? 'text' : 'password'}
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={resetBusy}
                          onClick={handleResetWithExisting}
                          className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {resetBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Save New Password</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 text-xs">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Enter your registered email to request a password reset email, or use{' '}
                          <strong>Continue with Google</strong> below if you enrolled via Google.
                        </p>
                        <input
                          type="email"
                          value={resetEmail || signInEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                        />
                        <button
                          type="button"
                          disabled={resetBusy}
                          onClick={handleSendResetEmail}
                          className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {resetBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Send Reset Instructions</span>
                        </button>
                      </div>
                    )}

                    {resetFeedback && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                          resetFeedback.kind === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{resetFeedback.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-[#00F2FE] focus:ring-0"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg('');
                  }}
                  className="text-[#0284C7] dark:text-[#00F2FE] hover:underline font-medium"
                >
                  New student? Create account
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_-6px_rgba(0,242,254,0.4)] disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Verifying Account...' : 'Sign In'}</span>
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase font-mono">
                  <span className="bg-white dark:bg-[#0B1C34] px-3 text-slate-400 dark:text-slate-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-white bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (Firebase)</span>
              </button>
            </form>
          )}

          {/* CREATE ACCOUNT VIEW (SeerahVerse /signup?type=Student & /signup?type=Instructor with Google Sign-Up) */}
          {mode === 'signup' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {signupPath === 'instructor'
                      ? 'Instructor Registration'
                      : 'Student Registration'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {signupPath === 'instructor'
                      ? 'Create your faculty account to lead cohorts & set course capacity/time limits'
                      : 'Tuition-Free Global Enrollment · Instant Access to Orientations'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-[#0284C7] dark:text-[#00F2FE] border border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  /signup?type={signupPath === 'instructor' ? 'Instructor' : 'Student'}
                </span>
              </div>

              {/* Path Selection Cards (Seerahverse Student vs Instructor Switch) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectSignupPath('student')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    signupPath === 'student'
                      ? 'border-[#00F2FE] bg-[#00F2FE]/10 dark:bg-[#00F2FE]/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    <GraduationCap className="w-4 h-4 text-[#0284C7] dark:text-[#00F2FE]" />
                    <span>Student</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Join free courses &amp; cohorts
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSignupPath('instructor')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    signupPath === 'instructor'
                      ? 'border-[#10B981] bg-[#10B981]/10 dark:bg-[#10B981]/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    <Award className="w-4 h-4 text-[#10B981]" />
                    <span>Instructor</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Teach &amp; manage course cohorts
                  </div>
                </button>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3.5">
                {/* Live Symbolic Vector Avatar Preview */}
                <div className="flex items-center gap-3.5 p-3 bg-slate-50 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <SymbolicAvatar
                    gender={gender}
                    name={`${firstName || (signupPath === 'instructor' ? 'Instructor' : 'Student')} ${lastName || ''}`}
                    size="md"
                  />
                  <div className="text-xs min-w-0 flex-1">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {firstName && lastName
                        ? `${signupPath === 'instructor' ? 'Ustadh/Ustadha ' : ''}${firstName} ${lastName}`
                        : signupPath === 'instructor'
                        ? 'Prospective Faculty Instructor'
                        : 'Prospective Student Scholar'}
                    </div>
                    <div className="text-[11px] text-[#0284C7] dark:text-[#00F2FE] font-mono mt-0.5 truncate">
                      {signupPath === 'instructor'
                        ? `Track: ${expertiseTrack}`
                        : gender === 'female'
                        ? 'Sacred Rosette Emblem · Sisters Sanctuary'
                        : 'Minaret Khatam Emblem · Brothers Sanctuary'}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                    {signupPath === 'instructor' ? 'Faculty' : 'Fee: $0'}
                  </span>
                </div>

                {/* First & Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={signupPath === 'instructor' ? 'e.g. Tariq' : 'e.g. Zayd'}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={signupPath === 'instructor' ? 'e.g. Al-Mansoor' : 'e.g. Farooq'}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>
                </div>

                {/* Gender / Wing */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {signupPath === 'instructor' ? 'Faculty Wing / Gender' : 'Study Track / Gender'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                        gender === 'male'
                          ? 'bg-[#10B981]/15 border-[#10B981] text-[#059669] dark:text-[#10B981]'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {signupPath === 'instructor' ? 'Male Instructor (Brothers Wing)' : 'Male Student (Brothers)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                        gender === 'female'
                          ? 'bg-[#00F2FE]/15 border-[#00F2FE] text-[#0284C7] dark:text-[#00F2FE]'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {signupPath === 'instructor' ? 'Female Instructor (Sisters Wing)' : 'Female Student (Sisters)'}
                    </button>
                  </div>
                </div>

                {/* Student Option: Custom Email/Password vs Quick Institutional Key */}
                {signupPath === 'student' && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Sign-up Email Preference
                    </span>
                    <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setUseCustomCredentials(true)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          useCustomCredentials
                            ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Personal Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseCustomCredentials(false)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          !useCustomCredentials
                            ? 'bg-white dark:bg-[#0F2942] text-slate-900 dark:text-[#00F2FE] shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Auto-ID
                      </button>
                    </div>
                  </div>
                )}

                {/* Email & Password Inputs (Always required for Instructor, selectable for Student) */}
                {(signupPath === 'instructor' || useCustomCredentials) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder={signupPath === 'instructor' ? 'ustadh@example.com' : 'you@example.com'}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Create Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full pl-3.5 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00F2FE]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Assigned Institutional Email:
                    </div>
                    <div className="text-[#0284C7] dark:text-[#00F2FE] font-bold truncate">
                      {previewEmail}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Universal Student Key:
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">6789</span>
                    </div>
                  </div>
                )}

                {/* Location / WhatsApp / Timezone Row (SeerahVerse Intake Alignment) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>WhatsApp / Phone (Optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneWhatsApp}
                      onChange={(e) => setPhoneWhatsApp(e.target.value)}
                      placeholder="+1 555 0199 (optional)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#10B981]" />
                      <span>Country &amp; City</span>
                    </label>
                    <input
                      type="text"
                      value={country ? (city ? `${city}, ${country}` : country) : city}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setCity('');
                      }}
                      placeholder="e.g. London, UK"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-[#0284C7] dark:text-[#00F2FE]" />
                      <span>Timezone</span>
                    </label>
                    <select
                      value={QUICK_TIMEZONES.includes(timezonePref) ? timezonePref : 'UTC'}
                      onChange={(e) => setTimezonePref(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00F2FE]"
                    >
                      {QUICK_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Instructor-Specific Specialization & Qualifications */}
                {signupPath === 'instructor' && (
                  <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Primary Academic Expertise Track <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={expertiseTrack}
                        onChange={(e) => setExpertiseTrack(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#10B981]"
                      >
                        {EXPERTISE_TRACKS.map((track) => (
                          <option key={track} value={track}>
                            {track}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Academic Credentials, Ijazah &amp; Teaching Background{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={qualifications}
                        onChange={(e) => setQualifications(e.target.value)}
                        placeholder="e.g. BA in Usul al-Din, 5+ years teaching Seerah & Classical Arabic cohorts..."
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#10B981]"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-[#00F2FE] focus:ring-0"
                  />
                  <span>I accept the Deen Hijrah Academia Honor &amp; Study Ethics</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_-6px_rgba(0,242,254,0.4)] disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {isLoading
                      ? 'Creating Account...'
                      : signupPath === 'instructor'
                      ? 'Register as Course Instructor'
                      : 'Create Free Student Account'}
                  </span>
                </button>

                <div className="relative my-2.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase font-mono">
                    <span className="bg-white dark:bg-[#0B1C34] px-3 text-slate-400 dark:text-slate-500">
                      Or sign up with Google
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(signupPath === 'instructor' ? 'teacher' : 'student')}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-white bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {signupPath === 'instructor'
                      ? 'Sign up as Instructor with Google'
                      : 'Sign up as Student with Google'}
                  </span>
                </button>
              </form>

              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                  }}
                  className="font-semibold text-[#0284C7] dark:text-[#00F2FE] hover:underline"
                >
                  Log in here
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
