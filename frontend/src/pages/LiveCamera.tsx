import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tfwasm from '@tensorflow/tfjs-backend-wasm';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

const DETECTION_INTERVAL = 4; 
const ALERT_THRESHOLD = 0.70;
const COOLDOWN_MS = 10000; 

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();
  
  // Refs for persistent hardware/AI state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef = useRef<number>();
  const lastAlertRef = useRef<number>(0);
  const frameCounter = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializing = useRef(false); // Prevents double-start "flicker"

  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState({ backend: '' });

  /**
   * STOP: Cleanup hardware properly
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
    isInitializing.current = false;
  }, []);

  /**
   * START: The Neural Hub
   */
  const startCamera = async () => {
    if (isInitializing.current || isLive) return; // Guard
    isInitializing.current = true;

    try {
      setInitStatus('loading');

      // 1. WASM Setup (CDN Fallback)
      const version = tf.version.tfjs;
      await tfwasm.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${version}/dist/`);
      
      if (tf.getBackend() !== 'wasm') {
        try {
          await tf.setBackend('wasm');
        } catch {
          await tf.setBackend('webgl');
        }
      }
      await tf.ready();
      setDebugInfo({ backend: tf.getBackend() });

      // 2. Load Model & Stream
      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false 
        })
      ]);

      modelRef.current = loadedModel;
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready before setting status to 'active'
        await videoRef.current.play();
        setIsLive(true);
        setInitStatus('active');
      }
    } catch (error) {
      console.error("System Boot Failure:", error);
      setInitStatus('error');
      isInitializing.current = false;
    }
  };

  /**
   * DETECTION: Analytics & Alerting
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
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          const isPerson = p.class === 'person';
          
          ctx.strokeStyle = isPerson ? '#ff0000' : '#00ff00';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          
          ctx.fillStyle = isPerson ? '#ff0000' : '#00ff00';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(`${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`, x, y > 15 ? y - 5 : 15);
        });

        const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
        if (person && (Date.now() - lastAlertRef.current > COOLDOWN_MS)) {
          lastAlertRef.current = Date.now();
          
          // Complete Payload for Analytics Mission
          triggerNewAlert({
            ruleName: "HUMAN_DETECTION",
            priority: 'critical',
            message: `Unidentified person detected at entrance.`,
            cameraName: "Main Node 01",
            analytics: {
              device_id: "VISION-01",
              primary_target: "person",
              confidence_avg: person.score
            },
            detections: predictions.map(d => ({ class: d.class, confidence: d.score }))
          });
        }
      }
    } finally {
      tf.engine().endScope();
      if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    }
  }, [isLive, triggerNewAlert]);

  useEffect(() => {
    if (isLive) {
      rafRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      // ONLY stop if the component is actually unmounting
      if (!isLive && !isInitializing.current) stopCamera();
    };
  }, [isLive, runDetection, stopCamera]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live AI Vision</h1>
          <p className="text-xs font-mono text-slate-500 uppercase">Engine: {debugInfo.backend || 'IDLE'}</p>
        </div>
        <div className="flex gap-3">
          {!isLive ? (
            <Button onClick={startCamera} disabled={initStatus === 'loading'}>
              {initStatus === 'loading' ? 'Loading AI...' : 'Initialize Node'}
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="destructive">Shutdown Node</Button>
          )}
        </div>
      </div>

      <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        {initStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">Downloading Neural Weights...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCamera;