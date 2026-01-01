import { useState, useEffect } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { Card, Button, Badge, Table, TableRow, TableCell } from '../components/ui';

function AlertCenter() {
  const { alerts, unreadCount, acknowledgeAlert, refreshAlerts } = useAlerts();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'unread'>('all');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !alert.acknowledged;
    return alert.priority === filter;
  });

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId);
    setSelectedAlert(null);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <Badge variant="error">🔴 CRITICAL</Badge>;
      case 'warning': return <Badge variant="warning">⚠️ WARNING</Badge>;
      case 'info': return <Badge variant="info">ℹ️ INFO</Badge>;
      default: return <Badge variant="info">{priority}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🚨 Alert Center
            </h1>
            <p className="text-gray-400">
              {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Button onClick={refreshAlerts} variant="primary">
            🔄 Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          {['all', 'unread', 'critical', 'warning', 'info'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-blue text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white hover:bg-dark-border'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Alerts Table */}
        <Card>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-400 text-lg">No alerts to display</p>
            </div>
          ) : (
            <Table headers={['Time', 'Rule', 'Camera', 'Objects', 'Priority', 'Status', 'Actions']}>
              {filteredAlerts.map((alert) => (
                <TableRow key={alert._id}>
                  <TableCell>
                    {new Date(alert.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  
                  <TableCell>
                    <span className="font-medium text-white">{alert.ruleName}</span>
                  </TableCell>
                  
                  <TableCell>{alert.cameraName}</TableCell>
                  
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {alert.detections.slice(0, 3).map((det, idx) => (
                        <Badge key={idx} variant="info">
                          {det.class}
                        </Badge>
                      ))}
                      {alert.detections.length > 3 && (
                        <Badge variant="info">+{alert.detections.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getPriorityBadge(alert.priority)}
                  </TableCell>
                  
                  <TableCell>
                    {alert.acknowledged ? (
                      <Badge variant="success">✅ Acknowledged</Badge>
                    ) : (
                      <Badge variant="warning">⏸️ Pending</Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View
                      </button>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert._id)}
                          className="text-green-400 hover:text-green-300 text-sm font-medium"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>

        {/* Alert Detail Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">Alert Details</h2>
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Rule Name</label>
                  <p className="text-white font-medium">{selectedAlert.ruleName}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Message</label>
                  <p className="text-white">{selectedAlert.message}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Priority</label>
                    <div className="mt-1">{getPriorityBadge(selectedAlert.priority)}</div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400">Camera</label>
                    <p className="text-white">{selectedAlert.cameraName}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Detections</label>
                  <div className="mt-2 space-y-2">
                    {selectedAlert.detections.map((det: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-dark-bg p-2 rounded">
                        <span className="text-white capitalize">{det.class}</span>
                        <Badge variant="success">{(det.confidence * 100).toFixed(1)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAlert.snapshot && (
                  <div>
                    <label className="text-sm text-gray-400">Snapshot</label>
                    <img 
                      src={selectedAlert.snapshot} 
                      alt="Alert snapshot"
                      className="mt-2 w-full rounded-lg border border-dark-border"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  {!selectedAlert.acknowledged && (
                    <Button 
                      onClick={() => handleAcknowledge(selectedAlert._id)}
                      variant="primary"
                      className="flex-1"
                    >
                      ✅ Acknowledge Alert
                    </Button>
                  )}
                  <Button 
                    onClick={() => setSelectedAlert(null)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

export default AlertCenter;