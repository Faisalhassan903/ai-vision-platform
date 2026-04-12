import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Project Imports
import { Button, StatCard } from '../components/ui';
import { AI_SERVICE_URL } from '../config';
import { useAlerts } from '../hooks/useAlerts';
import { useTelegram } from '../hooks/useTelegram';

const OBJECT_CLASSES = ['person', 'bicycle', 'car', 'motorcycle', 'dog', 'cell phone', 'laptop'];

const LiveCamera = () => {
  // 1. Hooks & State
  const { triggerAlert, checkRulesAndTrigger, activeAlert } = useAlerts();
  const { sendTelegramNotification } = useTelegram();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<number>();

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('SYSTEM_OFFLINE');
  const [stats, setStats] = useState({ objects: 0, fps: 0 });

  // 2. THE DETECTION LOOP (Async-Safe)
  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    // Start manual memory scope to prevent "Promise inside tidy" errors
    tf.engine().startScope();

    try {
      const predictions = await modelRef.current.detect(videoRef.current, 10, 0.6);
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach((prediction) => {
          if (OBJECT_CLASSES.includes(prediction.class)) {
            const [x, y, w, h] = prediction.bbox;
            
            // Draw Bounding Boxes
            ctx.strokeStyle = '#00FF41';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            
            // Draw Label
            ctx.fillStyle = '#00FF41';
            ctx.font = 'bold 14px JetBrains Mono, monospace';
            ctx.fillText(
              `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`, 
              x, y > 15 ? y - 8 : 15
            );
          }
        });

        // 3. TRIGGER ALARMS & TELEGRAM (Via your hooks)
        if (predictions.length > 0) {
          // Check against your RuleBuilder logic inside useAlerts
          // This will trigger the audio and the toast
          checkRulesAndTrigger(predictions, []); // Pass your real rules array here
          
          // Emit to Analytics via Socket
          socketRef.current?.emit('save-analytics', {
            detections: predictions.map(p => ({ label: p.class, score: p.score })),
            timestamp: new Date().toISOString()
          });
        }
        
        setStats(prev => ({ ...prev, objects: predictions.length }));
      }
    } catch (err) {
      console.error("AI Core Error:", err);
    } finally {
      // Clean up tensors immediately to avoid memory bloat
      tf.engine().endScope();
      if (isActive) {
        requestRef.current = requestAnimationFrame(detectFrame);
      }
    }
  }, [isActive, checkRulesAndTrigger]);

  // 4. ENGINE INITIALIZATION
  const startEngine = async () => {
    try {
      setStatus('WARMING_UP...');
      await tf.ready();
      await tf.setBackend('webgl');

      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, frameRate: { ideal: 30 } } 
        })
      ]);

      modelRef.current = loadedModel;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          setIsActive(true);
          setStatus('CONNECTED');
        };
      }

      socketRef.current = io(AI_SERVICE_URL, { transports: ['websocket'] });

    } catch (err) {
      console.error("System Failure:", err);
      setStatus('HARDWARE_ERROR');
    }
  };

  // 5. CLEAN REBOOT (No 404s)
  const handleReboot = () => {
    setIsActive(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    
    setTimeout(() => startEngine(), 500);
  };

  useEffect(() => {
    if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isActive, detectFrame]);

  return (
    <div className="p-8 bg-black min-h-screen font-mono text-[#00FF41]">
      {/* Toast Alert from useAlerts */}
      {activeAlert && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 z-50 animate-bounce border-2 border-white">
          {activeAlert}
        </div>
      )}

      <div className="max-w-6xl mx-auto border border-[#00FF41]/30 p-6 bg-[#050505]">
        <div className="flex justify-between items-center mb-8 border-b border-[#00FF41]/10 pb-4">
          <div>
            <h1 className="text-2xl font-black">SENTRY_V5_LIVE</h1>
            <p className="text-[10px] opacity-50 tracking-widest">{status}</p>
          </div>
          <Button 
            onClick={isActive ? handleReboot : startEngine} 
            className="border-2 border-[#00FF41] px-6 py-2 hover:bg-[#00FF41] hover:text-black transition-all"
          >
            {isActive ? 'FORCE_REBOOT' : 'INITIALIZE_AI'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 relative bg-black border border-white/5">
            <video ref={videoRef} className="w-full h-auto opacity-50" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[10px] animate-pulse">AWAITING_UPLINK...</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <StatCard label="TRACKED_OBJECTS" value={stats.objects} />
            <div className="bg-white/5 border border-white/10 p-4 rounded text-[11px] space-y-2">
              <p className="text-white/40 uppercase border-b border-white/10 pb-1">System Diagnostics</p>
              <p>&gt; BACKEND: {tf.getBackend().toUpperCase()}</p>
              <p>&gt; SOCKET: {socketRef.current?.connected ? 'STABLE' : 'IDLE'}</p>
              <p>&gt; MEMORY: {Math.round(tf.memory().numBytes / 1024 / 1024)}MB</p>
              {stats.objects > 0 && <p className="text-red-500 animate-pulse">&gt; ALERT: ACTIVITY_DETECTED</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;