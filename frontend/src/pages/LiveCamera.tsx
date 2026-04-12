import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import AlertToast from '../components/AlertToast';
import { AI_SERVICE_URL } from '../config'; 

interface Detection {
  class: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; };
}

function LiveCamera() {
  // Refs for persistent values that don't need re-renders
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionsRef = useRef<Detection[]>([]);

  // State for UI updates
  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Sync ref with state for use inside the high-speed draw loop
  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  const connectSocket = () => {
    console.log('🔌 Initializing Secure AI Tunnel...');
    
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'], // Force WebSocket to prevent 404 polling errors
      upgrade: false, 
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 30000 // High timeout to allow Render to "wake up"
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ AI Connection Established. ID:', socketRef.current?.id);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      // Handle both array and object formats from Python
      const list = Array.isArray(data) ? data : (data.detections || []);
      if (list.length > 0) {
        console.log(`🎯 AI Match: ${list[0].class} (${(list[0].confidence * 100).toFixed(0)}%)`);
      }
      setDetections(list);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ AI Tunnel Failed:', err.message);
    });
  };

  const startCamera = async () => {
    console.log('📷 Requesting Hardware Access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 30 } 
        }
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
      console.error('❌ Hardware Error:', err.message);
    }
  };

  const startProcessing = () => {
    let frameCount = 0;
    let lastTime = Date.now();

    // High-speed loop for rendering the video + bounding boxes
    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // 1. Draw raw camera frame
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // 2. Draw detection overlays (Green boxes)
      lastDetectionsRef.current.forEach((det) => {
        // Adjust these numbers if boxes don't line up with objects
        const scaleX = canvasRef.current!.width / 640; 
        const scaleY = canvasRef.current!.height / 640;

        const x = det.bbox.x1 * scaleX;
        const y = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        ctx.strokeStyle = '#10b981'; // Emerald Green
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Inter, system-ui, sans-serif';
        ctx.fillText(`${det.class.toUpperCase()}`, x, y > 20 ? y - 10 : y + 20);
      });

      // Update FPS counter
      frameCount++;
      if (Date.now() - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    // 3. AI Emission Logic: Low Frequency to prevent Server Memory Crash
    intervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        // Optimization: Low quality JPEG (0.1) creates tiny payloads
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.1); 
        socketRef.current.emit('video-frame', { 
            frame: frameData, 
            cameraId: 'local-webcam' 
        });
      }
    }, 2500); // Sends 1 frame every 2.5 seconds
  };

  const stopCamera = () => {
    console.log('🛑 Shutting Down Node...');
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    socketRef.current?.disconnect();
    setIsStreaming(false);
    setDetections([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              SENTRY AI VISION
            </h1>
            <p className="text-slate-500 font-mono text-sm">
              NODE STATUS: {isStreaming ? <span className="text-emerald-500 underline">ENCRYPTED_LIVE</span> : 'DISCONNECTED'}
            </p>
          </div>
          <Button 
            onClick={isStreaming ? stopCamera : startCamera} 
            variant={isStreaming ? 'danger' : 'primary'}
            className="w-full md:w-auto px-8"
          >
            {isStreaming ? 'STOP MISSION' : 'START SURVEILLANCE'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-black border-slate-800 p-0 overflow-hidden relative shadow-2xl ring-1 ring-slate-800">
              <video ref={videoRef} className="hidden" />
              <canvas ref={canvasRef} className="w-full h-auto" />
              
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400 font-mono tracking-widest uppercase text-xs">Waiting for initialization...</p>
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <StatCard label="FEED FPS" value={fps} />
              <StatCard label="AI ANALYZED" value={processedFrames} />
              <StatCard label="OBJECTS" value={detections.length} />
              <StatCard label="LATENCY" value={isStreaming ? "OPTIMAL" : "---"} />
            </div>
          </div>

          <div className="space-y-4">
            <Card title="ACTIVE DETECTIONS" className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <div className="space-y-3">
                {detections.length === 0 ? (
                  <p className="text-slate-600 italic text-sm text-center py-4">Scanning area...</p>
                ) : (
                  detections.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-800/80 rounded-lg border border-slate-700/50">
                      <span className="font-bold text-emerald-400 text-xs tracking-wider uppercase">{d.class}</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                        {(d.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveCamera;