import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../config';

// ── TUNING ────────────────────────────────────────────────────────────────────
const DETECTION_EVERY_N_FRAMES = 5;   // Run model every 5 frames
const ALERT_THRESHOLD        = 0.60;  // Minimum confidence to trigger alert
const ALERT_COOLDOWN_MS      = 15000; // 15s between alerts (prevent spam)

const LiveCamera: React.FC = () => {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const modelRef        = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const rafRef          = useRef<number | null>(null);
  const frameCountRef   = useRef<number>(0);
  const isRunningRef    = useRef<boolean>(false);
  const lastAlertRef    = useRef<number>(0);   // timestamp of last alert sent
  const isSendingRef    = useRef<boolean>(false); // prevent concurrent POSTs

  const [isLive,  setIsLive]  = useState(false);
  const [status,  setStatus]  = useState('IDLE');
  const [objects, setObjects] = useState(0);

  // ── ALARM SOUND ─────────────────────────────────────────────────────────────
  // Simple browser beep — no external file needed
  const playAlarm = useCallback(() => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch { /* AudioContext blocked — silent fail */ }
  }, []);

  // ── STOP CAMERA ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsLive(false);
    setStatus('STOPPED');
    setObjects(0);
    console.log('🔴 Camera stopped');
  }, []);

  // ── SEND ALERT TO BACKEND ────────────────────────────────────────────────────
  // Called only when a person is detected above threshold + cooldown passed
  const sendAlert = useCallback(async (predictions: cocoSsd.DetectedObject[]) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
    if (!person) { isSendingRef.current = false; return; }

    const now = Date.now();
    if (now - lastAlertRef.current < ALERT_COOLDOWN_MS) {
      isSendingRef.current = false;
      return;
    }

    lastAlertRef.current = now;
    setStatus('⚠ INTRUDER DETECTED');
    playAlarm();

    try {
      await axios.post(`${API_BASE_URL}/api/alerts`, {
        ruleName:   'UNAUTHORIZED_ENTRY',
        priority:   'critical',
        message:    `Human presence detected. Confidence: ${Math.round(person.score * 100)}%`,
        cameraName: 'Sentry_Node_01',
        analytics: {
          device_id:      'SENTRY_ALPHA',
          primary_target: 'human',
          confidence_avg:  person.score,
        },
        detections: predictions.map(d => ({
          class:      d.class,
          confidence: d.score,
          bbox:       { x1: d.bbox[0], y1: d.bbox[1], x2: d.bbox[0] + d.bbox[2], y2: d.bbox[1] + d.bbox[3] }
        })),
      });

      console.log('✅ Alert saved to DB');

    } catch (err: any) {
      console.error('❌ Alert POST failed:', err.message);
    } finally {
      isSendingRef.current = false;
      // Reset status back after 5s
      setTimeout(() => {
        if (isRunningRef.current) setStatus('LIVE');
      }, 5000);
    }
  }, [playAlarm]);

  // ── DRAW DETECTIONS ON CANVAS ────────────────────────────────────────────────
  const drawDetections = (
    ctx: CanvasRenderingContext2D,
    predictions: cocoSsd.DetectedObject[],
    w: number,
    h: number
  ) => {
    ctx.clearRect(0, 0, w, h);

    predictions.forEach(p => {
      const [x, y, bw, bh] = p.bbox;
      const isPerson  = p.class === 'person';
      const color     = isPerson ? '#FF3333' : '#00FF88';
      const label     = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`;

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth   = isPerson ? 3 : 2;
      ctx.strokeRect(x, y, bw, bh);

      // Corner accents
      const cl = 12;
      ctx.lineWidth = isPerson ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x + cl, y);       ctx.lineTo(x, y);       ctx.lineTo(x, y + cl);
      ctx.moveTo(x + bw - cl, y);  ctx.lineTo(x + bw, y);  ctx.lineTo(x + bw, y + cl);
      ctx.moveTo(x, y + bh - cl);  ctx.lineTo(x, y + bh);  ctx.lineTo(x + cl, y + bh);
      ctx.moveTo(x + bw - cl, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - cl);
      ctx.stroke();

      // Label
      ctx.font = 'bold 12px "Courier New", monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = isPerson ? 'rgba(255,51,51,0.9)' : 'rgba(0,255,136,0.9)';
      ctx.fillRect(x, y - 22, tw + 10, 20);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 5, y - 6);
    });
  };

  // ── DETECTION LOOP ───────────────────────────────────────────────────────────
  // KEY: No tf.tidy() around async code — model.detect() manages its own memory
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    frameCountRef.current++;

    if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const model  = modelRef.current;

      if (video && canvas && model && video.readyState === 4 && video.videoWidth > 0) {
        try {
          const predictions = await model.detect(video, 6, 0.35);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            drawDetections(ctx, predictions, canvas.width, canvas.height);
          }

          setObjects(predictions.length);

          // ── RULE ENGINE ──────────────────────────────────────────────────────
          // Person detected above threshold → trigger full alert pipeline
          const personFound = predictions.some(
            p => p.class === 'person' && p.score > ALERT_THRESHOLD
          );

          if (personFound) {
            sendAlert(predictions); // async, non-blocking
          }

        } catch (err) {
          console.warn('Frame skipped:', err);
        }
      }
    }

    if (isRunningRef.current) {
      rafRef.current = requestAnimationFrame(detectionLoop);
    }
  }, [sendAlert]);

  // ── START CAMERA ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (isRunningRef.current) return;

    try {
      setStatus('STARTING...');

      // TF backend — WebGL preferred, CPU fallback
      try { await tf.setBackend('webgl'); }
      catch { await tf.setBackend('cpu'); }
      await tf.ready();
      console.log('✅ TF backend:', tf.getBackend());

      // Camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) throw new Error('Video ref not ready');
      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const v = videoRef.current!;
        v.onloadedmetadata = () => v.play().then(resolve).catch(reject);
        v.onerror = reject;
      });

      // Model — reuse cached instance across stop/start
      if (!modelRef.current) {
        setStatus('LOADING MODEL...');
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      }

      isRunningRef.current = true;
      frameCountRef.current = 0;
      setIsLive(true);
      setStatus('LIVE');

      rafRef.current = requestAnimationFrame(detectionLoop);

    } catch (err: any) {
      console.error('Camera start failed:', err);
      setStatus(`ERROR: ${err.message}`);
      stopCamera();
    }
  };

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  // ── RENDER ───────────────────────────────────────────────────────────────────
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
            status.includes('INTRUDER') ? 'text-red-400 animate-pulse' :
            status === 'LIVE'           ? 'text-green-400' :
            status.includes('ERROR')    ? 'text-red-500'  :
            'text-slate-500'
          }`}>
            ◆ {status}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isLive && (
            <span className="text-xs text-slate-400">
              {objects} object{objects !== 1 ? 's' : ''} in frame
            </span>
          )}
          <Button
            onClick={isLive ? stopCamera : startCamera}
            className={`font-bold px-6 py-2 text-sm tracking-widest ${
              isLive
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : status === 'STARTING...' || status === 'LOADING MODEL...'
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-black'
            }`}
          >
            {status === 'STARTING...' || status === 'LOADING MODEL...'
              ? 'INITIALIZING...'
              : isLive ? '⏹ STOP' : '▶ START'}
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div className="max-w-5xl mx-auto">
        <div className="relative aspect-video rounded border border-slate-700 bg-black overflow-hidden">

          {/* Live badge */}
          {isLive && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              LIVE
            </div>
          )}

          {/* Alert flash overlay */}
          {status.includes('INTRUDER') && (
            <div className="absolute inset-0 z-20 border-4 border-red-500 animate-pulse pointer-events-none rounded" />
          )}

          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          />

          {/* Idle */}
          {!isLive && status === 'IDLE' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-slate-600 text-5xl mb-4">◎</div>
              <p className="text-slate-500 text-sm tracking-widest">PRESS START TO INITIALIZE</p>
            </div>
          )}

          {/* Loading */}
          {(status === 'STARTING...' || status === 'LOADING MODEL...') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="w-48 h-1 bg-slate-800 rounded overflow-hidden mb-3">
                <div className="h-full bg-green-500 animate-pulse w-full" />
              </div>
              <p className="text-green-500 text-xs tracking-widest animate-pulse">{status}</p>
            </div>
          )}

          {/* Error */}
          {status.includes('ERROR') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-red-500 text-4xl mb-3">⚠</div>
              <p className="text-red-400 text-sm text-center px-4">{status}</p>
              <button
                onClick={() => setStatus('IDLE')}
                className="mt-4 text-xs text-slate-400 underline hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="flex justify-between text-[10px] text-slate-600 mt-2 px-1">
          <span>BACKEND: {tf.getBackend()?.toUpperCase() || 'N/A'}</span>
          <span>MODEL: COCO-SSD lite_mobilenet_v2</span>
          <span>THRESHOLD: {ALERT_THRESHOLD * 100}% | COOLDOWN: {ALERT_COOLDOWN_MS / 1000}s</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;