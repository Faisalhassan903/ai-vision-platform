import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import { AI_SERVICE_URL } from '../config'; 

interface Detection {
  class: string;
  confidence: number;
  bbox: { 
    x1: number; 
    y1: number; 
    x2: number; 
    y2: number; 
    width: number; 
    height: number; 
  };
}

const LiveCamera = () => {
  // Persistent Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionsRef = useRef<Detection[]>([]);

  // UI State
  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'online' | 'error'>('idle');

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Update detection ref for the draw loop
  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  const connectSocket = () => {
    setStatus('connecting');
    
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false, 
      reconnection: true,
      reconnectionAttempts: 5,
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ AI Tunnel Online:', socketRef.current?.id);
      setStatus('online');
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      const list = Array.isArray(data) ? data : (data.detections || []);
      setDetections(list);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ Socket Error:', err.message);
      setStatus('error');
    });
  };

  const startCamera = async () => {
    try {
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
      console.error('❌ Camera Access Denied:', err.message);
      setStatus('error');
    }
  };

  const startProcessing = () => {
    let frameCount = 0;
    let lastTime = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // 1. Draw raw feed
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // 2. Draw detections
      lastDetectionsRef.current.forEach((det) => {
        const scaleX = canvasRef.current!.width / 640; 
        const scaleY = canvasRef.current!.height / 640;

        const x = det.bbox.x1 * scaleX;
        const y = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(`${det.class.toUpperCase()}`, x, y > 20 ? y - 5 : y + 15);
      });

      // FPS Logic
      frameCount++;
      if (Date.now() - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    // 3. Frame Emission (Wait for connection to stabilize)
    setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (canvasRef.current && socketRef.current?.connected) {
          // Low quality (0.1) is mandatory for Render stability
          const frameData = canvasRef.current.toDataURL('image/jpeg', 0.1); 
          socketRef.current.emit('video-frame', { 
              frame: frameData, 
              cameraId: 'local-node-01' 
          });
        }
      }, 2000); 
    }, 1000);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
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
              Sentry AI Vision
            </h1>
            <p className="text-slate-500 font-mono text-sm mt-1">
              STATUS: <span className={status === 'online' ? 'text-emerald-400' : 'text-slate-400'}>{status.toUpperCase()}</span>
            </p>
          </div>
          <Button 
            onClick={isStreaming ? stopCamera : startCamera} 
            variant={isStreaming ? 'danger' : 'primary'}
            className="px-10 py-6 text-lg font-bold"
          >
            {isStreaming ? 'TERMINATE FEED' : 'INITIATE UPLINK'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-black border-slate-800 p-0 overflow-hidden relative shadow-2xl">
              <video ref={videoRef} className="hidden" />
              <canvas ref={canvasRef} className="w-full h-auto" />
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                  <div className="w-16 h-16 border-t-2 border-emerald-500 rounded-full animate-spin mb-4" />
                  <p className="font-mono text-xs tracking-widest text-slate-400">WAITING FOR HANDSHAKE...</p>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="UPLINK FPS" value={fps} />
              <StatCard label="AI PROCESSED" value={processedFrames} />
              <StatCard label="ACTIVE TARGETS" value={detections.length} />
              <StatCard label="BANDWIDTH" value="OPTIMIZED" />
            </div>
          </div>

          <aside className="space-y-4">
            <Card title="DETECTION LOG" className="bg-slate-900/40 border-slate-800">
              <div className="space-y-2">
                {detections.length === 0 ? (
                  <p className="text-slate-600 italic text-center text-sm py-10">Scanning... No targets found.</p>
                ) : (
                  detections.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-800/50 rounded border border-slate-700/30">
                      <span className="font-bold text-emerald-400 text-xs tracking-tighter uppercase">{d.class}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        {(d.confidence * 100).toFixed(0)}%
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