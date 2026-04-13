import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../config';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const DETECTION_EVERY_N_FRAMES = 5;
const ALERT_COOLDOWN_MS        = 15000;
const POST_TIMEOUT_MS          = 30000; // 30s — enough for Render cold start
const KEEPALIVE_INTERVAL_MS    = 8 * 60 * 1000; // ping every 8 min to prevent sleep

const LiveCamera: React.FC = () => {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const modelRef       = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number | null>(null);
  const keepAliveRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef  = useRef<number>(0);
  const isRunningRef   = useRef<boolean>(false);
  const lastAlertRef   = useRef<number>(0);
  const isSendingRef   = useRef<boolean>(false);
  const rulesRef       = useRef<any[]>([]);
  const backendReadyRef = useRef<boolean>(false); // tracks if backend responded

  const [isLive,       setIsLive]       = useState(false);
  const [status,       setStatus]       = useState('IDLE');
  const [objects,      setObjects]      = useState(0);
  const [lastAlert,    setLastAlert]    = useState<string | null>(null);
  const [backendState, setBackendState] = useState<'unknown' | 'waking' | 'ready' | 'offline'>('unknown');

  // ── WAKE UP RENDER BACKEND ───────────────────────────────────────────────────
  const wakeBackend = useCallback(async () => {
    setBackendState('waking');
    try {
      await axios.get(`${API_BASE_URL}/health`, { timeout: 60000 }); // 60s for cold start
      backendReadyRef.current = true;
      setBackendState('ready');
      console.log('✅ Backend awake');
    } catch {
      backendReadyRef.current = false;
      setBackendState('offline');
      console.warn('⚠️ Backend did not respond — alerts will retry');
    }
  }, []);

  // ── KEEP ALIVE PING ──────────────────────────────────────────────────────────
  const startKeepAlive = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = setInterval(async () => {
      try {
        await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
        backendReadyRef.current = true;
        setBackendState('ready');
      } catch {
        backendReadyRef.current = false;
        setBackendState('offline');
      }
    }, KEEPALIVE_INTERVAL_MS);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  // ── LOAD RULES ───────────────────────────────────────────────────────────────
  const loadRules = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/alerts/rules`, { timeout: 10000 });
      const rules = res.data?.rules || res.data || [];
      rulesRef.current = rules;
      console.log(`✅ Loaded ${rules.length} rules`);
    } catch {
      rulesRef.current = [{
        ruleName:    'DEFAULT_PERSON_DETECTION',
        targetClass: 'person',
        threshold:   0.50,
        priority:    'critical',
        enabled:     true,
      }];
      console.warn('⚠️ Using default rule: person > 50%');
    }
  }, []);

  // ── EVALUATE RULES ───────────────────────────────────────────────────────────
  const evaluateRules = useCallback((predictions: cocoSsd.DetectedObject[]) => {
    for (const rule of rulesRef.current) {
      if (rule.enabled === false) continue;
      const targetClass = rule.targetClass || rule.target_class || rule.class || 'person';
      const threshold   = rule.threshold   || rule.confidence  || 0.50;
      const match = predictions.find(
        p => p.class.toLowerCase() === targetClass.toLowerCase() && p.score >= threshold
      );
      if (match) return { rule, detection: match, allDetections: predictions };
    }
    return null;
  }, []);

  // ── ALARM ─────────────────────────────────────────────────────────────────────
  const playAlarm = useCallback(() => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch { /* blocked */ }
  }, []);

  // ── STOP CAMERA ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    stopKeepAlive();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const c = canvasRef.current.getContext('2d');
      if (c) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsLive(false);
    setStatus('STOPPED');
    setObjects(0);
  }, [stopKeepAlive]);

  // ── SEND ALERT ────────────────────────────────────────────────────────────────
  const sendAlert = useCallback(async (
    rule: any,
    detection: cocoSsd.DetectedObject,
    allDetections: cocoSsd.DetectedObject[]
  ) => {
    if (isSendingRef.current) return;

    const now = Date.now();
    if (now - lastAlertRef.current < ALERT_COOLDOWN_MS) return;

    isSendingRef.current = true;
    lastAlertRef.current = now;

    // Safety release after 35s no matter what
    const safetyTimer = setTimeout(() => {
      isSendingRef.current = false;
    }, 35000);

    setStatus('⚠ INTRUDER DETECTED');
    playAlarm();

    const payload = {
      ruleName:   rule.ruleName   || rule.name || 'DETECTION_RULE',
      priority:   rule.priority   || 'critical',
      message:    `${detection.class.toUpperCase()} detected. Confidence: ${Math.round(detection.score * 100)}%`,
      cameraName: rule.cameraName || 'Sentry_Node_01',
      analytics: {
        device_id:      'SENTRY_ALPHA',
        primary_target:  detection.class,
        confidence_avg:  detection.score,
      },
      detections: allDetections.map(d => ({
        class:      d.class,
        confidence: d.score,
        bbox: {
          x1: d.bbox[0],
          y1: d.bbox[1],
          x2: d.bbox[0] + d.bbox[2],
          y2: d.bbox[1] + d.bbox[3],
        },
      })),
    };

    try {
      // If backend was offline, try waking it first
      if (!backendReadyRef.current) {
        setLastAlert('⏳ Waking backend...');
        await wakeBackend();
      }

      const res = await axios.post(`${API_BASE_URL}/api/alerts`, payload, {
        timeout: POST_TIMEOUT_MS,
      });

      const alertId = res.data?.alert?._id || 'saved';
      backendReadyRef.current = true;
      setBackendState('ready');
      setLastAlert(`✅ Alert saved | ${rule.ruleName || 'RULE'} | ${Math.round(detection.score * 100)}% | ${alertId}`);
      console.log('✅ Alert saved:', alertId);

    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      setLastAlert(`❌ Alert failed: ${detail}`);
      console.error('❌ Alert POST failed:', detail);

      // Mark backend as offline so next attempt wakes it first
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        backendReadyRef.current = false;
        setBackendState('offline');
      }
    } finally {
      clearTimeout(safetyTimer);
      isSendingRef.current = false;
      setTimeout(() => {
        if (isRunningRef.current) setStatus('LIVE');
      }, 5000);
    }
  }, [playAlarm, wakeBackend]);

  // ── DRAW ──────────────────────────────────────────────────────────────────────
  const drawDetections = (ctx: CanvasRenderingContext2D, predictions: cocoSsd.DetectedObject[]) => {
    predictions.forEach(p => {
      const [x, y, w, h] = p.bbox;
      const isPerson = p.class === 'person';
      const color    = isPerson ? '#FF3333' : '#00FF88';
      const label    = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`;
      ctx.strokeStyle = color;
      ctx.lineWidth   = isPerson ? 3 : 2;
      ctx.strokeRect(x, y, w, h);
      const cl = 12;
      ctx.lineWidth = isPerson ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x + cl, y);         ctx.lineTo(x, y);         ctx.lineTo(x, y + cl);
      ctx.moveTo(x + w - cl, y);     ctx.lineTo(x + w, y);     ctx.lineTo(x + w, y + cl);
      ctx.moveTo(x, y + h - cl);     ctx.lineTo(x, y + h);     ctx.lineTo(x + cl, y + h);
      ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
      ctx.stroke();
      ctx.font = 'bold 12px "Courier New", monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = isPerson ? 'rgba(255,51,51,0.9)' : 'rgba(0,255,136,0.9)';
      ctx.fillRect(x, y - 22, tw + 10, 20);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 5, y - 6);
    });
  };

  // ── DETECTION LOOP ────────────────────────────────────────────────────────────
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;
    frameCountRef.current++;

    if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const model  = modelRef.current;

      if (video && canvas && model && video.readyState === 4 && video.videoWidth > 0) {
        try {
          const predictions = await model.detect(video, 6, 0.30);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawDetections(ctx, predictions);
          }
          setObjects(predictions.length);

          const match = evaluateRules(predictions);
          if (match) sendAlert(match.rule, match.detection, match.allDetections);

        } catch (err: any) {
          console.warn('Frame skipped:', err.message);
        }
      }
    }

    if (isRunningRef.current) {
      rafRef.current = requestAnimationFrame(detectionLoop);
    }
  }, [sendAlert, evaluateRules]);

  // ── START CAMERA ──────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (isRunningRef.current) return;
    try {
      isSendingRef.current  = false; // reset lock
      backendReadyRef.current = false;

      setStatus('WAKING BACKEND...');

      // Wake backend + load rules in parallel
      await Promise.all([wakeBackend(), loadRules()]);

      setStatus('STARTING...');
      try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
      await tf.ready();

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

      if (!modelRef.current) {
        setStatus('LOADING MODEL...');
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      }

      // Start keep-alive to prevent backend sleeping again
      startKeepAlive();

      isRunningRef.current  = true;
      frameCountRef.current = 0;
      setIsLive(true);
      setStatus('LIVE');
      rafRef.current = requestAnimationFrame(detectionLoop);

    } catch (err: any) {
      setStatus(`ERROR: ${err.message}`);
      stopCamera();
    }
  };

  useEffect(() => { return () => { stopCamera(); stopKeepAlive(); }; }, [stopCamera, stopKeepAlive]);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  const backendBadge = {
    unknown: { text: 'BACKEND: UNKNOWN',  cls: 'text-slate-500' },
    waking:  { text: 'BACKEND: WAKING…',  cls: 'text-yellow-400 animate-pulse' },
    ready:   { text: 'BACKEND: ONLINE',   cls: 'text-green-400' },
    offline: { text: 'BACKEND: OFFLINE',  cls: 'text-red-400' },
  }[backendState];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white font-mono">

      {/* Header */}
      <div className="max-w-5xl mx-auto flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter">
            <span className="text-red-500">SENTRY</span>
            <span className="text-white"> HUB v4.0</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className={`text-xs ${
              status.includes('INTRUDER') ? 'text-red-400 animate-pulse' :
              status === 'LIVE'           ? 'text-green-400' :
              status.includes('ERROR')    ? 'text-red-500'  : 'text-slate-500'
            }`}>◆ {status}</p>
            <span className={`text-[10px] ${backendBadge.cls}`}>| {backendBadge.text}</span>
          </div>
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
                : status.includes('ING')
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-black'
            }`}
          >
            {status.includes('ING') ? status : isLive ? '⏹ STOP' : '▶ START'}
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

          {status.includes('INTRUDER') && (
            <div className="absolute inset-0 z-20 border-4 border-red-500 animate-pulse pointer-events-none rounded" />
          )}

          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

          {!isLive && status === 'IDLE' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-slate-600 text-5xl mb-4">◎</div>
              <p className="text-slate-500 text-sm tracking-widest">PRESS START TO INITIALIZE</p>
            </div>
          )}

          {status.includes('ING') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="w-48 h-1 bg-slate-800 rounded overflow-hidden mb-3">
                <div className="h-full bg-green-500 animate-pulse w-full" />
              </div>
              <p className="text-green-500 text-xs tracking-widest animate-pulse">{status}</p>
              {status === 'WAKING BACKEND...' && (
                <p className="text-slate-500 text-[10px] mt-2">Render free tier — may take up to 60s on first load</p>
              )}
            </div>
          )}

          {status.includes('ERROR') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="text-red-500 text-4xl mb-3">⚠</div>
              <p className="text-red-400 text-sm text-center px-4">{status}</p>
              <button onClick={() => setStatus('IDLE')} className="mt-4 text-xs text-slate-400 underline">Dismiss</button>
            </div>
          )}
        </div>

        {/* Last alert */}
        {lastAlert && (
          <div className={`mt-3 px-3 py-2 rounded text-xs border ${
            lastAlert.includes('✅') ? 'bg-green-950 border-green-700 text-green-300' :
            lastAlert.includes('⏳') ? 'bg-yellow-950 border-yellow-700 text-yellow-300' :
            'bg-red-950 border-red-700 text-red-300'
          }`}>
            {lastAlert}
          </div>
        )}

        <div className="flex justify-between text-[10px] text-slate-600 mt-2 px-1">
          <span>RULES: {rulesRef.current.length} loaded | COOLDOWN: {ALERT_COOLDOWN_MS / 1000}s</span>
          <span>KEEP-ALIVE: every {KEEPALIVE_INTERVAL_MS / 60000} min</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;