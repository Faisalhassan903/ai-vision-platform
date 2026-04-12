import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { MAIN_BACKEND_URL, SOCKET_URL, API_BASE_URL } from '../config';

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
  const lastAlarmTime = useRef<number>(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/alerts?limit=50`);
      const alertsData = response.data.alerts || response.data || [];
      setAlerts(alertsData);
      setUnreadCount(alertsData.filter((a: Alert) => !a.acknowledged).length);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
        user: 'System Admin',
        notes: notes
      });
      setAlerts(prev => prev.map(alert => 
        alert._id === alertId ? { ...alert, acknowledged: true } : alert
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }, []);

  // Use this to send a new alert from the Camera to the Backend
  const triggerNewAlert = useCallback(async (alertData: Partial<Alert>) => {
    try {
      await axios.post(`${API_BASE_URL}/api/alerts`, alertData);
    } catch (error) {
      console.error('Error triggering new alert:', error);
    }
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => console.log('✅ Alert socket connected'));

    newSocket.on('alert-triggered', (data: any) => {
      const newAlert = data.alert || data;
      
      // Throttle sound/notification so it doesn't spam
      const now = Date.now();
      if (now - lastAlarmTime.current > 5000) {
        if (newAlert.priority === 'critical') playAlertSound();
        showBrowserNotification(newAlert);
        lastAlarmTime.current = now;
      }

      setAlerts(prev => [newAlert, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return {
    alerts,
    unreadCount,
    acknowledgeAlert,
    triggerNewAlert,
    refreshAlerts: fetchAlerts
  };
}

// Internal Helpers
function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) { console.warn("Audio blocked", e); }
}

function showBrowserNotification(alert: Alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`🚨 ${alert.priority.toUpperCase()}: ${alert.ruleName}`, {
      body: alert.message
    });
  }
}