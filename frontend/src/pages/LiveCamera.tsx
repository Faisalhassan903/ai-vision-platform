import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button, StatCard } from '../components/ui';
import { AI_SERVICE_URL } from '../config';

const LiveCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const socketRef = useRef<any>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('OFFLINE');
  const [stats, setStats] = useState({ fps: 0, objects: 0 });

  // 1. CLEAN ASYNC DETECTION ENGINE
  const detectFrame = async () => {
    if (!isActive || !videoRef.current || !modelRef.current) return;

    // Start manual memory scope for async work
    tf.engine().startScope();

    try {
      // Perform detection (Async call)
      const predictions = await modelRef.current.detect(videoRef.current, 20, 0.5);
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        predictions.forEach((prediction) => {
          const [x, y, w, h] = prediction.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          
          ctx.fillStyle = '#00FF41';
          ctx.font = '14px JetBrains Mono, monospace';
          ctx.fillText(
            `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`, 
            x, y > 10 ? y - 5 : 10
          );

          if (prediction.class === 'person' && socketRef.current?.connected) {
            socketRef.current.emit('alarm-trigger', { label: 'PERSON_DETECTED' });
          }
        });
        
        setStats(prev => ({ ...prev, objects: predictions.length }));
      }
    } catch (err) {
      console.error("Inference Error:", err);
    } finally {
      // End scope and dispose of all tensors created during this frame
      tf.engine().endScope();
    }

    // Recursive call with safety buffer
    if (isActive) {
      requestAnimationFrame(detectFrame);
    }
  };

  const startEngine = async () => {
    try {
      setStatus('WARMING_UP...');
      await tf.ready();
      
      // Use WebGL for speed, but fallback to CPU if the browser/hardware blocks it
      try {
        await tf.setBackend('webgl');
      } catch (e) {
        await tf.setBackend('cpu');
      }

      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
        navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, frameRate: { ideal: 24 } } 
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
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 10 
      });

    } catch (err) {
      console.error("Setup Error:", err);
      setStatus('CORE_FAILURE');
    }
  };

  useEffect(() => {
    if (isActive) detectFrame();
    return () => { setIsActive(false); };
  }, [isActive]);

  return (
    <div className="p-8 bg-[#0a0a0a] min-h-screen font-mono text-[#00FF41]">
      <div className="max-w-6xl mx-auto border border-[#00FF41]/20 p-6 rounded-sm bg-black shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tighter">SENTRY_CORE_V5</h1>
            <p className="text-[10px] opacity-50 uppercase tracking-widest">{status} // SECURE_UPLINK_READY</p>
          </div>
          <Button 
            onClick={isActive ? () => window.location.reload() : startEngine} 
            className="border-2 border-[#00FF41] hover:bg-[#00FF41] hover:text-black font-bold px-10 py-4 transition-all"
          >
            {isActive ? 'REBOOT_SYSTEM' : 'INIT_AI_CORE'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 relative bg-[#111] rounded border border-white/5 overflow-hidden shadow-inner">
            <video ref={videoRef} className="w-full h-auto opacity-40 grayscale" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-8 h-1 bg-[#00FF41]/20 mx-auto animate-pulse" />
                  <p className="text-[10px] tracking-widest opacity-30">STANDING_BY_FOR_INPUT</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <StatCard label="CORE_OBJECTS" value={stats.objects} />
            <div className="flex-1 bg-white/5 border border-white/10 p-4 rounded text-[11px] overflow-hidden">
              <p className="text-white/30 border-b border-white/10 mb-3 pb-1">KERNEL_LOGS</p>
              <div className="space-y-1 opacity-70">
                <p>&gt; TF_BACKEND: {tf.getBackend()}</p>
                <p>&gt; SOCKET: {socketRef.current?.connected ? 'ACTIVE' : 'IDLE'}</p>
                <p>&gt; MEMORY: {Math.round(tf.memory().numBytes / 1024 / 1024)}MB</p>
                {stats.objects > 0 && <p className="animate-pulse">&gt; EVENT: TARGET_ACQUIRED</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;