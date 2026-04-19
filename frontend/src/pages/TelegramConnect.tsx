import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTelegram } from '../hooks/useTelegram';

export default function TelegramConnect() {
  const { user, login, register, logout } = useAuthStore();
  const { link, loading, copied, error, polling, generateLink, copyLink, openInTelegram } = useTelegram();

  const [tab, setTab]               = useState<'login' | 'register'>('login');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [authError, setAuthError]   = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPass, setShowPass]     = useState(false);

  const handleAuth = async () => {
    if (!email || !password) { setAuthError('Please fill in all fields.'); return; }
    setAuthLoading(true); setAuthError(''); setSuccessMsg('');
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
        setSuccessMsg('Account created! You can now sign in.');
        setTab('login');
        setPassword('');
      }
    } catch (e: any) {
      setAuthError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── NOT LOGGED IN ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-[#080c12] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 items-center justify-center mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Sentry Hub</h1>
            <p className="text-white/35 text-sm mt-1">
              {tab === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-6">

            {/* Tab switcher */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-6">
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setAuthError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/35 hover:text-white/60'
                  }`}>
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            {/* Success message */}
            {successMsg && (
              <div className="flex items-start gap-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3.5 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p className="text-emerald-400 text-sm">{successMsg}</p>
              </div>
            )}

            {/* Error message */}
            {authError && (
              <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl p-3.5 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-red-400 text-sm">{authError}</p>
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <label className="block text-white/50 text-xs font-medium mb-1.5">Email address</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 focus:bg-white/7 transition-all"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-white/50 text-xs font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 focus:bg-white/7 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleAuth} disabled={authLoading}
              className="w-full bg-red-500 hover:bg-red-400 disabled:bg-red-500/40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-all shadow-lg shadow-red-500/20">
              {authLoading
                ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
                : (tab === 'login' ? 'Sign In' : 'Create Account')}
            </button>

            {/* Switch tab hint */}
            <p className="text-center text-white/25 text-xs mt-4">
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setAuthError(''); }}
                className="text-white/50 hover:text-white underline transition-colors">
                {tab === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── LOGGED IN ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080c12] p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white text-xl font-semibold">Telegram Alerts</h1>
            <p className="text-white/35 text-sm mt-0.5">{user.email}</p>
          </div>
          <button onClick={logout}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/8 text-sm transition-all">
            Sign out
          </button>
        </div>

        {/* Connection status */}
        <div className={`rounded-2xl border p-5 mb-4 ${
          user.telegramConnected
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-white/3 border-white/8'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              user.telegramConnected ? 'bg-emerald-500/15' : 'bg-white/5'
            }`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={user.telegramConnected ? '#34d399' : '#ffffff40'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${user.telegramConnected ? 'text-emerald-400' : 'text-white/60'}`}>
                {user.telegramConnected ? 'Telegram connected' : 'Not connected'}
              </p>
              <p className="text-white/30 text-xs mt-0.5">
                {user.telegramConnected
                  ? 'You will receive security alerts on Telegram'
                  : 'Connect to get instant alerts on your phone'}
              </p>
            </div>
          </div>
        </div>

        {/* Connect section */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-4">
          <h2 className="text-white text-sm font-semibold mb-4">Connect your account</h2>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl p-3 mb-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {polling && (
            <div className="flex items-center gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 mb-4">
              <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-blue-400 text-sm">Waiting for you to open the link in Telegram…</p>
            </div>
          )}

          {!link ? (
            <button onClick={generateLink} disabled={loading}
              className="w-full bg-[#229ed9] hover:bg-[#1e8fc4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {loading ? 'Generating link…' : 'Generate Telegram link'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-white/40 text-[10px] font-medium uppercase tracking-wide mb-1.5">Your link</p>
                <p className="text-blue-400 text-xs break-all leading-relaxed font-mono">{link}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={openInTelegram}
                  className="bg-[#229ed9] hover:bg-[#1e8fc4] text-white font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Open
                </button>
                <button onClick={copyLink}
                  className={`font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    copied ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-white/8 hover:bg-white/12 text-white/70'
                  }`}>
                  {copied ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg> Copied</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg> Copy</>
                  )}
                </button>
              </div>
              <button onClick={generateLink} disabled={loading}
                className="w-full bg-white/5 hover:bg-white/8 text-white/40 hover:text-white/60 text-sm py-2.5 rounded-xl transition-all">
                Generate new link
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h2 className="text-white text-sm font-semibold mb-4">How it works</h2>
          <div className="space-y-3.5">
            {[
              { n: '1', text: 'Click "Generate Telegram link" above' },
              { n: '2', text: 'Open the link on your phone in the Telegram app' },
              { n: '3', text: 'Press Start in the Sentry bot' },
              { n: '4', text: 'Done — you\'ll receive instant alerts when threats are detected' },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-white/8 flex items-center justify-center text-white/40 text-[10px] font-bold flex-shrink-0 mt-0.5">{n}</span>
                <p className="text-white/45 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}