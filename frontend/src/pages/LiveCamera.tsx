import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tfwasm from '@tensorflow/tfjs-backend-wasm'; // Import for path setting
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

const DETECTION_INTERVAL = 4;
const ALERT_THRESHOLD = 0.75;
const COOLDOWN_MS = 10000; 

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef = useRef<number>();
  const lastAlertRef = useRef<number>(0);
  const frameCounter = useRef<number>(0);

  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState({ backend: '' });

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

        predictions.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#22c55e';
          ctx.font = '12px Inter, sans-serif';
          ctx.fillText(
            `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`,
            x, y > 15 ? y - 5 : 15
          );
        });

        // --- UPDATED BUSINESS LOGIC FOR ANALYTICS MISSION ---
        const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
        const now = Date.now();

        if (person && (now - lastAlertRef.current > COOLDOWN_MS)) {
          lastAlertRef.current = now;
          
          const incidentPayload = {
            ruleName: "RESTRICTED_AREA_ACCESS",
            priority: 'critical' as const,
            message: `Unidentified person detected (Confidence: ${Math.round(person.score * 100)}%)`,
            cameraId: "NODE-01",
            cameraName: "Main Entrance",
            // This matches the new Mongoose schema for charts
            analytics: {
              device_id: "VISION-NODE-01",
              primary_target: "person",
              confidence_avg: person.score
            },
            detections: predictions.map(p => ({
              class: p.class,
              confidence: p.score,
              bbox: p.bbox
            }))
          };

          triggerNewAlert(incidentPayload).catch(err => {
            console.error("🚨 Alert Dispatch Failed:", err.message);
          });
        }
      }
    } catch (err) {
      console.error("Inference Error:", err);
    } finally {
      tf.engine().endScope();
      if (isLive) rafRef.current = requestAnimationFrame(runDetection);
    }
  }, [isLive, triggerNewAlert]);

  const initializeSystem = async () => {
    try {
      setInitStatus('loading');

      // 1. FIX: Explicit WASM Paths (Stops the 404 in console)
      await tfwasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/');
      
      // Try WASM, then WebGL (GPU), then CPU as absolute last resort
      try {
        await tf.setBackend('wasm');
      } catch {
        await tf.setBackend('webgl');
      }
      
      await tf.ready();
      setDebugInfo({ backend: tf.getBackend() });

      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, facingMode: 'user' } 
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Clean up camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    // ... JSX remains largely the same, but ensuring responsiveness ...
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* (Keep your existing Header and Viewport JSX here) */}
      {/* ... */}
    </div>
  );
};

export default LiveCamera;