import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button, StatCard } from '../components/ui';
import { AI_SERVICE_URL } from '../config';

const OBJECT_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

const LiveCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<number>();
  const lastAlarmTime = useRef<number>(0);

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('OFFLINE');
  const [stats, setStats] = useState({ objects: 0, memory: 0 });

  // 1. ASYNC DETECTION ENGINE (The Core Fix)
  const detectFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    // Use engine scope to prevent "Promise inside tidy" errors while auto-cleaning memory
    tf.engine().startScope();

    try {
      const predictions = await modelRef.current.detect(videoRef.current, 20, 0.5);
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach((prediction) => {
          if (OBJECT_CLASSES.includes(prediction.class)) {
            const [x, y, w, h] = prediction.bbox;
            
            // Draw UI
            ctx.strokeStyle = '#00FF41';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = '#00FF41';
            ctx.font = '12px JetBrains Mono, monospace';
            ctx.fillText(
              `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`, 
              x, y > 10 ? y - 5 : 10
            );

            // Trigger Alarm via Socket (Throttled to once every 3 seconds)
            const now = Date.now();
            if (now - lastAlarmTime.current > 3000 && socketRef.current?.connected) {
              socketRef.current.emit('alarm-trigger', { 
                label: prediction.class,
                timestamp: now 
              });
              lastAlarmTime.current = now;
            }
          }
        });
        
        setStats({ 
            objects: predictions.length, 
            memory: Math.round(tf.memory().numBytes / 1024 / 1024) 
        });
      }
    } catch (err) {
      console.error("Inference Error:", err);
    } finally {
      tf.engine().endScope(); // Safely dispose all temporary tensors
      if (isActive) {
        requestRef.current = requestAnimationFrame(detectFrame);
      }
    }
  }, [isActive]);

  // 2. HARDWARE & SOCKET INITIALIZATION
  const startEngine = async () => {
    try {
      setStatus('WARMING_UP...');
      await tf.ready();
      
      // Force WebGL for high performance
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

      socketRef.current = io(AI_SERVICE_URL, { 
        transports: ['websocket'],
        reconnectionAttempts: 5 
      });

    } catch (err) {
      console.error("Critical Setup Error:", err);
      setStatus('CORE_FAILURE');
    }
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, detectFrame]);

  return (
    <div className="p-8 bg-[#0a0a0a] min-h-screen font-mono text-[#00FF41]">
      <div className="max-w-6xl mx-auto border border-[#00FF41]/20 p-6 rounded-sm bg-black shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tighter">SENTRY_CORE_V5</h1>
            <p className="text-[10px] opacity-50 uppercase tracking-widest">{status} // SECURE_UPLINK</p>
          </div>
          <Button 
            onClick={isActive ? () => window.location.reload() : startEngine} 
            className="border-2 border-[#00FF41] hover:bg-[#00FF41] hover:text-black font-bold px-10 py-4 transition-all"
          >
            {isActive ? 'REBOOT_SYSTEM' : 'INIT_AI_CORE'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 relative bg-[#111] rounded border border-white/5 overflow-hidden">
            <video ref={videoRef} className="w-full h-auto opacity-60" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <p className="text-[10px] tracking-widest opacity-50 animate-pulse">OFFLINE // IDLE_MODE</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <StatCard label="LIVE_OBJECTS" value={stats.objects} />
            <div className="flex-1 bg-white/5 border border-white/10 p-4 rounded text-[11px]">
              <p className="text-white/30 border-b border-white/10 mb-3 pb-1 uppercase">Diagnostics</p>
              <div className="space-y-2 opacity-80">
                <p>&gt; ENGINE: TFJS_WEBGL</p>
                <p>&gt; MEMORY: {stats.memory}MB</p>
                <p>&gt; SOCKET: {socketRef.current?.connected ? 'STABLE' : 'WAITING'}</p>
                {stats.objects > 0 && <p className="text-white animate-bounce">&gt; THREAT_DETECTED</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;