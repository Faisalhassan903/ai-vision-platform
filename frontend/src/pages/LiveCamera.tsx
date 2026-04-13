import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tfwasm from '@tensorflow/tfjs-backend-wasm';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

const DETECTION_INTERVAL = 3; // Faster polling for high-security
const ALERT_THRESHOLD = 0.65; // High sensitivity for night security
const COOLDOWN_MS = 15000; 

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();
  
  // Hardware & AI Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  
  // Security Logic Refs
  const lastAlertRef = useRef<number>(0);
  const isBooting = useRef(false);

  // UI State
  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [securityStatus, setSecurityStatus] = useState('SYSTEM_DISARMED');

  /**
   * EMERGENCY SHUTDOWN: Clears all hardware tracks
   */
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    
    setIsLive(false);
    setInitStatus('idle');
    setSecurityStatus('SYSTEM_DISARMED');
    console.log("🎥 Security Node: Hardware Released");
  }, []);

  /**
   * SYSTEM INITIALIZE: Bank-Grade Boot Sequence
   */
  const startSecurityNode = async () => {
    if (isBooting.current) return;
    isBooting.current = true;

    try {
      setInitStatus('loading');
      setSecurityStatus('BOOTING_NEURAL_ENGINE');

      // 1. WASM FORCED PATH (Kills the 404 Error)
      const version = tf.version.tfjs;
      tfwasm.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${version}/dist/`);
      
      // 2. BACKEND HANDSHAKE
      try {
        await tf.setBackend('wasm');
      } catch (e) {
        console.warn("WASM Engine blocked. Falling back to WebGL.");
        await tf.setBackend('webgl');
      }
      await tf.ready();

      // 3. HARDWARE LOCK-ON
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play(); // Ensure stream is flowing BEFORE model load
      }

      // 4. LOAD AI MODEL
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });

      setSecurityStatus('ACTIVE_MONITORING');
      setInitStatus('active');
      setIsLive(true);
    } catch (err) {
      console.error("🚨 SECURITY BREACH: System failed to boot", err);
      setInitStatus('error');
      stopCamera();
    } finally {
      isBooting.current = false;
    }
  };

  /**
   * SURVEILLANCE LOOP: Analytics & Real-time Triggering
   */
  const monitorStream = useCallback(async () => {
    if (!isLive || !videoRef.current || !modelRef.current) return;

    tf.engine().startScope();
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 6, 0.4);
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx && canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Security Visualization
        predictions.forEach(p => {
          const isTarget = p.class === 'person';
          const [x, y, w, h] = p.bbox;

          ctx.strokeStyle = isTarget ? '#FF0000' : '#00FF41'; // Red for targets, Matrix green for others
          ctx.lineWidth = isTarget ? 4 : 2;
          ctx.strokeRect(x, y, w, h);

          ctx.fillStyle = isTarget ? '#FF0000' : '#00FF41';
          ctx.font = 'bold 16px Courier New';
          ctx.fillText(`[${p.class.toUpperCase()}: ${Math.round(p.score * 100)}%]`, x, y - 10);
        });

        // Smart Trigger Logic
        const target = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
        if (target && (Date.now() - lastAlertRef.current > COOLDOWN_MS)) {
          lastAlertRef.current = Date.now();
          setSecurityStatus('INTRUDER_DETECTED');

          // Bank-Grade Payload
          triggerNewAlert({
            ruleName: "UNAUTHORIZED_ENTRY",
            priority: 'critical',
            message: "Human presence detected in secure zone.",
            cameraName: "Vault_Entrance_01",
            analytics: {
              device_id: "SENTRY_NODE_ALPHA",
              primary_target: "human",
              confidence_avg: target.score
            },
            detections: predictions.map(d => ({ class: d.class, confidence: d.score }))
          }).catch(e => console.error("Comms Link Failed", e));
        }
      }
    } finally {
      tf.engine().endScope();
      if (isLive) rafRef.current = requestAnimationFrame(monitorStream);
    }
  }, [isLive, triggerNewAlert]);

  useEffect(() => {
    if (isLive) rafRef.current = requestAnimationFrame(monitorStream);
    return () => stopCamera();
  }, [isLive, monitorStream, stopCamera]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white font-mono">
      {/* HUD Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-red-500">SENTRY HUB <span className="text-white">v4.0</span></h1>
          <p className={`text-xs ${isLive ? 'text-green-400' : 'text-slate-500'}`}>
            STATUS: {securityStatus}
          </p>
        </div>
        <Button 
          onClick={isLive ? stopCamera : startSecurityNode} 
          variant={isLive ? 'destructive' : 'default'}
          className={!isLive ? 'bg-green-600 hover:bg-green-500 text-black font-bold' : ''}
        >
          {isLive ? 'TERMINATE_SURVEILLANCE' : 'INITIALIZE_SENTRY'}
        </Button>
      </div>

      {/* Main Viewport */}
      <div className="max-w-6xl mx-auto relative group">
        <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 text-[10px] border border-green-500/30">
          REC ● LIVE_FEED_01
        </div>
        <div className="relative aspect-video rounded-sm border border-slate-800 bg-black overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-20" />
          
          {initStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
              <div className="w-16 h-1 bg-slate-800 overflow-hidden mb-2">
                <div className="w-full h-full bg-green-500 animate-progress origin-left" />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-green-500">Loading Neural Assets...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;