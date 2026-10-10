import React, { useState } from 'react';
import {
  Info,
  Cloud,
  CloudUpload,
  CloudDownload,
  LogIn,
  LogOut,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Mail,
  Lock,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsView: React.FC = () => {
  const {
    user,
    isAuthLoading,
    isSyncing,
    cloudSyncStatus,
    pendingSyncCount,
    signIn,
    resetPassword,
    signOut,
    syncAllToCloud,
    pullFromCloud,
    reconcileLocalRecords,
    people,
    visits,
    territories,
  } = useApp();

  const [authMode, setAuthMode] = useState<'signin' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(trimmedEmail, password);
      setPassword('');
      setAuthError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthError('Please enter your email address to receive reset instructions.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(trimmedEmail);
      setResetSuccessMessage(`Password reset link sent to ${trimmedEmail}. Please check your inbox.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-28 md:pb-12">
      {/* Unified Compact Header */}
      <header className="sticky top-0 md:top-[58px] lg:top-0 z-30 bg-white border-b border-[#E7E3DA] px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 min-h-[44px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon-192.png"
              alt="Deaf Contact Record"
              className="w-8 h-8 rounded-[10px] object-cover shadow-2xs ring-1 ring-black/5 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-slate-900 leading-tight select-none">
                DEAF CONTACT RECORD
              </p>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                Settings
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Settings Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Section 1: Account */}
          <section className="bg-white rounded-[16px] border border-[#E7E3DA] shadow-xs p-5 md:col-span-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight mb-4">Account</h2>
            <div className="flex items-center justify-between gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-sm font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{user.displayName || user.email}</p>
                    <p className="text-xs font-semibold text-emerald-700 mt-0.5">Account connected</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Not signed in.</p>
              )}
              {user && (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-4 py-2 rounded-[10px] text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>

            {/* Cloud Backup Section */}
            <div className="mt-6 pt-6 border-t border-[#E7E3DA]">
              <h2 className="text-base font-bold text-slate-900 tracking-tight mb-4">Cloud Backup</h2>
              <div className="mb-4 text-sm font-semibold text-slate-700">
                Status: {cloudSyncStatus === 'syncing' ? 'Syncing...' : cloudSyncStatus === 'synced' ? 'Up to date' : cloudSyncStatus === 'offline' ? 'Offline — changes saved on this device' : cloudSyncStatus === 'error' ? 'Couldn\'t sync — try again' : pendingSyncCount > 0 ? 'Changes waiting to sync' : 'Up to date'}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => pullFromCloud()}
                  className="px-4 py-2 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-[10px]"
                >
                  Download Shared Records
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => syncAllToCloud()}
                    className="px-4 py-2 bg-[#0F766E] text-sm font-semibold text-white hover:bg-[#115e55] rounded-[10px]"
                  >
                    Sync Changes
                  </button>
                )}
              </div>
            </div>

            {/* Storage Section */}
            <div className="mt-6 pt-6 border-t border-[#E7E3DA]">
              <h2 className="text-base font-bold text-slate-900 tracking-tight mb-4">Storage</h2>
              <div className="flex gap-8 text-sm">
                <div>
                  <p className="text-slate-500">Contacts on this device</p>
                  <p className="font-bold text-slate-900 text-lg">{people.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Visits recorded</p>
                  <p className="font-bold text-slate-900 text-lg">{visits.length}</p>
                </div>
              </div>
            </div>

            {/* If Signed Out: Display Email/Password Sign-In or Forgot Password Flow */}
            {!user && (
              <div className="mt-5 pt-5 border-t border-[#E7E3DA] max-w-md">
                {authMode === 'signin' ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Sign In</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sign in with your email and password to synchronize your records with Firebase Cloud.
                      </p>
                    </div>

                    {authError && (
                      <div className="p-3 rounded-[10px] bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 leading-relaxed">{authError}</div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="settings-email">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="settings-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="publisher@example.com"
                          className="w-full pl-9 pr-3.5 py-2 text-sm rounded-[10px] border border-slate-300 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition-all placeholder:text-slate-400 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700" htmlFor="settings-password">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot');
                            setAuthError(null);
                            setResetSuccessMessage(null);
                          }}
                          className="text-xs font-medium text-[#0F766E] hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="settings-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-10 py-2 text-sm rounded-[10px] border border-slate-300 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition-all placeholder:text-slate-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || isAuthLoading}
                      className="w-full py-2.5 px-4 rounded-[10px] text-sm font-semibold bg-[#0F766E] hover:bg-[#0D655E] text-white shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting || isAuthLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>Sign In</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-slate-500 text-center">
                      Authorized accounts only. Public registration is not enabled.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signin');
                          setAuthError(null);
                          setResetSuccessMessage(null);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline mb-2 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Sign In</span>
                      </button>
                      <h3 className="text-sm font-bold text-slate-900">Reset Password</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enter your registered email address and we will send you a password reset link.
                      </p>
                    </div>

                    {authError && (
                      <div className="p-3 rounded-[10px] bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 leading-relaxed">{authError}</div>
                      </div>
                    )}

                    {resetSuccessMessage && (
                      <div className="p-3 rounded-[10px] bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1 leading-relaxed">{resetSuccessMessage}</div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="settings-reset-email">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="settings-reset-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="publisher@example.com"
                          className="w-full pl-9 pr-3.5 py-2 text-sm rounded-[10px] border border-slate-300 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition-all placeholder:text-slate-400 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-[10px] text-sm font-semibold bg-[#0F766E] hover:bg-[#0D655E] text-white shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Reset Email...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Send Password Reset Link</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}


          </section>

        </div>
        <div className="text-center text-xs text-slate-400 mt-8 mb-4">Deaf Contact Record · v1.0.0</div>
      </main>
    </div>
  );
};
