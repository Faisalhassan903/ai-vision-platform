import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useAlerts } from '../hooks/useAlerts';
import { Button, StatCard } from './ui';

const LiveCamera = () => {
  const { triggerNewAlert } = useAlerts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const requestRef = useRef<number>();
  const lastIncidentTime = useRef<number>(0);

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('OFFLINE');

  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    tf.engine().startScope();
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 10, 0.6);
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = '#00FF41';
          ctx.fillText(`${p.class.toUpperCase()}`, x, y > 10 ? y - 5 : 10);
        });

        // RULE ENGINE: If a person is found and 10 seconds have passed since last save
        const personMatch = predictions.find(p => p.class === 'person' && p.score > 0.7);
        const now = Date.now();

        if (personMatch && (now - lastIncidentTime.current > 10000)) {
          lastIncidentTime.current = now;
          
          // PUSH TO ALERT CENTER (Via Hook)
          triggerNewAlert({
            ruleName: "Intrusion Detection",
            priority: 'critical',
            message: "Human presence detected in restricted area.",
            cameraName: "Front Camera 01",
            timestamp: new Date().toISOString(),
            detections: predictions.map(p => ({ class: p.class, confidence: p.score }))
          });
        }
      }
    } finally {
      tf.engine().endScope();
      if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, [isActive, triggerNewAlert]);

  const startEngine = async () => {
    setStatus('INITIALIZING...');
    try {
      await tf.ready();
      const [m, s] = await Promise.all([
        cocoSsd.load(),
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      ]);
      modelRef.current = m;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsActive(true);
          setStatus('LIVE');
        };
      }
    } catch (e) { setStatus('ERROR'); }
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, detectFrame]);

  return (
    <div className="p-4 bg-black border border-[#00FF41]/20 rounded">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[#00FF41] font-mono">CORE_CAM // {status}</h2>
        <Button onClick={isActive ? () => window.location.reload() : startEngine}>
          {isActive ? 'REBOOT' : 'START SYSTEM'}
        </Button>
      </div>
      <div className="relative bg-zinc-900 aspect-video rounded overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover opacity-60" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default LiveCamera;