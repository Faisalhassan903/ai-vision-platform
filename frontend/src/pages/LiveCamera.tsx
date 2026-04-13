import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tfwasm from '@tensorflow/tfjs-backend-wasm';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

// Constants for tuning
const DETECTION_INTERVAL = 4; 
const ALERT_THRESHOLD = 0.75;
const COOLDOWN_MS = 10000; 

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();
  
  // DOM & Logic Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef = useRef<number>();
  const lastAlertRef = useRef<number>(0);
  const frameCounter = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState({ backend: '', fps: 0 });

  /**
   * STOP CAMERA: Properly kills hardware tracks
   */
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsLive(false);
    setInitStatus('idle');
    console.log("🎥 Camera Hardware Released");
  }, []);

  /**
   * START CAMERA & AI: Initializes WASM and Neural Network
   */
  const startCamera = async () => {
    try {
      setInitStatus('loading');

      // 1. Configure WASM CDN (Fixes the Vercel 404)
      const version = tf.version.tfjs;
      await tfwasm.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${version}/dist/`);
      
      // 2. Select best available Backend
      try {
        await tf.setBackend('wasm');
      } catch {
        await tf.setBackend('webgl');
      }
      await tf.ready();
      setDebugInfo(prev => ({ ...prev, backend: tf.getBackend() }));

      // 3. Load Model & Hardware simultaneously
      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false 
        })
      ]);

      modelRef.current = loadedModel;
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsLive(true);
          setInitStatus('active');
          videoRef.current?.play();
        };
      }
    } catch (error) {
      console.error("🚀 System Boot Failure:", error);
      setInitStatus('error');
    }
  };

  /**
   * INFERENCE LOOP: The "Brain" of the operation
   */
  const runDetection = useCallback(async () => {
    if (!isLive || !videoRef.current || !modelRef.current) return;

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
        // Sync canvas to video dimensions
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          // UI Visuals
          ctx.strokeStyle = p.class === 'person' ? '#ef4444' : '#22c55e';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = p.class === 'person' ? '#ef4444' : '#22c55e';
          ctx.fillText(`${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`, x, y > 10 ? y - 5 : 10);
        });

        // Incident logic
        const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
        const now = Date.now();

        if (person && (now - lastAlertRef.current > COOLDOWN_MS)) {
          lastAlertRef.current = now;
          triggerNewAlert({
            ruleName: "PERSON_DETECTED",
            priority: 'critical',
            message: `Intruder detected with ${Math.round(person.score * 100)}% confidence`,
            analytics: { device_id: "NODE-01", primary_target: "person", confidence_avg: person.score },
            detections: predictions.map(d => ({ class: d.class, confidence: d.score }))
          });
        }
      }
    } finally {
      tf.engine().endScope();
      if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    }
  }, [isLive, triggerNewAlert]);

  // Lifecycle Management
  useEffect(() => {
    if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    return () => stopCamera(); // Cleanup on exit
  }, [isLive, runDetection, stopCamera]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between bg-white border p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Vision Control Node</h2>
          <p className="text-sm text-slate-500 font-mono">Backend: {debugInfo.backend.toUpperCase()}</p>
        </div>
        
        <div className="flex gap-2">
          {!isLive ? (
            <Button onClick={startCamera} disabled={initStatus === 'loading'} className="bg-blue-600 hover:bg-blue-700">
              {initStatus === 'loading' ? 'Configuring AI...' : 'Start Node'}
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="destructive">Stop Node</Button>
          )}
        </div>
      </div>

      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-4 border-slate-200">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        
        {initStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium">Mounting Neural Engine...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCamera;