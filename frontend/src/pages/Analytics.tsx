import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Card, 
  StatCard, 
  Table, 
  TableRow, 
  TableCell, 
  Button, 
  Badge,
  LoadingSpinner 
} from '../components/ui';
// 1. IMPORT MAIN_BACKEND_URL INSTEAD OF API_BASE_URL
import { MAIN_BACKEND_URL } from '../config'; 

// TypeScript interfaces
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
  // STATE
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDetections, setRecentDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FETCH DATA ON MOUNT
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // 2. USE MAIN_BACKEND_URL FOR DATABASE QUERIES
      // This stops the 404 error because it hits the server with the database
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

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md text-center border-red-900 bg-slate-900">
          <div className="text-6xl mb-4">📡</div>
          <h2 className="text-2xl font-bold text-white mb-2">Connection Issue</h2>
          <p className="text-gray-400 mb-6">
            Could not retrieve analytics from the primary security server.
          </p>
          <Button onClick={fetchAnalytics} variant="danger" className="w-full">
            Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">📊 Security Analytics</h1>
            <p className="text-gray-400">Real-time data from your detection nodes</p>
          </div>
          <Button onClick={fetchAnalytics} variant="primary" className="bg-blue-600 hover:bg-blue-700">
            🔄 Refresh Data
          </Button>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="📈"
            value={stats?.total || 0}
            label="Total Events"
          />
          <StatCard
            icon="🎯"
            value={stats?.today || 0}
            label="Detected Today"
          />
          <StatCard
            icon="👤"
            value={stats?.byClass.find(c => c._id === 'person')?.count || 0}
            label="Total Personnel"
          />
          <StatCard
            icon="📹"
            value={stats?.byCamera.length || 0}
            label="Online Nodes"
          />
        </div>

        {/* Detections by Class */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-blue-500">🏷️</span> Object Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats?.byClass.map((item) => (
              <Card key={item._id} className="text-center bg-slate-900 border-slate-800 hover:border-blue-500 transition-all">
                <div className="text-xs uppercase tracking-widest font-bold text-blue-400 mb-2">
                  {item._id}
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {item.count}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  CONF: {(item.avgConfidence * 100).toFixed(0)}%
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Detections Table */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-blue-500">🕐</span> Activity Log
          </h2>
          <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            <Table headers={['Timestamp', 'Source Node', 'Count', 'Detected Classes', 'Status']}>
              {recentDetections.map((detection) => (
                <TableRow key={detection._id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <TableCell className="font-mono text-xs text-gray-400">{formatTime(detection.timestamp)}</TableCell>
                  <TableCell className="font-semibold">{detection.cameraName}</TableCell>
                  <TableCell>{detection.totalObjects}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {detection.detections.map((d, idx) => (
                        <Badge key={idx} className="bg-slate-800 text-blue-300 border-none text-[10px]">
                          {d.class}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {detection.alertSent ? (
                      <Badge className="bg-emerald-900/30 text-emerald-400 border border-emerald-800">Alert Dispatched</Badge>
                    ) : (
                      <Badge className="bg-slate-800 text-gray-500 border border-slate-700">Logged</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        </div>

        {/* Camera Stats */}
        {stats && stats.byCamera.length > 0 && (
          <div className="pb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-blue-500">📹</span> Node Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.byCamera.map((camera) => (
                <Card key={camera._id} className="bg-slate-900 border-slate-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-lg font-bold text-white mb-1">
                        {camera.cameraName}
                      </div>
                      <div className="text-sm text-blue-500 font-mono">
                        {camera.count} total captures
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-full text-xl">📡</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Analytics;