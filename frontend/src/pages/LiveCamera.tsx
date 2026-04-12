import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import AlertToast from '../components/AlertToast';
// 1. IMPORT YOUR CONFIG HERE
import { SOCKET_URL } from '../config'; 

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
      if (permission === 'granted') {
        new Notification('✅ Notifications Enabled', { body: 'You will receive security alerts' });
      }
    }
  };

  const startCamera = async () => {
    try {
      if (Notification.permission === 'default') await requestNotifications();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
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

  const connectSocket = () => {
    // 2. USE THE SOCKET_URL VARIABLE INSTEAD OF LOCALHOST STRING
    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to:', SOCKET_URL);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      setDetections(data.detections || []);
      setProcessedFrames(prev => prev + 1);
    });

    socketRef.current.on('alert-triggered', (data) => {
      console.log('🚨 ALERT:', data.alert.ruleName);
      
      const alertWithId = { ...data.alert, id: Date.now(), priority: data.priority };
      setActiveAlerts(prev => [...prev, alertWithId]);
      
      if (hasInteractedRef.current && (data.priority === 'critical' || data.alert.ruleName.includes('Person'))) {
        playAlarm();
      }
      
      if (Notification.permission === 'granted') {
        new Notification(`${data.priority === 'critical' ? '🔴' : '⚠️'} ${data.alert.ruleName}`, {
          body: data.alert.message,
          requireInteraction: data.priority === 'critical'
        });
      }
    });
  };

  const playAlarm = () => {
    console.log('🔊 Playing alarm');
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = i % 2 === 0 ? 900 : 700;
          osc.type = 'square';
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch (e) { console.error(e); }
      }, i * 200);
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

  const getThreatColor = (level: string) => {
    if (level === 'critical') return '#ef4444';
    if (level === 'warning') return '#f59e0b';
    return '#3b82f6';
  };

  const startProcessing = () => {
    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      lastDetectionsRef.current.forEach((det) => {
        const scaleX = canvasRef.current!.width / 416;
        const scaleY = canvasRef.current!.height / 416;
        const x1 = det.bbox.x1 * scaleX;
        const y1 = det.bbox.y1 * scaleY;
        const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
        const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

        const level = getThreatLevel(det.class);
        const color = getThreatColor(level);

        ctx.strokeStyle = color;
        ctx.lineWidth = level === 'critical' ? 4 : 2;
        ctx.strokeRect(x1, y1, w, h);

        if (det.class === 'person') {
          const alpha = 0.2 + 0.2 * Math.sin(Date.now() / 150);
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.fillRect(x1, y1, w, h);
        }

        const label = `${det.class} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 16px Arial';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
        ctx.fillStyle = 'white';
        ctx.fillText(label, x1 + 5, y1 - 7);
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
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.6);
        socketRef.current.emit('video-frame', { frame: frameData, cameraId: 'webcam-01' });
      }
    }, 1000);
  };

  const criticalDetections = detections.filter(d => getThreatLevel(d.class) === 'critical');
  const warningDetections = detections.filter(d => getThreatLevel(d.class) === 'warning');

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {activeAlerts.map((alert) => (
          <AlertToast 
            key={alert.id} 
            alert={alert} 
            onClose={() => setActiveAlerts(prev => prev.filter(a => a.id !== alert.id))} 
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">🎥 Live Security Feed</h1>
            <p className="text-slate-400">AI-Powered Threat Detection</p>
          </div>
          <div className="flex gap-4">
            {notificationPermission !== 'granted' && (
              <Button onClick={requestNotifications} variant="secondary">
                🔔 Enable Alerts
              </Button>
            )}
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
            <StatCard icon="🔄" value={processedFrames} label="Frames" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="relative overflow-hidden bg-black p-0">
              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} className="w-full h-auto block" style={{ maxHeight: '70vh' }} />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <p className="text-slate-400">Camera Offline</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="🎯 Live Detections">
              {detections.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Scanning...</p>
              ) : (
                <div className="space-y-2">
                  {detections.map((d, i) => {
                    const level = getThreatLevel(d.class);
                    return (
                      <div 
                        key={i} 
                        className={`flex justify-between items-center p-2 rounded ${
                          level === 'critical' ? 'bg-red-900/40 border border-red-500' :
                          level === 'warning' ? 'bg-yellow-900/30 border border-yellow-500' :
                          'bg-slate-800'
                        }`}
                      >
                        <span className="capitalize">
                          {level === 'critical' ? '🔴' : level === 'warning' ? '⚠️' : 'ℹ️'} {d.class}
                        </span>
                        <Badge variant={level === 'critical' ? 'error' : level === 'warning' ? 'warning' : 'info'}>
                          {(d.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveCamera;