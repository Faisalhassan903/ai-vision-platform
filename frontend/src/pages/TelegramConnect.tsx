import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTelegram } from '../hooks/useTelegram';

export default function TelegramConnect() {
  const { user, login, register, logout } = useAuthStore();
  const { link, loading, copied, error, polling, generateLink, copyLink, openInTelegram } = useTelegram();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    setSuccessMsg('');
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
        setSuccessMsg('Account created! Please login.');
        setTab('login');
      }
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <span className="text-5xl">🛡️</span>
            <h1 className="text-green-400 font-mono text-xl tracking-widest mt-3">SENTRY AI</h1>
            <p className="text-gray-500 text-xs tracking-widest mt-1">TELEGRAM ALERTS SETUP</p>
          </div>

          {/* Card */}
          <div className="bg-gray-900 border border-gray-800 border-t-green-400 p-8">

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6">
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 pb-3 font-mono text-xs tracking-widest transition-colors
                    ${tab === t ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {authError && (
              <div className="bg-red-900/20 border-l-2 border-red-500 text-red-400 font-mono text-xs p-3 mb-4">
                {authError.toUpperCase()}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-900/20 border-l-2 border-green-500 text-green-400 font-mono text-xs p-3 mb-4">
                {successMsg.toUpperCase()}
              </div>
            )}

            <div className="mb-4">
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2">EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="operator@sentry.ai"
                className="w-full bg-black border border-gray-800 text-gray-200 font-mono text-sm px-4 py-3 outline-none focus:border-green-400 transition-colors" />
            </div>

            <div className="mb-6">
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2">PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="••••••••"
                className="w-full bg-black border border-gray-800 text-gray-200 font-mono text-sm px-4 py-3 outline-none focus:border-green-400 transition-colors" />
            </div>

            <button onClick={handleAuth} disabled={authLoading}
              className="w-full border border-green-400 text-green-400 font-mono text-xs tracking-widest py-3 hover:bg-green-400/10 transition-colors disabled:opacity-40">
              {authLoading ? 'AUTHENTICATING...' : tab === 'login' ? 'ENTER SYSTEM' : 'CREATE ACCOUNT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Logged in ──
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
          <div>
            <h1 className="text-green-400 font-mono text-lg tracking-widest">⚡ TELEGRAM ALERTS</h1>
            <p className="text-gray-500 font-mono text-xs mt-1">{user.email}</p>
          </div>
          <button onClick={logout}
            className="border border-gray-700 text-gray-500 font-mono text-xs px-4 py-2 hover:border-red-500 hover:text-red-400 transition-colors">
            LOGOUT
          </button>
        </div>

        {/* Status */}
        <div className="bg-gray-900 border border-gray-800 p-6 mb-4">
          <div className="text-gray-500 font-mono text-xs tracking-widest mb-4">● STATUS</div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${user.telegramConnected
              ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse'
              : 'bg-gray-600'}`} />
            <div>
              <p className="font-mono text-sm text-gray-200">
                {user.telegramConnected ? 'TELEGRAM LINKED' : 'NOT CONNECTED'}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-0.5">
                {user.telegramConnected
                  ? 'You are receiving personal alerts on your Telegram'
                  : 'Generate a link to connect your Telegram account'}
              </p>
            </div>
          </div>
        </div>

        {/* Connect Card */}
        <div className="bg-gray-900 border border-gray-800 p-6 mb-4">
          <div className="text-gray-500 font-mono text-xs tracking-widest mb-4">● CONNECT</div>

          {error && (
            <div className="bg-red-900/20 border-l-2 border-red-500 text-red-400 font-mono text-xs p-3 mb-4">
              {error.toUpperCase()}
            </div>
          )}

          {polling && (
            <div className="bg-blue-900/20 border-l-2 border-blue-400 text-blue-400 font-mono text-xs p-3 mb-4 animate-pulse">
              ⏳ WAITING FOR YOU TO OPEN LINK IN TELEGRAM...
            </div>
          )}

          {!link ? (
            <button onClick={generateLink} disabled={loading}
              className="w-full border border-blue-400 text-blue-400 font-mono text-xs tracking-widest py-3 hover:bg-blue-400/10 transition-colors disabled:opacity-40">
              {loading ? 'GENERATING...' : '⚡ GENERATE MY TELEGRAM LINK'}
            </button>
          ) : (
            <>
              <div className="bg-black border border-gray-800 p-3 mb-4 font-mono text-xs text-blue-400 break-all leading-relaxed">
                {link}
              </div>
              <div className="flex gap-3 mb-3">
                <button onClick={openInTelegram}
                  className="flex-1 border border-blue-400 text-blue-400 font-mono text-xs py-2.5 hover:bg-blue-400/10 transition-colors">
                  📱 OPEN IN TELEGRAM
                </button>
                <button onClick={copyLink}
                  className="flex-1 border border-green-400 text-green-400 font-mono text-xs py-2.5 hover:bg-green-400/10 transition-colors">
                  {copied ? '✅ COPIED' : '📋 COPY LINK'}
                </button>
              </div>
              <button onClick={generateLink} disabled={loading}
                className="w-full border border-gray-700 text-gray-500 font-mono text-xs py-2.5 hover:border-orange-400 hover:text-orange-400 transition-colors">
                🔄 REGENERATE LINK
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-gray-900 border border-gray-800 p-6">
          <div className="text-gray-500 font-mono text-xs tracking-widest mb-4">● HOW IT WORKS</div>
          {[
            ['01', 'Click Generate My Telegram Link above'],
            ['02', 'Click Open in Telegram or copy the link to your phone'],
            ['03', 'Press Start in the bot — your account links instantly'],
            ['04', 'Only YOUR alerts will appear in your Telegram — no one else\'s'],
          ].map(([num, text]) => (
            <div key={num} className="flex gap-4 mb-3 last:mb-0">
              <span className="font-mono text-xs text-blue-400 w-6 flex-shrink-0">{num}</span>
              <p className="font-mono text-xs text-gray-400">{text}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}