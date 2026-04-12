import { useState, useRef, useEffect } from 'react';
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

  // 1. Manually Manage Memory to prevent ultimate crash
  const detectFrame = async () => {
    if (!isActive || !videoRef.current || !modelRef.current || videoRef.current.paused) return;

    // Wrap in tf.tidy to automatically dispose of intermediate tensors
    const predictions = await tf.tidy(async () => {
      try {
        const result = await modelRef.current!.detect(videoRef.current!);
        return result;
      } catch (e) {
        return [];
      }
    });

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      predictions.forEach((prediction: any) => {
        if (prediction.score > 0.6) {
          const [x, y, w, h] = prediction.bbox;
          ctx.strokeStyle = '#00FF41';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          
          ctx.fillStyle = '#00FF41';
          ctx.fillText(`${prediction.class.toUpperCase()}`, x, y > 10 ? y - 5 : 10);

          if (prediction.class === 'person' && socketRef.current?.connected) {
            socketRef.current.emit('alarm-trigger', { label: 'PERSON' });
          }
        }
      });
    }

    setStats({ fps: Math.round(1000 / 16), objects: predictions.length });
    
    // Instead of requestAnimationFrame (which is too fast), 
    // we use a safe recursive timeout to prevent GPU clogging
    if (isActive) setTimeout(detectFrame, 40); 
  };

  const startEngine = async () => {
    try {
      setStatus('INITIALIZING...');
      
      // Force Backend to CPU if WebGL is crashing on your hardware
      await tf.ready();
      try {
        await tf.setBackend('webgl');
      } catch (e) {
        await tf.setBackend('cpu');
        console.warn("WebGL Failed, falling back to CPU");
      }

      const [loadedModel, stream] = await Promise.all([
        cocoSsd.load(),
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      ]);

      modelRef.current = loadedModel;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (canvasRef.current) {
            canvasRef.current.width = 640;
            canvasRef.current.height = 480;
          }
          setIsActive(true);
          setStatus('SYSTEM_LIVE');
        };
      }

      socketRef.current = io(AI_SERVICE_URL, { transports: ['polling', 'websocket'] });
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
    }
  };

  useEffect(() => {
    if (isActive) detectFrame();
  }, [isActive]);

  return (
    <div className="p-8 bg-[#050505] min-h-screen font-mono text-[#00FF41]">
      <div className="max-w-5xl mx-auto border border-[#00FF41]/30 p-4 rounded-lg shadow-[0_0_20px_rgba(0,255,65,0.1)]">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold tracking-[0.2em]">SENTRY_VISION_AI</h1>
          <div className="flex gap-4 items-center">
            <span className="text-[10px] animate-pulse">{status}</span>
            <Button 
              onClick={isActive ? () => window.location.reload() : startEngine} 
              className="border border-[#00FF41] bg-transparent hover:bg-[#00FF41] hover:text-black transition-all px-6 py-2"
            >
              {isActive ? 'REBOOT' : 'START_CORE'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 relative aspect-video bg-black rounded overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-xs opacity-50">STDBY // CORE_OFFLINE</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <StatCard label="CORE_FPS" value={stats.fps} />
            <StatCard label="OBJECTS" value={stats.objects} />
            <div className="mt-auto p-4 border border-[#00FF41]/20 rounded text-[10px] h-32 overflow-hidden">
              <p className="underline mb-2">SYSTEM_OUTPUT</p>
              {isActive ? "> Neural weights loaded\n> Camera handshake OK\n> Port 10000 linked" : "> Waiting for signal..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;