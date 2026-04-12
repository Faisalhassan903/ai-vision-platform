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

const THREAT_LEVELS = {
  critical: ['knife', 'scissors', 'baseball bat', 'person'],
  warning: ['backpack', 'handbag', 'suitcase'],
  info: ['cell phone', 'laptop', 'chair']
};

function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionsRef = useRef<Detection[]>([]);
  const hasInteractedRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission);
    return () => stopCamera();
  }, []);

  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  const connectSocket = () => {
    console.log('🔌 Attempting Socket Connection to:', AI_SERVICE_URL);
    
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false, 
      reconnection: true,
      reconnectionAttempts: 10
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ [DEBUG] Connected to AI Service. Socket ID:', socketRef.current?.id);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ [DEBUG] Connection Error:', err.message);
    });

    socketRef.current.on('detections', (data) => {
      // DEBUG: Verify data structure
      const list = Array.isArray(data) ? data : (data.detections || []);
      if (list.length > 0) {
        console.log(`🎯 [DEBUG] Received ${list.length} detections:`, list[0].class);
      }
      setDetections(list);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('alert-triggered', (data) => {
      console.log('🚨 [DEBUG] Alert Triggered:', data);
      const alertWithId = { ...data.alert, id: Date.now(), priority: data.priority };
      setActiveAlerts(prev => [...prev, alertWithId]);
    });
  };

  const startCamera = async () => {
    console.log('📷 Initializing MediaDevices...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            console.log('🎥 Video stream playing.');
            hasInteractedRef.current = true;
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
    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // 1. Clear and Draw Video
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // 2. Draw Detections
      lastDetectionsRef.current.forEach((det) => {
        // Change these scales based on your YOLO input size (usually 416 or 640)
        const scaleX = canvasRef.current!.width / 416;
        const scaleY = canvasRef.current!.height / 416;

        const x1 = det.bbox.x1 * scaleX;
        const y1 = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, w, h);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${det.class} ${Math.round(det.confidence * 100)}%`, x1, y1 - 5);
      });

      fpsCounter++;
      if (Date.now() - lastFpsUpdate >= 1000) {
        setFps(fpsCounter);
        fpsCounter = 0;
        lastFpsUpdate = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    // 3. Frame Emission Logic
    intervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.4);
        // DEBUG: Log first few emissions
        if (processedFrames < 5) console.log('📤 [DEBUG] Emitting frame to AI...');
        socketRef.current.emit('video-frame', { 
            frame: frameData, 
            cameraId: 'webcam-01' 
        });
      }
    }, 1000); // 1 FPS for stability on free tier
  };

  const stopCamera = () => {
    console.log('🛑 Stopping stream...');
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    setIsStreaming(false);
  };

  const getThreatLevel = (c: string) => THREAT_LEVELS.critical.includes(c) ? 'critical' : 'info';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {activeAlerts.map(a => (
          <AlertToast key={a.id} alert={a} onClose={() => setActiveAlerts(p => p.filter(x => x.id !== a.id))} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">🎥 AI Security Console</h1>
            <p className="text-slate-400">Status: {isStreaming ? '🟢 Online' : '⚪ Offline'}</p>
          </div>
          <Button onClick={isStreaming ? stopCamera : startCamera} variant={isStreaming ? 'danger' : 'primary'}>
            {isStreaming ? 'Stop Feed' : 'Start Feed'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-black p-0 overflow-hidden relative border-2 border-slate-700">
              <video ref={videoRef} className="hidden" />
              <canvas ref={canvasRef} className="w-full h-auto" />
            </Card>
            
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="FPS" value={fps} />
              <StatCard label="Objects" value={detections.length} />
              <StatCard label="Processed" value={processedFrames} />
              <StatCard label="AI Latency" value="Stable" />
            </div>
          </div>

          <Card title="🎯 Live Detection List">
            <div className="space-y-2">
              {detections.length === 0 ? <p className="text-slate-500 italic">No objects found</p> : 
                detections.map((d, i) => (
                  <div key={i} className="flex justify-between bg-slate-800 p-2 rounded">
                    <span>{d.class}</span>
                    <Badge>{(d.confidence * 100).toFixed(0)}%</Badge>
                  </div>
                ))
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default LiveCamera;