import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { MAIN_BACKEND_URL, SOCKET_URL, API_BASE_URL } from '../config'; // Added missing path and API_BASE_URL

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
      // Use MAIN_BACKEND_URL to ensure we hit the DB, not the AI service
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/alerts?limit=50`);
      const alertsData = response.data.alerts || [];
      setAlerts(alertsData);
      
      const unread = alertsData.filter((a: Alert) => !a.acknowledged).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      // Use API_BASE_URL (which should point to MAIN_BACKEND in config)
      await axios.post(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
        user: 'Current User',
        notes: notes
      });
      
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
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      console.log('✅ Alert socket connected');
    });

    newSocket.on('alert-triggered', (data: any) => {
      console.log('🚨 New alert received:', data);
      
      if (data.priority === 'critical') {
        playAlertSound();
      }
      
      // Handle the case where the socket data might be nested differently
      const newAlert = data.alert || data;
      setAlerts(prev => [newAlert, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      showBrowserNotification(newAlert);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

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

// Helper functions (Sound and Notifications)
function playAlertSound() {
  try {
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
  } catch (e) {
    console.warn("Audio context failed to start:", e);
  }
}

function showBrowserNotification(alert: Alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${getPriorityEmoji(alert.priority)} ${alert.ruleName}`, {
      body: alert.message,
      icon: '/favicon.ico'
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