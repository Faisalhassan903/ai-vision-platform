import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import AlertToast from '../components/AlertToast';
import { SOCKET_URL, AI_SERVICE_URL } from '../config'; 

interface Detection {
  class: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; };
}

function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionsRef = useRef<Detection[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  const connectSocket = () => {
    console.log('🔌 Connecting to AI Service...');
    
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false, 
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 20000 // Extended timeout for Render spin-up
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ [DEBUG] Connected. ID:', socketRef.current?.id);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      const list = Array.isArray(data) ? data : (data.detections || []);
      console.log('🎯 [DEBUG] AI Response:', list.length, 'objects found');
      setDetections(list);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ [DEBUG] Socket Error:', err.message);
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 } // Standard resolution
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
      console.error('❌ Camera Error:', err.message);
    }
  };

  const startProcessing = () => {
    let frameCount = 0;
    let lastTime = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Draw Feed
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Draw Boxes
      lastDetectionsRef.current.forEach((det) => {
        // COORDINATE FIX: Ensure these match your Python model's expected input (usually 640 or 416)
        const scaleX = canvasRef.current!.width / 640; 
        const scaleY = canvasRef.current!.height / 640;

        const x = det.bbox.x1 * scaleX;
        const y = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        ctx.strokeStyle = '#22c55e'; // Emerald-500
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#22c55e';
        ctx.fillText(`${det.class}`, x, y - 10);
      });

      frameCount++;
      if (Date.now() - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    // MEMORY OPTIMIZATION: Send 1 frame every 3 seconds
    // This prevents the Render server from being overwhelmed
    intervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        // QUALITY REDUCTION: 0.1 quality significantly reduces memory usage
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.1); 
        socketRef.current.emit('video-frame', { 
            frame: frameData, 
            cameraId: 'webcam-01' 
        });
      }
    }, 3000); 
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    socketRef.current?.disconnect();
    setIsStreaming(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">AI SURVEILLANCE NODE</h1>
          <Button onClick={isStreaming ? stopCamera : startCamera} variant={isStreaming ? 'danger' : 'primary'}>
            {isStreaming ? 'DISCONNECT' : 'INITIALIZE FEED'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-black border-slate-800 p-0 overflow-hidden shadow-2xl">
              <video ref={videoRef} className="hidden" />
              <canvas ref={canvasRef} className="w-full h-auto opacity-90" />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                  <p className="text-slate-500 animate-pulse">AWAITING SIGNAL...</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <StatCard label="NETWORK FPS" value={fps} />
            <StatCard label="AI UPTIME" value={`${processedFrames} frames`} />
            <Card title="ACTIVE DETECTIONS" className="bg-slate-800/50 border-slate-700">
              <div className="space-y-2">
                {detections.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-sm bg-slate-900 p-2 rounded border border-slate-700">
                    <span className="uppercase font-mono text-emerald-400">{d.class}</span>
                    <Badge variant="outline">{(d.confidence * 100).toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveCamera;