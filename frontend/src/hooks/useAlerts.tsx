import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { MAIN_BACKEND_URL, SOCKET_URL }

interface Alert {
  _id: string;
  ruleName: string;
  priority: 'info' | 'warning' | 'critical';
  message: string;
  cameraName: string;
  timestamp: string;
  acknowledged: boolean;
  detections: Array<{
    class: string;
    confidence: number;
  }>;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      // Updated to use API_BASE_URL
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/alerts?limit=50`);
      setAlerts(response.data.alerts);
      
      const unread = response.data.alerts.filter((a: Alert) => !a.acknowledged).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      // Updated to use API_BASE_URL
      await axios.post(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
        user: 'Current User',
        notes: notes
      });
      
      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert._id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }, []);

  // Connect to Socket.io for real-time alerts
  useEffect(() => {
    // Updated to use SOCKET_URL
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      console.log('✅ Alert socket connected');
    });

    newSocket.on('alert-triggered', (data: any) => {
      console.log('🚨 New alert received:', data);
      
      if (data.priority === 'critical') {
        playAlertSound();
      }
      
      setAlerts(prev => [data.alert, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      showBrowserNotification(data.alert);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    unreadCount,
    acknowledgeAlert,
    refreshAlerts: fetchAlerts
  };
}

// Play alert sound
function playAlertSound() {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

// Show browser notification
function showBrowserNotification(alert: Alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${getPriorityEmoji(alert.priority)} ${alert.ruleName}`, {
      body: alert.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });
  }
}

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case 'critical': return '🔴';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📌';
  }
}