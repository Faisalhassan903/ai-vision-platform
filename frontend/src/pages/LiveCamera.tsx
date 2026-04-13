import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '../components/ui';
import { useAlerts } from '../hooks/useAlerts';

const ALERT_THRESHOLD = 0.60;
const COOLDOWN_MS = 15000;
const DETECTION_EVERY_N_FRAMES = 5;

const LiveCamera: React.FC = () => {
  const { triggerNewAlert } = useAlerts();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastAlertRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  const [isLive, setIsLive] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [securityStatus, setSecurityStatus] = useState('DISARMED');
  const [detectionCount, setDetectionCount] = useState(0);

  // ─── STOP CAMERA ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setIsLive(false);
    setInitStatus('idle');
    setSecurityStatus('DISARMED');
    setDetectionCount(0);
    console.log('🔴 Camera stopped');
  }, []);

  // ─── DETECTION LOOP ───────────────────────────────────────────────────────────
  // CRITICAL FIX: Never wrap async detection inside tf.tidy() or tf.engine().startScope()
  // model.detect() manages its own tensor memory internally
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    frameCountRef.current += 1;

    if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      if (video && canvas && model && video.readyState === 4 && video.videoWidth > 0) {
        try {
          const predictions = await model.detect(video, 6, 0.35);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            predictions.forEach(p => {
              const [x, y, w, h] = p.bbox;
              const isPerson = p.class === 'person';
              const color = isPerson ? '#FF3333' : '#00FF88';
              const confidence = Math.round(p.score * 100);

              ctx.strokeStyle = color;
              ctx.lineWidth = isPerson ? 3 : 2;
              ctx.strokeRect(x, y, w, h);

              // Corner accents
              const cl = 14;
              ctx.lineWidth = isPerson ? 4 : 2;
              ctx.beginPath();
              ctx.moveTo(x + cl, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cl);
              ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
              ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h);
              ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
              ctx.stroke();

              // Label
              const label = `${p.class.toUpperCase()} ${confidence}%`;
              ctx.font = 'bold 12px "Courier New", monospace';
              const tw = ctx.measureText(label).width;
              ctx.fillStyle = isPerson ? 'rgba(255,51,51,0.9)' : 'rgba(0,255,136,0.9)';
              ctx.fillRect(x, y - 22, tw + 10, 20);
              ctx.fillStyle = '#000';
              ctx.fillText(label, x + 5, y - 6);
            });

            setDetectionCount(predictions.length);

            // ── ALERT TRIGGER ─────────────────────────────────────────────────
            const personTarget = predictions.find(
              p => p.class === 'person' && p.score > ALERT_THRESHOLD
            );

            if (personTarget && Date.now() - lastAlertRef.current > COOLDOWN_MS) {
              lastAlertRef.current = Date.now();
              setSecurityStatus('⚠ INTRUDER DETECTED');

              triggerNewAlert({
                ruleName: 'UNAUTHORIZED_ENTRY',
                priority: 'critical',
                message: `Human presence detected. Confidence: ${Math.round(personTarget.score * 100)}%`,
                cameraName: 'Sentry_Node_01',
                analytics: {
                  device_id: 'SENTRY_ALPHA',
                  primary_target: 'human',
                  confidence_avg: personTarget.score,
                },
                detections: predictions.map(d => ({
                  class: d.class,
                  confidence: d.score,
                })),
              }).catch(e => console.error('Alert send failed:', e));

              setTimeout(() => {
                if (isRunningRef.current) setSecurityStatus('ACTIVE — MONITORING');
              }, 5000);
            }
          }
        } catch (err) {
          console.warn('Detection frame skipped:', err);
        }
      }
    }

    if (isRunningRef.current) {
      rafRef.current = requestAnimationFrame(() => { detectionLoop(); });
    }
  }, [triggerNewAlert]);

  // ─── START CAMERA ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (isRunningRef.current) return;

    try {
      setInitStatus('loading');
      setSecurityStatus('BOOTING...');

      // Backend: WebGL preferred, fallback to CPU
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu');
      }
      await tf.ready();
      console.log('✅ TF backend:', tf.getBackend());

      // Camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) throw new Error('Video element not ready');
      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const v = videoRef.current!;
        v.onloadedmetadata = () => { v.play().then(resolve).catch(reject); };
        v.onerror = reject;
      });

      // Load model (reuse if already loaded)
      setSecurityStatus('LOADING MODEL...');
      if (!modelRef.current) {
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      }
      console.log('✅ Model loaded');

      isRunningRef.current = true;
      frameCountRef.current = 0;
      setIsLive(true);
      setInitStatus('active');
      setSecurityStatus('ACTIVE — MONITORING');

      rafRef.current = requestAnimationFrame(() => { detectionLoop(); });

    } catch (err: any) {
      console.error('Camera start failed:', err);
      setInitStatus('error');
      setSecurityStatus(`ERROR: ${err.message || 'Start failed'}`);
      stopCamera();
    }
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white font-mono">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter">
            <span className="text-red-500">SENTRY</span>
            <span className="text-white"> HUB v4.0</span>
          </h1>
          <p className={`text-xs mt-1 ${
            securityStatus.includes('INTRUDER') ? 'text-red-400 animate-pulse' :
            initStatus === 'active' ? 'text-green-400' :
            initStatus === 'error' ? 'text-red-500' :
            'text-slate-500'
          }`}>
            ◆ {securityStatus}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {initStatus === 'active' && (
            <span className="text-xs text-slate-400">
              {detectionCount} object{detectionCount !== 1 ? 's' : ''} in frame
            </span>
          )}
          <Button
            onClick={isLive ? stopCamera : startCamera}
            disabled={initStatus === 'loading'}
            className={`font-bold px-6 py-2 text-sm tracking-widest ${
              isLive
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : initStatus === 'loading'
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-black'
            }`}
          >
            {initStatus === 'loading' ? 'INITIALIZING...' : isLive ? '⏹ STOP' : '▶ START'}
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div className="max-w-5xl mx-auto">
        <div className="relative aspect-video rounded border border-slate-700 bg-black overflow-hidden">
          {isLive && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              LIVE
            </div>
          )}

          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

          {initStatus === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-slate-600 text-5xl mb-4">◎</div>
              <p className="text-slate-500 text-sm tracking-widest">PRESS START TO INITIALIZE</p>
            </div>
          )}

          {initStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="w-48 h-1 bg-slate-800 rounded overflow-hidden mb-3">
                <div className="h-full bg-green-500 animate-pulse" style={{ width: '100%' }} />
              </div>
              <p className="text-green-500 text-xs tracking-widest animate-pulse">{securityStatus}</p>
            </div>
          )}

          {initStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-red-500 text-4xl mb-3">⚠</div>
              <p className="text-red-400 text-sm text-center px-4">{securityStatus}</p>
              <button onClick={() => setInitStatus('idle')} className="mt-4 text-xs text-slate-400 underline hover:text-white">
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-between text-[10px] text-slate-600 mt-2 px-1">
          <span>BACKEND: {tf.getBackend()?.toUpperCase() || 'N/A'}</span>
          <span>MODEL: COCO-SSD lite_mobilenet_v2</span>
          <span>ALERT THRESHOLD: {ALERT_THRESHOLD * 100}%</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;