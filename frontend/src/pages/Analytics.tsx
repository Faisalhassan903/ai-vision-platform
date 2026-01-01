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

      const [statsRes, detectionsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/analytics/stats'),
        axios.get('http://localhost:5000/api/analytics/recent?limit=10')
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
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="danger">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            📊 Security Analytics Dashboard
          </h1>
          <Button onClick={fetchAnalytics} variant="primary">
            🔄 Refresh
          </Button>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="📈"
            value={stats?.total || 0}
            label="Total Detections"
          />
          <StatCard
            icon="🎯"
            value={stats?.today || 0}
            label="Today"
          />
          <StatCard
            icon="👤"
            value={stats?.byClass.find(c => c._id === 'person')?.count || 0}
            label="People Detected"
          />
          <StatCard
            icon="📹"
            value={stats?.byCamera.length || 0}
            label="Active Cameras"
          />
        </div>

        {/* Detections by Class */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            🏷️ Detections by Class
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats?.byClass.map((item) => (
              <Card key={item._id} className="text-center hover:border-primary-blue transition-colors">
                <div className="text-lg font-bold text-primary-blue capitalize mb-2">
                  {item._id}
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {item.count}
                </div>
                <div className="text-sm text-gray-400">
                  Avg: {(item.avgConfidence * 100).toFixed(1)}%
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Detections Table */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            🕐 Recent Detections
          </h2>
          <Table headers={['Time', 'Camera', 'Objects', 'Classes', 'Alert']}>
            {recentDetections.map((detection) => (
              <TableRow key={detection._id}>
                <TableCell>{formatTime(detection.timestamp)}</TableCell>
                <TableCell>{detection.cameraName}</TableCell>
                <TableCell>{detection.totalObjects}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {detection.detections.map((d, idx) => (
                      <Badge key={idx} variant="info">
                        {d.class}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {detection.alertSent ? (
                    <Badge variant="success">✅ Sent</Badge>
                  ) : (
                    <Badge variant="warning">⏸️ None</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </div>

        {/* Camera Stats */}
        {stats && stats.byCamera.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              📹 Detections by Camera
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.byCamera.map((camera) => (
                <Card key={camera._id} className="hover:border-primary-blue transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-lg font-bold text-white mb-1">
                        {camera.cameraName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {camera.count} detections
                      </div>
                    </div>
                    <div className="text-3xl">📹</div>
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