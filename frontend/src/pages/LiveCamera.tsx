import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Card, Button, StatCard, Badge } from '../components/ui';
import { AI_SERVICE_URL } from '../config';

interface Detection {
  class: string;
  score: number; // TensorFlow uses 'score' instead of 'confidence'
  bbox: [number, number, number, number]; // [x, y, width, height]
}

const LiveCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading_ai' | 'online' | 'error'>('idle');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setStatus('loading_ai');
      // 1. Initialize TensorFlow Backend and Load Model
      await tf.ready();
      modelRef.current = await cocoSsd.load();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
            connectSocket();
          });
        };
      }
    } catch (err: any) {
      console.error('❌ Initialization Failed:', err);
      setStatus('error');
    }
  };

  const connectSocket = () => {
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false,
    });
    
    socketRef.current.on('connect', () => {
      setStatus('online');
      setIsStreaming(true);
      runDetectionLoop();
    });
  };

  const runDetectionLoop = async () => {
    let frameCount = 0;
    let lastTime = Date.now();

    const detect = async () => {
      if (!videoRef.current || !canvasRef.current || !modelRef.current) return;
      
      // Perform local detection
      const predictions = await modelRef.current.detect(videoRef.current);
      setDetections(predictions);
      setProcessedFrames(prev => prev + 1);

      // Draw results to canvas
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(videoRef.current, 0, 0);

        predictions.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 16px Inter';
          ctx.fillText(`${prediction.class.toUpperCase()}`, x, y > 20 ? y - 5 : y + 20);
          
          // Trigger Alarm via Socket if 'person' is detected
          if (prediction.class === 'person' && prediction.score > 0.6) {
            socketRef.current?.emit('alarm-trigger', {
              label: 'PERSON_DETECTED',
              confidence: prediction.score,
              timestamp: new Date().toISOString()
            });
          }
        });
      }

      frameCount++;
      if (Date.now() - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    socketRef.current?.disconnect();
    setIsStreaming(false);
    setStatus('idle');
    setDetections([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent uppercase">
              Sentry Edge Vision
            </h1>
            <p className="text-slate-500 font-mono text-sm mt-1">
              ENGINE: <span className="text-emerald-400">TENSORFLOW.JS EDGE</span> | STATUS: {status.toUpperCase()}
            </p>
          </div>
          <Button onClick={isStreaming ? stopCamera : startCamera} variant={isStreaming ? 'danger' : 'primary'} className="px-10 py-6 text-lg font-bold">
            {isStreaming ? 'TERMINATE FEED' : 'INITIATE AI'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-black border-slate-800 p-0 overflow-hidden relative shadow-2xl">
              <video ref={videoRef} className="hidden" muted playsInline />
              <canvas ref={canvasRef} className="w-full h-auto" />
              {status === 'loading_ai' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-mono text-xs tracking-widest text-emerald-500">DOWNLOADING AI WEIGHTS...</p>
                </div>
              )}
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="LOCAL FPS" value={fps} />
              <StatCard label="AI INFERENCE" value={`${processedFrames}`} />
              <StatCard label="OBJECTS" value={detections.length} />
              <StatCard label="SERVER LOAD" value="1%" />
            </div>
          </div>
          <aside>
            <Card title="EVENT LOG" className="bg-slate-900/40 border-slate-800">
              <div className="space-y-2">
                {detections.map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/30 text-xs">
                    <span className="font-bold text-emerald-400 uppercase">{d.class}</span>
                    <Badge className="bg-emerald-500/10 text-emerald-500">{(d.score * 100).toFixed(0)}%</Badge>
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