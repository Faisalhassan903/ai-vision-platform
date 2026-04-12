import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm'; // High-performance fallback
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

// Constants for tuning
const DETECTION_INTERVAL = 4; // Run AI every 4th frame
const ALERT_THRESHOLD = 0.75;
const COOLDOWN_MS = 10000; 

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();
  
  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logic Refs
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef = useRef<number>();
  const lastAlertRef = useRef<number>(0);
  const frameCounter = useRef<number>(0);

  // State
  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState({ fps: 0, backend: '' });

  /**
   * Main Inference Loop
   */
  const runDetection = useCallback(async () => {
    if (!isLive || !videoRef.current || !modelRef.current) return;

    // Optimization: Skip frames to save GPU/CPU energy
    frameCounter.current++;
    if (frameCounter.current % DETECTION_INTERVAL !== 0) {
      rafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    tf.engine().startScope();
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 5, 0.5);
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current && videoRef.current) {
        // Auto-sync canvas resolution
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        predictions.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          
          // Draw bounding box
          ctx.strokeStyle = '#22c55e'; // Tailwind green-500
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);

          // Draw Label
          ctx.fillStyle = '#22c55e';
          ctx.font = '12px Inter, sans-serif';
          ctx.fillText(
            `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`,
            x, y > 15 ? y - 5 : 15
          );
        });

        // Business Logic: Alerting
        const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
        const now = Date.now();

        if (person && (now - lastAlertRef.current > COOLDOWN_MS)) {
          lastAlertRef.current = now;
          triggerNewAlert({
            ruleName: "HUMAN_PRESENCE_DETECTED",
            priority: 'critical',
            message: `Person detected with ${Math.round(person.score * 100)}% confidence`,
            timestamp: new Date().toISOString(),
            detections: [{ class: 'person', confidence: person.score }]
          }).catch(() => console.warn("Network: Alert dispatch failed."));
        }
      }
    } catch (err) {
      console.error("Inference Error:", err);
      if (err instanceof Error && err.message.includes('lost')) {
        setInitStatus('error');
        setIsLive(false);
      }
    } finally {
      tf.engine().endScope();
      if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    }
  }, [isLive, triggerNewAlert]);

  /**
   * System Initializer
   */
  const initializeSystem = async () => {
    try {
      setInitStatus('loading');

      // 1. Backend Selection: Try Wasm first for stability
      // If Wasm fails, it defaults to CPU/WebGL safely
      await tf.setBackend('wasm').catch(() => tf.setBackend('cpu'));
      await tf.ready();
      
      setDebugInfo(prev => ({ ...prev, backend: tf.getBackend() }));

      // 2. Load Model & Stream
      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } 
        })
      ]);

      modelRef.current = loadedModel;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsLive(true);
          setInitStatus('active');
        };
      }
    } catch (error) {
      console.error("System Boot Failure:", error);
      setInitStatus('error');
    }
  };

  useEffect(() => {
    if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isLive, runDetection]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vision Node 01</h1>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <p className="text-xs text-slate-500 uppercase font-medium">System Status: {initStatus}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 uppercase">Backend Engine</p>
            <p className="text-xs font-mono font-bold text-slate-700">{debugInfo.backend || '---'}</p>
          </div>
          <Button 
            onClick={initializeSystem}
            disabled={initStatus === 'loading' || initStatus === 'active'}
            variant={initStatus === 'error' ? 'destructive' : 'default'}
          >
            {initStatus === 'active' ? 'Monitoring Active' : 'Initialize System'}
          </Button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video shadow-inner">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay 
          muted 
          playsInline 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full"
        />
        
        {initStatus === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <p className="text-slate-400 text-sm">Waiting for system initialization...</p>
          </div>
        )}
        
        {initStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white text-sm">Downloading Neural Weights...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Debug Overlay */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase">Detection Logic</p>
          <p className="text-sm font-semibold text-slate-700">MobileNet V2 (Lite)</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase">Input Stream</p>
          <p className="text-sm font-semibold text-slate-700">720p @ 30fps</p>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;