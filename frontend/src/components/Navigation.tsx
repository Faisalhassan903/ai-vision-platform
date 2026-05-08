import { Link, useLocation } from 'react-router-dom';
import { useAlerts } from '../hooks/useAlerts';

const Icons = {
  camera: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
      <rect x="2" y="7" width="13" height="10" rx="2"/>
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  monitor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  cameras: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="3"/>
      <path d="M5 7H3a2 2 0 00-2 2v9a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-3H9L7 7H5z"/>
    </svg>
  ),
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  telegram: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  logo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

function Navigation() {
  const location = useLocation();
  const { alerts } = useAlerts();

  const unreadCount = alerts.filter((a: any) => !a.acknowledged).length;
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/live',      label: 'Camera',     icon: Icons.camera   },
    { path: '/alerts',    label: 'Incidents',  icon: Icons.alert,  badge: unreadCount },
    { path: '/rules',     label: 'Rules',      icon: Icons.shield   },
    { path: '/analytics', label: 'Analytics',  icon: Icons.chart    },
    { path: '/monitor',   label: 'Monitor',    icon: Icons.monitor  },
    { path: '/cameras',   label: 'Cameras',    icon: Icons.cameras  },
    { path: '/grid',      label: 'Grid',       icon: Icons.grid     },
    { path: '/telegram',  label: 'Telegram',   icon: Icons.telegram },
  ];

  const mobileItems = [
    { path: '/live',      label: 'Camera',    icon: Icons.camera  },
    { path: '/alerts',    label: 'Incidents', icon: Icons.alert,  badge: unreadCount },
    { path: '/rules',     label: 'Rules',     icon: Icons.shield  },
    { path: '/analytics', label: 'Stats',     icon: Icons.chart   },
    { path: '/cameras',   label: 'Cameras',   icon: Icons.cameras },
  ];

  return (
    <>
      {/* DESKTOP NAV */}
      <nav className="hidden md:block bg-[#060a13]/95 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link to="/live" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:border-red-500/50 group-hover:shadow-glow-red transition-all duration-300">
                {Icons.logo}
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-tight text-white leading-none">SENTRY AI</p>
                <p className="text-[9px] text-white/20 font-mono leading-none mt-0.5">v4.0 &middot; ACTIVE</p>
              </div>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-white/[0.08] text-white shadow-sm'
                      : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`transition-colors duration-200 ${isActive(item.path) ? 'text-white' : 'text-white/40'}`}>
                    {item.icon}
                  </span>
                  <span className="hidden lg:block">{item.label}</span>

                  {/* Active indicator line */}
                  {isActive(item.path) && (
                    <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-red-500/80" />
                  )}

                  {/* Badge */}
                  {(item as any).badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 shadow-lg shadow-red-500/30 animate-pulse-glow">
                      {(item as any).badge > 9 ? '9+' : (item as any).badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-white/25 font-mono">ONLINE</span>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden flex items-center justify-between px-4 h-12 bg-[#060a13]/95 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-50">
        <Link to="/live" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400">
            {Icons.logo}
          </div>
          <span className="text-xs font-bold text-white tracking-tight">SENTRY AI</span>
        </Link>

        {unreadCount > 0 && (
          <Link to="/alerts" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {unreadCount} alert{unreadCount !== 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060a13]/95 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex items-stretch h-16">
          {mobileItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive(item.path) ? 'text-white' : 'text-white/25 active:text-white/60'
              }`}
            >
              {isActive(item.path) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-red-500" />
              )}
              <span className={isActive(item.path) ? 'text-white' : 'text-white/30'}>
                {item.icon}
              </span>
              <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
              {(item as any).badge > 0 && (
                <span className="absolute top-2 right-[calc(50%-14px)] min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white px-1">
                  {(item as any).badge > 9 ? '9+' : (item as any).badge}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="h-safe-area-inset-bottom bg-[#060a13]" />
      </nav>

      <div className="md:hidden h-16" />
    </>
  );
}

export default Navigation;
