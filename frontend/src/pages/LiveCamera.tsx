import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Card, Button, StatCard, Badge } from '../components/ui';
import { AI_SERVICE_URL } from '../config';

// Professional Security Constants
const CONFIDENCE_THRESHOLD = 0.60;
const FRAME_SAMPLING_RATE = 100; // ms between AI inferences to save CPU

const LiveCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const requestRef = useRef<number | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ fps: 0, latency: 0, count: 0 });
  const [status, setStatus] = useState<'idle' | 'warmup' | 'streaming' | 'error'>('idle');

  // 1. Initialize TF.js Backend (Crucial for Vercel/Vite compatibility)
  const initEngine = async () => {
    try {
      setStatus('warmup');
      await tf.ready();
      // Use the 'webgl' or 'cpu' backend explicitly to avoid silent fails
      await tf.setBackend('webgl'); 
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      console.log("🛡️ Security Engine Primed: WebGL Backend");
      return true;
    } catch (e) {
      console.error("Engine failure:", e);
      return false;
    }
  };

  const stopPipeline = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    socketRef.current?.disconnect();
    setIsActive(false);
    setStatus('idle');
    setDetections([]);
  }, []);

  const runInference = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !isActive) return;

    const startTime = performance.now();
    
    // Perform detection on the actual video element
    const predictions = await modelRef.current.detect(videoRef.current);
    
    // Draw logic
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      predictions.forEach(prediction => {
        if (prediction.score >= CONFIDENCE_THRESHOLD) {
          const [x, y, width, height] = prediction.bbox;
          
          // Professional Styling: Security HUD Green
          ctx.strokeStyle = '#00ff41'; 
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]); // Dashed lines for "scanning" effect
          ctx.strokeRect(x, y, width, height);
          
          ctx.fillStyle = '#00ff41';
          ctx.font = '12px JetBrains Mono, monospace';
          ctx.fillText(
            `TAG: ${prediction.class.toUpperCase()} [${Math.round(prediction.score * 100)}%]`,
            x, y > 20 ? y - 7 : y + 15
          );

          // Socket Uplink for Alarms
          if (prediction.class === 'person') {
            socketRef.current?.emit('alarm-trigger', {
              type: 'INTRUSION',
              zone: 'ALPHA-01',
              timestamp: Date.now()
            });
          }
        }
      });
    }

    const endTime = performance.now();
    setMetrics(prev => ({
      fps: Math.round(1000 / (endTime - startTime)),
      latency: Math.round(endTime - startTime),
      count: prev.count + 1
    }));

    // Recursive loop with a small delay to prevent browser "Forced Reflow"
    setTimeout(() => {
        requestRef.current = requestAnimationFrame(runInference);
    }, 30); 
  };

  const startPipeline = async () => {
    const ready = await initEngine();
    if (!ready) { setStatus('error'); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          
          // Socket Handshake
          socketRef.current = io(AI_SERVICE_URL, {
            transports: ['polling', 'websocket'],
            reconnection: true
          });

          socketRef.current.on('connect', () => {
            setIsActive(true);
            setStatus('streaming');
          });
        };
      }
    } catch (err) {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isActive) runInference();
    return () => stopPipeline();
  }, [isActive]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
          <div>
            <Badge className="mb-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">SYSTEM ACTIVE</Badge>
            <h1 className="text-3xl font-bold tracking-tighter text-white">SENTRY_VISION_PRO <span className="text-slate-500 text-sm">v4.2.0</span></h1>
          </div>
          <Button 
            onClick={isActive ? stopPipeline : startPipeline}
            className={`px-8 h-14 font-bold border-2 ${isActive ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-500'}`}
          >
            {isActive ? 'TERMINATE_SESSION' : 'INITIALIZE_CORE'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="relative rounded-xl border border-white/5 bg-black overflow-hidden shadow-2xl aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover opacity-60" muted playsInline />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
              
              {status === 'warmup' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md">
                  <div className="text-center">
                    <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-xs tracking-widest text-emerald-500 uppercase">Loading Neural Engine...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <StatCard label="CORE_LATENCY" value={`${metrics.latency}ms`} sub={metrics.latency > 100 ? 'HIGH' : 'OPTIMAL'} />
            <StatCard label="INFERENCE_FPS" value={metrics.fps} />
            <Card className="bg-white/5 border-white/10 p-4">
              <h3 className="text-xs text-slate-500 mb-4">TARGET_LOG</h3>
              <div className="space-y-2 h-[300px] overflow-y-auto pr-2">
                {detections.length === 0 && <p className="text-slate-700 text-xs italic">No targets in perimeter...</p>}
                {detections.map((d, i) => (
                  <div key={i} className="flex justify-between p-2 bg-white/5 rounded border-l-2 border-emerald-500">
                    <span className="text-xs font-bold uppercase">{d.class}</span>
                    <span className="text-[10px] text-emerald-500">CONF:{Math.round(d.score * 100)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;