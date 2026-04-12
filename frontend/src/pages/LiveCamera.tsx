import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

import { Button, StatCard } from '../components/ui';
import { AI_SERVICE_URL } from '../config';
import { useAlerts } from '../hooks/useAlerts';
import { useTelegram } from '../hooks/useTelegram';

const LiveCamera = () => {
  const { triggerAlert, checkRulesAndTrigger, activeAlert } = useAlerts();
  const { sendTelegramNotification } = useTelegram();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<number>();

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('OFFLINE');
  const [stats, setStats] = useState({ objects: 0, mem: 0 });

  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    tf.engine().startScope();

    try {
      const predictions = await modelRef.current.detect(videoRef.current, 10, 0.5);
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach((prediction) => {
          // THE FIX: Check if prediction and class exist before calling toUpperCase()
          const label = prediction?.class;
          if (!label) return; 

          const [x, y, w, h] = prediction.bbox;
          
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          
          ctx.fillStyle = '#00FF41';
          ctx.font = 'bold 14px monospace';
          // Use optional chaining and fallback string
          ctx.fillText(
            `${(label || 'UNKNOWN').toUpperCase()} ${Math.round(prediction.score * 100)}%`, 
            x, y > 15 ? y - 8 : 15
          );
        });

        if (predictions.length > 0) {
          checkRulesAndTrigger(predictions, []); 
          socketRef.current?.emit('save-analytics', {
            events: predictions.map(p => ({ label: p.class, score: p.score })),
            time: new Date().toISOString()
          });
        }
        
        setStats({ 
          objects: predictions.length, 
          mem: Math.round(tf.memory().numBytes / 1024 / 1024) 
        });
      }
    } catch (err) {
      console.error("Inference Error:", err);
    } finally {
      tf.engine().endScope();
      if (isActive) {
        requestRef.current = requestAnimationFrame(detectFrame);
      }
    }
  }, [isActive, checkRulesAndTrigger]);

  const startEngine = async () => {
    try {
      setStatus('CONNECTING...');
      await tf.ready();
      await tf.setBackend('webgl');

      const [m, s] = await Promise.all([
        cocoSsd.load(),
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      ]);

      modelRef.current = m;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          setIsActive(true);
          setStatus('ONLINE');
        };
      }
      socketRef.current = io(AI_SERVICE_URL);
    } catch (e) {
      setStatus('FAILED');
    }
  };

  const handleReboot = () => {
    setIsActive(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    const s = videoRef.current?.srcObject as MediaStream;
    s?.getTracks().forEach(t => t.stop());
    setTimeout(startEngine, 300);
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, detectFrame]);

  return (
    <div className="p-8 bg-black min-h-screen text-[#00FF41] font-mono">
      {activeAlert && (
        <div className="fixed top-5 right-5 bg-red-600 p-4 border-2 border-white z-50">
          {activeAlert}
        </div>
      )}
      <div className="max-w-4xl mx-auto border border-[#00FF41]/20 p-4">
        <div className="flex justify-between mb-4">
          <h2>SENTRY_V5 // {status}</h2>
          <Button onClick={isActive ? handleReboot : startEngine}>
            {isActive ? 'REBOOT' : 'START'}
          </Button>
        </div>
        <div className="relative aspect-video bg-zinc-900">
          <video ref={videoRef} className="w-full h-full opacity-40" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <StatCard label="OBJECTS" value={stats.objects} />
          <StatCard label="RAM_USAGE" value={`${stats.mem}MB`} />
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;