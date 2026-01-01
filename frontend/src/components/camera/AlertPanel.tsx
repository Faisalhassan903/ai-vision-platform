// ===========================================
// ALERT PANEL COMPONENT
// ===========================================
// Shows active zone intrusion alerts

import React, { useEffect, useRef } from 'react';
import { useCameraStore } from '../../store';

const AlertPanel: React.FC = () => {
  const alerts = useCameraStore((state) => state.alerts);
  const acknowledgeAlert = useCameraStore((state) => state.acknowledgeAlert);
  const clearAlerts = useCameraStore((state) => state.clearAlerts);
  const alarmSound = useCameraStore((state) => state.alarmSound);

  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);

  // Get unacknowledged alerts
  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  // Play alarm sound when new alert arrives
  useEffect(() => {
    if (activeAlerts.length > 0 && alarmSound) {
      const latestAlert = activeAlerts[activeAlerts.length - 1];
      
      // Only play if this is a new alert
      if (latestAlert.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = latestAlert.id;
        playAlarmSound();
      }
    }
  }, [activeAlerts, alarmSound]);

  const playAlarmSound = () => {
    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;

      // Play 5 beeps
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.frequency.value = i % 2 === 0 ? 880 : 660;
          osc.type = 'square';
          
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }, i * 150);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          🚨 Zone Alerts
        </h3>
        <div className="text-center py-6">
          <p className="text-green-400 text-lg">✓ All Clear</p>
          <p className="text-slate-500 text-sm mt-1">No active alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-red-500/50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400">
          🚨 Zone Alerts
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
            {activeAlerts.length}
          </span>
        </h3>
        <button
          onClick={clearAlerts}
          className="text-xs text-slate-400 hover:text-white transition"
        >
          Dismiss All
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 bg-red-900/40 border border-red-500 rounded-lg animate-pulse"
          >
            <div>
              <p className="font-semibold text-red-300">
                ⚠️ {alert.detectionLabel.toUpperCase()} in {alert.zoneName}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(alert.timestamp).toLocaleTimeString()} • {(alert.confidence * 100).toFixed(0)}% confidence
              </p>
            </div>
            <button
              onClick={() => acknowledgeAlert(alert.id)}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertPanel;
