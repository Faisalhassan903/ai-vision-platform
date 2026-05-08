import { useState } from 'react';
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
      case 'critical': return <Badge variant="error" dot pulse size="sm">CRITICAL</Badge>;
      case 'warning': return <Badge variant="warning" dot size="sm">WARNING</Badge>;
      case 'info': return <Badge variant="info" dot size="sm">INFO</Badge>;
      default: return <Badge variant="info" size="sm">{priority}</Badge>;
    }
  };

  const filterCounts = {
    all: alerts.length,
    unread: unreadCount,
    critical: alerts.filter(a => a.priority === 'critical').length,
    warning: alerts.filter(a => a.priority === 'warning').length,
    info: alerts.filter(a => a.priority === 'info').length,
  };

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Alert Center</h1>
                <p className="text-sm text-white/40">
                  {unreadCount > 0 
                    ? <span className="text-red-400 font-medium">{unreadCount} unread</span>
                    : 'All clear'
                  }
                  {' '}&middot; {alerts.length} total
                </p>
              </div>
            </div>
          </div>
          
          <Button onClick={refreshAlerts} variant="secondary" size="sm" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          }>
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 p-1 bg-dark-card/50 rounded-lg border border-dark-border w-fit">
          {(['all', 'unread', 'critical', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                filter === f
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {filterCounts[f] > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  filter === f ? 'bg-white/15' : 'bg-white/5'
                } ${f === 'critical' && filterCounts[f] > 0 ? 'text-red-400' : ''}`}>
                  {filterCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Alerts Table */}
        {filteredAlerts.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-white/60 text-sm font-medium">No alerts match this filter</p>
            <p className="text-white/25 text-xs mt-1">System is operating normally</p>
          </Card>
        ) : (
          <Table headers={['Time', 'Rule', 'Camera', 'Objects', 'Priority', 'Status', 'Actions']}>
            {filteredAlerts.map((alert) => (
              <TableRow key={alert._id} highlight={alert.priority === 'critical' && !alert.acknowledged}>
                <TableCell>
                  <span className="text-white/50 font-mono text-xs">
                    {new Date(alert.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </TableCell>
                
                <TableCell>
                  <span className="font-medium text-white">{alert.ruleName}</span>
                </TableCell>
                
                <TableCell>
                  <span className="text-white/50">{alert.cameraName}</span>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {alert.detections.slice(0, 3).map((det: any, idx: number) => (
                      <Badge key={idx} variant="info" size="sm">
                        {det.class}
                      </Badge>
                    ))}
                    {alert.detections.length > 3 && (
                      <Badge variant="neutral" size="sm">+{alert.detections.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  {getPriorityBadge(alert.priority)}
                </TableCell>
                
                <TableCell>
                  {alert.acknowledged ? (
                    <Badge variant="success" size="sm">Resolved</Badge>
                  ) : (
                    <Badge variant="warning" dot pulse size="sm">Pending</Badge>
                  )}
                </TableCell>
                
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="text-blue-400/80 hover:text-blue-300 text-xs font-medium transition-colors"
                    >
                      Details
                    </button>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert._id)}
                        className="text-emerald-400/80 hover:text-emerald-300 text-xs font-medium transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}

        {/* Alert Detail Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in">
            <div className="bg-dark-card border border-dark-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selectedAlert.priority === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                      selectedAlert.priority === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                      'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={
                        selectedAlert.priority === 'critical' ? 'text-red-400' :
                        selectedAlert.priority === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      }>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Alert Details</h2>
                      <p className="text-xs text-white/30">{selectedAlert.ruleName}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAlert(null)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-surface/50 border border-dark-border">
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-white font-medium">{selectedAlert.message}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-surface/30 border border-dark-border">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Priority</p>
                      <div className="mt-1">{getPriorityBadge(selectedAlert.priority)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface/30 border border-dark-border">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Camera</p>
                      <p className="text-sm text-white font-medium">{selectedAlert.cameraName}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface/30 border border-dark-border">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Time</p>
                      <p className="text-sm text-white font-medium font-mono">
                        {new Date(selectedAlert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Detections</p>
                    <div className="space-y-2">
                      {selectedAlert.detections.map((det: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-surface/30 border border-dark-border">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-sm text-white capitalize font-medium">{det.class}</span>
                          </div>
                          <Badge variant="success" size="sm">{(det.confidence * 100).toFixed(0)}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {!selectedAlert.acknowledged && (
                      <Button 
                        onClick={() => handleAcknowledge(selectedAlert._id)}
                        variant="primary"
                        className="flex-1"
                      >
                        Resolve Alert
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
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AlertCenter;
