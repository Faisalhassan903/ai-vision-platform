import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL, SOCKET_URL } from '../config';

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

  // --- 1. CONSOLIDATED FETCH ---
  const fetchAlerts = useCallback(async () => {
    try {
      // Use API_BASE_URL consistently
      const response = await axios.get(`${API_BASE_URL}/api/alerts?limit=50`);
      const alertsData = response.data.alerts || [];
      setAlerts(alertsData);
      setUnreadCount(alertsData.filter((a: Alert) => !a.acknowledged).length);
    } catch (error) {
      console.error('Fetch Failed:', error);
    }
  }, []);

  // --- 2. UPDATED VERB (PATCH) ---
  const acknowledgeAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
        user: 'System Admin',
        notes: notes
      });
      setAlerts(prev => prev.map(alert => 
        alert._id === alertId ? { ...alert, acknowledged: true } : alert
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Acknowledge Failed:', error);
    }
  }, []);

  // --- 3. TRIGGER FROM CAMERA ---
  const triggerNewAlert = useCallback(async (alertData: Partial<Alert>) => {
    try {
      // Ensure the endpoint matches exactly: /api/alerts
      await axios.post(`${API_BASE_URL}/api/alerts`, alertData);
    } catch (error: any) {
      console.error('❌ Trigger Failed:', error.response?.status, error.message);
      throw error; // Re-throw so LiveCamera can log it
    }
  }, []);

  useEffect(() => {
    // Force websocket transport to stop the "Polling" spam in your logs
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false
    });
    
    newSocket.on('connect', () => console.log('📡 Socket: Secure Link Established'));

    // --- 4. SYNC WITH SERVER.TS ---
    newSocket.on('new-incident', (data: any) => {
      const newAlert = data.alert || data;
      console.log('🚨 New Incident Received:', newAlert.ruleName);
      
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

  return { alerts, unreadCount, acknowledgeAlert, triggerNewAlert, refreshAlerts: fetchAlerts };
}

// Helpers (Audio/Notification)
function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Lower volume
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) { /* Browser blocked audio */ }
}

function showBrowserNotification(alert: any) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`🚨 ${alert.priority?.toUpperCase()}: ${alert.ruleName}`, {
      body: alert.message
    });
  }
}