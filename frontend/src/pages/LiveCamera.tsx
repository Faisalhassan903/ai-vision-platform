import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Card, Button, StatCard, Badge } from '../components/ui';
import { AI_SERVICE_URL } from '../config';

const LiveCamera = () => {
  // Refs for persistent objects
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // UI State
  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading_ai' | 'online' | 'error'>('idle');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const connectSocket = () => {
    // We use polling first because Render Free Tier often fails direct WebSocket handshakes
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      timeout: 20000, 
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to Hub via:', socketRef.current?.io.engine.transport.name);
      setStatus('online');
      setIsStreaming(true);
      runDetectionLoop();
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ Socket Error:', err.message);
      setStatus('error');
    });
  };

  const startCamera = async () => {
    try {
      setStatus('loading_ai');
      
      // Load AI Model into Browser Memory
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
      console.error('❌ Hardware Access Denied:', err);
      setStatus('error');
    }
  };

  const runDetectionLoop = async () => {
    let frameCount = 0;
    let lastTime = Date.now();

    const detectFrame = async () => {
      if (!videoRef.current || !canvasRef.current || !modelRef.current) return;

      // 1. Run local inference
      const predictions = await modelRef.current.detect(videoRef.current);
      setDetections(predictions);
      setProcessedFrames(prev => prev + 1);

      // 2. Draw detections to the UI
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

          // 3. Trigger Remote Alarm if person detected
          if (prediction.class === 'person' && prediction.score > 0.65) {
            socketRef.current?.emit('alarm-trigger', {
              label: 'PERSON',
              confidence: prediction.score,
              timestamp: new Date().toLocaleTimeString()
            });
          }
        });
      }

      // Performance tracking
      frameCount++;
      if (Date.now() - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();
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
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent uppercase">
              Sentry Edge Vision
            </h1>
            <p className="text-slate-500 font-mono text-sm mt-1">
              ENGINE: <span className="text-emerald-400 font-bold">EDGE_AI_V3</span> | STATUS: {status.toUpperCase()}
            </p>
          </div>
          <Button 
            onClick={isStreaming ? stopCamera : startCamera} 
            variant={isStreaming ? 'danger' : 'primary'}
            className="px-10 py-6 text-lg font-bold transition-all hover:scale-105 active:scale-95"
          >
            {isStreaming ? 'STOP SCAN' : 'START AI CORE'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-black border-slate-800 p-0 overflow-hidden relative shadow-2xl rounded-2xl">
              <video ref={videoRef} className="hidden" muted playsInline />
              <canvas ref={canvasRef} className="w-full h-auto" />
              {status === 'loading_ai' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-mono text-xs tracking-widest text-emerald-500 animate-pulse">OPTIMIZING AI WEIGHTS...</p>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="CLIENT FPS" value={fps} />
              <StatCard label="LOCAL INFERENCE" value={processedFrames} />
              <StatCard label="OBJECTS" value={detections.length} />
              <StatCard label="CPU LOAD" value="LOW (EDGE)" />
            </div>
          </div>

          <aside className="space-y-4">
            <Card title="DETECTION LOG" className="bg-slate-900/40 border-slate-800">
              <div className="space-y-2 min-h-[300px]">
                {detections.length === 0 ? (
                  <p className="text-slate-600 italic text-center text-sm py-20">Monitoring live feed...</p>
                ) : (
                  detections.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 animate-in fade-in slide-in-from-right-2">
                      <span className="font-bold text-emerald-400 text-xs tracking-tighter uppercase">{d.class}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        {(d.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;