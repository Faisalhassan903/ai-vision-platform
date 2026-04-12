import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui'; 
import { useAlerts } from '../hooks/useAlerts';

const LiveCamera = () => {
  const { triggerNewAlert } = useAlerts();
  
  // Refs for persistent state without re-renders
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const requestRef = useRef<number>();
  
  // Optimization Refs
  const lastAlertTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  
  const [status, setStatus] = useState<'OFFLINE' | 'LOADING' | 'LIVE' | 'ERROR'>('OFFLINE');
  const [isActive, setIsActive] = useState(false);

  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    // 1. PERFORMANCE THROTTLE
    // Only run AI detection every 4th frame (~15 FPS)
    // This reduces GPU usage by 75% compared to 60 FPS
    frameCountRef.current++;
    if (frameCountRef.current % 4 !== 0) {
      requestRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // 2. MEMORY MANAGEMENT
    tf.engine().startScope(); 
    
    try {
      const predictions = await modelRef.current.detect(videoRef.current, 5, 0.6);
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx && canvasRef.current && videoRef.current) {
        // Match canvas size to video stream exactly
        if (canvasRef.current.width !== videoRef.current.videoWidth) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          
          ctx.fillStyle = '#00FF41';
          ctx.fillText(`${p.class} (${Math.round(p.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
        });

        // 3. INTELLIGENT ALERTING (Rate-Limited to 1 per 10s)
        const person = predictions.find(p => p.class === 'person' && p.score > 0.75);
        const now = Date.now();
        
        if (person && (now - lastAlertTimeRef.current > 10000)) {
          lastAlertTimeRef.current = now;
          triggerNewAlert({
            ruleName: "AI_HUMAN_DETECTION",
            priority: 'critical',
            message: "Unauthorized entry detected",
            timestamp: new Date().toISOString(),
            detections: [{ class: 'person', confidence: person.score }]
          }).catch(() => console.warn("Network: Alert dropped due to congestion"));
        }
      }
    } catch (err) {
      console.error("Inference Error:", err);
      // Stop loop if GPU crashes
      if (err instanceof Error && err.message.includes('lost')) {
        setIsActive(false);
        setStatus('ERROR');
      }
    } finally {
      tf.engine().endScope(); // CRITICAL: Dispose tensors
      if (isActive) requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, [isActive, triggerNewAlert]);

  const startEngine = async () => {
    try {
      setStatus('LOADING');
      
      // Ensure WebGL is ready
      await tf.ready();
      
      const [model, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }), // Use 'lite' for production speed
        navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: 640, height: 480 } 
        })
      ]);

      modelRef.current = model;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video metadata to load before starting detection
        videoRef.current.onloadedmetadata = () => {
          setIsActive(true);
          setStatus('LIVE');
        };
      }
    } catch (e) {
      console.error("Initialization Error:", e);
      setStatus('ERROR');
    }
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Cleanup stream on unmount
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [isActive, detectFrame]);

  return (
    <div className="flex flex-col gap-4 p-6 bg-zinc-950 rounded-xl border border-zinc-800 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
          <h2 className="text-zinc-100 text-sm tracking-widest">SENTRY // {status}</h2>
        </div>
        <Button 
          onClick={startEngine} 
          disabled={status === 'LIVE' || status === 'LOADING'}
          className="bg-zinc-100 text-black hover:bg-[#00FF41] transition-colors"
        >
          {status === 'OFFLINE' ? 'BOOT_SYSTEM' : 'SYSTEM_RUNNING'}
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-black aspect-video border border-zinc-800 shadow-2xl">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover opacity-80" 
          autoPlay 
          muted 
          playsInline 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full pointer-events-none" 
        />
        
        {status === 'LOADING' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="text-[#00FF41] text-xs animate-pulse">DOWNLOADING_WEIGHTS...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCamera;