interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'highlight' | 'danger';
}

function StatCard({ label, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'border-dark-border bg-dark-card/60',
    highlight: 'border-blue-500/20 bg-blue-500/5',
    danger: 'border-red-500/20 bg-red-500/5',
  };

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-white/30',
  };

  return (
    <div className={`rounded-xl border backdrop-blur-sm p-4 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {trend && (
          <span className={`text-xs font-medium ${trendColors[trend]} mb-0.5`}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
