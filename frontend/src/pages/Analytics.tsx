import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Card, 
  Table, 
  TableRow, 
  TableCell, 
  Button, 
  Badge,
  LoadingSpinner 
} from '../components/ui';
import { MAIN_BACKEND_URL } from '../config'; 

interface Detection {
  _id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: any;
  }>;
  totalObjects: number;
  alertSent: boolean;
}

interface Stats {
  total: number;
  today: number;
  byClass: Array<{
    _id: string;
    count: number;
    avgConfidence: number;
  }>;
  byCamera: Array<{
    _id: string;
    cameraName: string;
    count: number;
  }>;
}

function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDetections, setRecentDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, detectionsRes] = await Promise.all([
        axios.get(`${MAIN_BACKEND_URL}/api/analytics/stats`),
        axios.get(`${MAIN_BACKEND_URL}/api/analytics/recent?limit=10`)
      ]);
      setStats(statsRes.data.stats);
      setRecentDetections(detectionsRes.data.detections);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Connection Issue</h2>
          <p className="text-white/40 text-sm mb-6">Could not retrieve analytics from the server.</p>
          <Button onClick={fetchAnalytics} variant="primary" className="w-full">Retry</Button>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Events', value: stats?.total || 0, icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )},
    { label: 'Detected Today', value: stats?.today || 0, icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    )},
    { label: 'Total Personnel', value: stats?.byClass.find(c => c._id === 'person')?.count || 0, icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    )},
    { label: 'Active Nodes', value: stats?.byCamera.length || 0, icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
        <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
        <rect x="2" y="7" width="13" height="10" rx="2"/>
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-dark-bg p-6 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-white/40">Detection intelligence overview</p>
            </div>
          </div>
          <Button onClick={fetchAnalytics} variant="secondary" size="sm" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          }>
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-dark-border bg-dark-card/60 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{stat.label}</p>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Object Distribution */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-semibold text-white/70">Object Distribution</p>
            <span className="h-px flex-1 bg-dark-border" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats?.byClass.map((item) => {
              const maxCount = Math.max(...(stats?.byClass.map(c => c.count) || [1]));
              const percentage = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item._id} className="rounded-xl border border-dark-border bg-dark-card/40 p-4 hover:border-dark-border-hover transition-colors">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 mb-2">
                    {item._id}
                  </p>
                  <p className="text-xl font-bold text-white mb-2">{item.count}</p>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500/60 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/25 mt-2 font-mono">
                    {(item.avgConfidence * 100).toFixed(0)}% avg conf
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Log */}
        {recentDetections.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm font-semibold text-white/70">Activity Log</p>
              <span className="h-px flex-1 bg-dark-border" />
            </div>
            <Table headers={['Timestamp', 'Source', 'Count', 'Classes', 'Status']}>
              {recentDetections.map((detection) => (
                <TableRow key={detection._id}>
                  <TableCell>
                    <span className="font-mono text-xs text-white/40">{formatTime(detection.timestamp)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-white/80">{detection.cameraName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-white/60">{detection.totalObjects}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {detection.detections.map((d, idx) => (
                        <Badge key={idx} variant="info" size="sm">{d.class}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {detection.alertSent ? (
                      <Badge variant="success" size="sm" dot>Dispatched</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Logged</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}

        {/* Camera/Node Stats */}
        {stats && stats.byCamera.length > 0 && (
          <div className="pb-8">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm font-semibold text-white/70">Node Performance</p>
              <span className="h-px flex-1 bg-dark-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.byCamera.map((camera) => (
                <div key={camera._id} className="rounded-xl border border-dark-border bg-dark-card/40 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{camera.cameraName}</p>
                    <p className="text-xs text-white/30 font-mono">{camera.count} captures</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Analytics;
