import { Link, useLocation } from 'react-router-dom';
import { useAlerts } from '../hooks/useAlerts'; // Hook we built earlier

function Navigation() {
  const location = useLocation();
  const { alerts } = useAlerts();
  
  // Check if there are unread/new alerts to show a red dot
  const hasNewAlerts = alerts.some(a => a.status === 'new');

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/live', label: 'Camera', icon: '📹' },
    { path: '/alerts', label: 'Incidents', icon: '🚨', badge: hasNewAlerts },
    { path: '/rules', label: 'Security Rules', icon: '🛡️' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/monitor', label:'CameraMonitoring' ,icon:'📹'},
    

    
    
  ];

  return (
    <nav className="bg-[#0a0a0c] border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="text-2xl bg-blue-600/20 p-2 rounded-lg">🛡️</div>
            <div>
              <div className="text-sm font-black text-white tracking-tighter uppercase">Sentry_AI</div>
              <div className="text-[10px] text-zinc-500 font-mono">CORE_V1.0_ACTIVE</div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span className="mr-2 text-base">{item.icon}</span>
                {item.label}

                {/* Live Alert Notification Dot */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                  </span>
                )}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </nav>
  );
}

export default Navigation;