import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

import { Button } from '../components/ui'; 
import { useAlerts } from '../hooks/useAlerts';

const LiveCamera = () => {
  const { triggerNewAlert } = useAlerts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const requestRef = useRef<number>();
  
  // NEW: Cooldown prevents sending 60 alerts per second
  const lastAlertTimeRef = useRef<number>(0);
  const ALERT_COOLDOWN = 5000; // 5 seconds between alerts

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('OFFLINE');

  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    tf.engine().startScope();
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 10, 0.6);
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx && canvasRef.current) {
        // Sync canvas size to video size
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
        });

        // Trigger logic
        const person = predictions.find(p => p.class === 'person' && p.score > 0.7);
        const now = Date.now();

        // FIX: Only trigger if the cooldown has passed
        if (person && (now - lastAlertTimeRef.current > ALERT_COOLDOWN)) {
          lastAlertTimeRef.current = now; // Update the cooldown timestamp
          
          triggerNewAlert({
            ruleName: "Motion Detection",
            priority: 'critical',
            message: "Person detected",
            timestamp: new Date().toISOString(),
            detections: [{ class: 'person', confidence: person.score }]
          }).catch(err => console.error("Alert failed to send:", err));
        }
      }
    } finally {
      tf.engine().endScope();
      if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, [isActive, triggerNewAlert]);

  const startEngine = async () => {
    try {
      setStatus('LOADING_MODELS...');
      await tf.ready();
      const [m, s] = await Promise.all([
        cocoSsd.load(),
        navigator.mediaDevices.getUserMedia({ video: true })
      ]);
      modelRef.current = m;
      if (videoRef.current) videoRef.current.srcObject = s;
      setIsActive(true);
      setStatus('LIVE');
    } catch (e) {
      console.error(e);
      setStatus('CAM_ERROR');
    }
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, detectFrame]);

  return (
    <div className="p-4 bg-black min-h-screen text-[#00FF41] font-mono">
      <div className="flex justify-between mb-4 items-center">
        <h2 className="text-xl">SENTRY_CORE // <span className={status === 'LIVE' ? 'animate-pulse' : ''}>{status}</span></h2>
        <Button onClick={startEngine} disabled={isActive}>
          {isActive ? 'SYSTEM_ACTIVE' : 'INITIALIZE'}
        </Button>
      </div>
      <div className="relative aspect-video border border-[#00FF41]/20 rounded-lg overflow-hidden bg-zinc-900">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover opacity-60" 
          autoPlay 
          muted 
          playsInline 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full pointer-events-none" 
        />
      </div>
    </div>
  );
};

export default LiveCamera;