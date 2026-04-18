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

  // ── FETCH ALERTS FROM DB ────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      // FIXED: was /api/rules — must be /api/alerts
      const response = await axios.get(`${API_BASE_URL}/api/alerts`);
      const alertsData = response.data.alerts || [];
      setAlerts(alertsData);
      setUnreadCount(alertsData.filter((a: Alert) => !a.acknowledged).length);
    } catch (error) {
      console.error('Fetch alerts failed:', error);
    }
  }, []);

  // ── ACKNOWLEDGE ─────────────────────────────────────────────────────────────
  const acknowledgeAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
        user: 'System Admin',
        notes,
      });
      setAlerts(prev =>
        prev.map(alert =>
          alert._id === alertId ? { ...alert, acknowledged: true } : alert
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Acknowledge failed:', error);
    }
  }, []);

  // ── TRIGGER FROM CAMERA (kept for compatibility) ────────────────────────────
  const triggerNewAlert = useCallback(async (alertData: Partial<Alert>) => {
    try {
      await axios.post(`${API_BASE_URL}/api/alerts`, alertData);
    } catch (error: any) {
      console.error('❌ Trigger Failed:', error.response?.status, error.message);
      throw error;
    }
  }, []);

  // ── SOCKET — real-time new incidents ───────────────────────────────────────
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => console.log('📡 Socket: Secure Link Established'));

    newSocket.on('new-incident', (data: any) => {
      const newAlert = data.alert || data;
      console.log('🚨 New Incident Received:', newAlert.ruleName);

      const now = Date.now();
      if (now - lastAlarmTime.current > 5000) {
        if (newAlert.priority === 'critical') playAlertSound();
        showBrowserNotification(newAlert);
        lastAlarmTime.current = now;
      }

      // Prepend to list — newest first
      setAlerts(prev => [newAlert, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, []);

  // Fetch on mount
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return {
    alerts,
    unreadCount,
    acknowledgeAlert,
    triggerNewAlert,
    refreshAlerts: fetchAlerts,
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function playAlertSound() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch { /* blocked */ }
}

function showBrowserNotification(alert: any) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`🚨 ${alert.priority?.toUpperCase()}: ${alert.ruleName}`, {
      body: alert.message,
    });
  }
}