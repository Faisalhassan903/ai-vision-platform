import { useEffect } from 'react';
import { Badge } from './ui';

interface AlertToastProps {
  alert: {
    ruleName: string;
    priority: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  };
  onClose: () => void;
}

function AlertToast({ alert, onClose }: AlertToastProps) {
  
  useEffect(() => {
    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const priorityStyles = {
    critical: 'border-red-500 bg-red-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10',
    info: 'border-blue-500 bg-blue-500/10'
  };

  const priorityEmoji = {
    critical: '🔴',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div 
      className={`fixed top-4 right-4 z-50 w-96 p-4 rounded-lg border-2 ${priorityStyles[alert.priority]} backdrop-blur-sm animate-slide-in-right shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{priorityEmoji[alert.priority]}</div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-bold text-lg">{alert.ruleName}</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <p className="text-gray-300 mb-2">{alert.message}</p>
          
          <div className="flex items-center justify-between">
            <Badge variant={alert.priority === 'critical' ? 'error' : alert.priority === 'warning' ? 'warning' : 'info'}>
              {alert.priority.toUpperCase()}
            </Badge>
            <span className="text-xs text-gray-500">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertToast;


