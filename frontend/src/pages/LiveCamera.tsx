import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { io, Socket } from 'socket.io-client';

// Your existing hooks and components
import { useAlerts } from '../hooks/useAlerts';
import { useTelegram } from '../hooks/useTelegram';
import { AI_SERVICE_URL } from '../config';
import { Button, StatCard } from '../components/ui';

const LiveCamera = () => {
  // Hooks
  const { triggerAlert, playAlarmSound } = useAlert();
  const { sendTelegramNotification } = useTelegram();
  
  // Refs for logic
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<number>();
  
  // Throttling to prevent "Alert Spam" (Once per 10 seconds per object)
  const lastTriggered = useRef<{ [key: string]: number }>({});

  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState({ objects: 0, totalAlerts: 0 });

  // 1. DYNAMIC RULE CHECKER & NOTIFIER
  const executeSecurityProtocols = useCallback((predictions: cocoSsd.DetectedObject[]) => {
    const now = Date.now();

    predictions.forEach((prediction) => {
      const confidence = prediction.score;
      const objectName = prediction.class;

      // Only trigger if confidence > 65% and not triggered in last 10 seconds
      if (confidence > 0.65 && (now - (lastTriggered.current[objectName] || 0) > 10000)) {
        
        lastTriggered.current[objectName] = now;

        // A. UI ALERT (Your useAlert hook)
        triggerAlert(`Security Breach: ${objectName.toUpperCase()} detected!`, 'danger');
        playAlarmSound();

        // B. EXTERNAL NOTIFICATION (Your useTelegram hook)
        sendTelegramNotification(`⚠️ Sentry Alert: ${objectName} detected with ${Math.round(confidence * 100)}% confidence.`);

        // C. DATABASE / ANALYTICS LOGGING (Via Socket to Backend)
        socketRef.current?.emit('save-event', {
          type: 'DETECTION',
          label: objectName,
          confidence: confidence,
          timestamp: new Date().toISOString()
        });

        setStats(prev => ({ ...prev, totalAlerts: prev.totalAlerts + 1 }));
      }
    });
  }, [triggerAlert, playAlarmSound, sendTelegramNotification]);

  // 2. THE AI ENGINE LOOP
  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    // Fixed: Manual memory management for async TFJS
    tf.engine().startScope();
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 12, 0.5);
      
      // Canvas Drawing Logic
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = '#00FF41';
          ctx.fillText(`${p.class} ${Math.round(p.score * 100)}%`, x, y - 5);
        });
      }

      if (predictions.length > 0) {
        executeSecurityProtocols(predictions);
      }

      setStats(prev => ({ ...prev, objects: predictions.length }));
    } finally {
      tf.engine().endScope();
      requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, [isActive, executeSecurityProtocols]);

  // 3. LIFECYCLE & INITIALIZATION
  const startSystem = async () => {
    try {
      await tf.ready();
      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load(),
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      ]);

      modelRef.current = loadedModel;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      socketRef.current = io(AI_SERVICE_URL);
      setIsActive(true);
    } catch (err) {
      console.error("Critical System Failure", err);
    }
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, detectFrame]);

  return (
    <div className="p-6 bg-black min-h-screen text-[#00FF41] font-mono">
      <div className="flex justify-between items-center border-b border-[#00FF41]/30 pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-widest">SENTRY_OS_V5</h1>
        <Button onClick={isActive ? () => window.location.reload() : startSystem}>
          {isActive ? 'SHUTDOWN_REBOOT' : 'INITIALIZE_CORE'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative bg-[#050505] border border-[#00FF41]/10 overflow-hidden">
          <video ref={videoRef} autoPlay muted playsInline className="w-full opacity-40 grayscale" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>

        <div className="flex flex-col gap-4">
          <StatCard label="LIVE_TARGETS" value={stats.objects} />
          <StatCard label="ALERTS_SENT" value={stats.totalAlerts} />
          <div className="p-4 bg-white/5 border border-white/10 rounded text-[10px]">
            <p className="opacity-40 mb-2 underline">SYSTEM_LOGS</p>
            <p>&gt; TFJS_BACKEND: {tf.getBackend()}</p>
            <p>&gt; TELEGRAM_UPLINK: ACTIVE</p>
            <p>&gt; ANALYTICS_SYNC: CONNECTED</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;