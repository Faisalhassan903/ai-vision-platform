import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import AlertToast from '../components/AlertToast';

// 1. IMPORT BOTH URLS
import { SOCKET_URL, AI_SERVICE_URL } from '../config'; 

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

const THREAT_LEVELS = {
  critical: ['knife', 'scissors', 'baseball bat', 'tennis racket', 'bottle', 'wine glass', 'fork', 'spoon', 'person'],
  warning: ['backpack', 'handbag', 'suitcase', 'umbrella', 'tie', 'skateboard', 'surfboard', 'sports ball'],
  info: ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 'bench', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'book', 'clock', 'vase', 'teddy bear']
};

function LiveCamera() {
  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionsRef = useRef<Detection[]>([]);
  const hasInteractedRef = useRef(false);

  // --- STATE (The missing part that caused the ReferenceError) ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    return () => stopCamera();
  }, []);

  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const connectSocket = () => {
    // Connect specifically to the AI URL to avoid the 404
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ AI Service Connected:', AI_SERVICE_URL);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      setDetections(data.detections || []);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('alert-triggered', (data) => {
      const alertWithId = { ...data.alert, id: Date.now(), priority: data.priority };
      setActiveAlerts(prev => [...prev, alertWithId]);
      if (hasInteractedRef.current && data.priority === 'critical') playAlarm();
    });
  };

  const startCamera = async () => {
    try {
      if (Notification.permission === 'default') await requestNotifications();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
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
      alert('Camera error: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    setIsStreaming(false);
    setDetections([]);
  };

  const getThreatLevel = (objectClass: string): 'critical' | 'warning' | 'info' => {
    if (THREAT_LEVELS.critical.includes(objectClass)) return 'critical';
    if (THREAT_LEVELS.warning.includes(objectClass)) return 'warning';
    return 'info';
  };

  const startProcessing = () => {
    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // --- Draw Detections ---
      lastDetectionsRef.current.forEach((det) => {
        const scaleX = canvasRef.current!.width / 416;
        const scaleY = canvasRef.current!.height / 416;
        const x1 = det.bbox.x1 * scaleX;
        const y1 = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        ctx.strokeStyle = getThreatLevel(det.class) === 'critical' ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, w, h);
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

    intervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.5);
        socketRef.current.emit('video-frame', { frame: frameData, cameraId: 'webcam-01' });
      }
    }, 1000);
  };

  const playAlarm = () => { /* sound logic */ };

  // Helpers for the UI
  const criticalDetections = detections.filter(d => getThreatLevel(d.class) === 'critical');
  const warningDetections = detections.filter(d => getThreatLevel(d.class) === 'warning');

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      {/* (Keep your UI return logic exactly as it was) */}
      <div className="max-w-7xl mx-auto">
         <div className="flex justify-between items-center mb-8">
           <h1 className="text-3xl font-bold">🎥 Live Security Feed</h1>
           <div className="flex gap-4">
             {!isStreaming ? (
               <Button onClick={startCamera} variant="primary">▶️ Start Camera</Button>
             ) : (
               <Button onClick={stopCamera} variant="danger">⏹️ Stop Camera</Button>
             )}
           </div>
         </div>

         {isStreaming && (
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
             <StatCard icon="📊" value={fps} label="FPS" />
             <StatCard icon="🎯" value={detections.length} label="Objects" />
             <StatCard icon="🔴" value={criticalDetections.length} label="Critical" />
             <StatCard icon="⚠️" value={warningDetections.length} label="Warnings" />
           </div>
         )}

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
             <Card className="relative overflow-hidden bg-black p-0">
               <video ref={videoRef} className="hidden" playsInline muted />
               <canvas ref={canvasRef} className="w-full h-auto block" />
             </Card>
           </div>
           <Card title="🎯 Detections">
             {detections.map((d, i) => (
               <div key={i} className="p-2 border-b border-slate-700">{d.class}</div>
             ))}
           </Card>
         </div>
      </div>
    </div>
  );
}

export default LiveCamera;