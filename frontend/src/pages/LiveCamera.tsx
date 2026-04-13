import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../config';

const DETECTION_EVERY_N_FRAMES = 5;
const ALERT_THRESHOLD          = 0.50;  // Lowered to 50% for testing
const ALERT_COOLDOWN_MS        = 15000;

const LiveCamera: React.FC = () => {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const modelRef      = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const isRunningRef  = useRef<boolean>(false);
  const lastAlertRef  = useRef<number>(0);
  const isSendingRef  = useRef<boolean>(false);

  const [isLive,  setIsLive]  = useState(false);
  const [status,  setStatus]  = useState('IDLE');
  const [objects, setObjects] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]); // ← visible on screen

  const addLog = (msg: string) => {
    console.log(msg);
    setDebugLog(prev => [msg, ...prev].slice(0, 8)); // keep last 8 lines on screen
  };

  // ── ALARM ────────────────────────────────────────────────────────────────────
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
    } catch (e) {
      addLog('⚠️ Alarm blocked by browser');
    }
  }, []);

  // ── STOP ─────────────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
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
  }, []);

  // ── SEND ALERT ───────────────────────────────────────────────────────────────
  const sendAlert = useCallback(async (predictions: cocoSsd.DetectedObject[]) => {
    if (isSendingRef.current) {
      addLog('⏳ Skipped — already sending');
      return;
    }

    const person = predictions.find(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
    if (!person) {
      addLog('ℹ️ sendAlert called but no person above threshold');
      return;
    }

    const now     = Date.now();
    const elapsed = now - lastAlertRef.current;
    if (elapsed < ALERT_COOLDOWN_MS) {
      addLog(`⏱ Cooldown active — ${Math.round((ALERT_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
      return;
    }

    isSendingRef.current = true;
    lastAlertRef.current = now;
    setStatus('⚠ INTRUDER DETECTED');
    playAlarm();

    const payload = {
      ruleName:   'UNAUTHORIZED_ENTRY',
      priority:   'critical',
      message:    `Human detected. Confidence: ${Math.round(person.score * 100)}%`,
      cameraName: 'Sentry_Node_01',
      analytics: {
        device_id:      'SENTRY_ALPHA',
        primary_target: 'human',
        confidence_avg:  person.score,
      },
      detections: predictions.map(d => ({
        class:      d.class,
        confidence: d.score,
        bbox: { x1: d.bbox[0], y1: d.bbox[1], x2: d.bbox[0] + d.bbox[2], y2: d.bbox[1] + d.bbox[3] }
      })),
    };

    addLog(`📡 POSTing to: ${API_BASE_URL}/api/alerts`);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/alerts`, payload);
      addLog(`✅ Alert saved! ID: ${res.data?.alert?._id || 'unknown'}`);
    } catch (err: any) {
      addLog(`❌ POST failed: ${err.response?.status} — ${err.message}`);
      addLog(`   Detail: ${err.response?.data?.detail || err.response?.data?.error || 'no detail'}`);
    } finally {
      isSendingRef.current = false;
      setTimeout(() => { if (isRunningRef.current) setStatus('LIVE'); }, 5000);
    }
  }, [playAlarm]);

  // ── DRAW ─────────────────────────────────────────────────────────────────────
  const drawDetections = (ctx: CanvasRenderingContext2D, predictions: cocoSsd.DetectedObject[], w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    predictions.forEach(p => {
      const [x, y, bw, bh] = p.bbox;
      const isPerson = p.class === 'person';
      const color    = isPerson ? '#FF3333' : '#00FF88';
      const label    = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`;
      ctx.strokeStyle = color;
      ctx.lineWidth   = isPerson ? 3 : 2;
      ctx.strokeRect(x, y, bw, bh);
      ctx.font = 'bold 12px "Courier New", monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = isPerson ? 'rgba(255,51,51,0.9)' : 'rgba(0,255,136,0.9)';
      ctx.fillRect(x, y - 22, tw + 10, 20);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 5, y - 6);
    });
  };

  // ── DETECTION LOOP ───────────────────────────────────────────────────────────
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    frameCountRef.current++;

    if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const model  = modelRef.current;

      if (video && canvas && model && video.readyState === 4 && video.videoWidth > 0) {
        try {
          const predictions = await model.detect(video, 6, 0.30); // low threshold to catch everything

          // ── DEBUG: log every detection ──────────────────────────────────────
          if (predictions.length > 0) {
            const summary = predictions.map(p => `${p.class}:${Math.round(p.score * 100)}%`).join(', ');
            addLog(`👁 Detected: ${summary}`);
          } else {
            addLog('👁 No objects detected in frame');
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            drawDetections(ctx, predictions, canvas.width, canvas.height);
          }

          setObjects(predictions.length);

          const personFound = predictions.some(p => p.class === 'person' && p.score > ALERT_THRESHOLD);
          if (personFound) {
            addLog(`🚨 Person above ${ALERT_THRESHOLD * 100}% — triggering alert`);
            sendAlert(predictions);
          }

        } catch (err: any) {
          addLog(`⚠️ Detection error: ${err.message}`);
        }
      }
    }

    if (isRunningRef.current) {
      rafRef.current = requestAnimationFrame(detectionLoop);
    }
  }, [sendAlert]);

  // ── START ─────────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (isRunningRef.current) return;
    try {
      setStatus('STARTING...');
      addLog(`🔗 API_BASE_URL: ${API_BASE_URL}`);

      try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
      await tf.ready();
      addLog(`✅ TF backend: ${tf.getBackend()}`);

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
        addLog('⏳ Loading COCO-SSD model...');
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        addLog('✅ Model loaded');
      }

      isRunningRef.current = true;
      frameCountRef.current = 0;
      setIsLive(true);
      setStatus('LIVE');

      rafRef.current = requestAnimationFrame(detectionLoop);

    } catch (err: any) {
      addLog(`❌ Start failed: ${err.message}`);
      setStatus(`ERROR: ${err.message}`);
      stopCamera();
    }
  };

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

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
            status.includes('ERROR')    ? 'text-red-500'  : 'text-slate-500'
          }`}>◆ {status}</p>
        </div>
        <div className="flex items-center gap-4">
          {isLive && <span className="text-xs text-slate-400">{objects} object{objects !== 1 ? 's' : ''} in frame</span>}
          <Button
            onClick={isLive ? stopCamera : startCamera}
            className={`font-bold px-6 py-2 text-sm tracking-widest ${
              isLive ? 'bg-red-700 hover:bg-red-600 text-white' :
              status.includes('ING') ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
              'bg-green-600 hover:bg-green-500 text-black'
            }`}
          >
            {status.includes('ING') ? 'INITIALIZING...' : isLive ? '⏹ STOP' : '▶ START'}
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
            </div>
          )}
        </div>

        {/* ── DEBUG PANEL — remove after alert is working ── */}
        <div className="mt-3 bg-slate-900 border border-slate-700 rounded p-3 text-xs font-mono">
          <p className="text-slate-500 mb-2">◆ DEBUG LOG (remove after fixing)</p>
          {debugLog.length === 0
            ? <p className="text-slate-600">Waiting for detections...</p>
            : debugLog.map((line, i) => (
                <p key={i} className={`
                  ${line.includes('✅') ? 'text-green-400' :
                    line.includes('❌') ? 'text-red-400' :
                    line.includes('🚨') ? 'text-red-300' :
                    line.includes('⚠')  ? 'text-yellow-400' :
                    line.includes('👁') ? 'text-slate-400' : 'text-slate-300'}
                `}>{line}</p>
              ))
          }
        </div>

        <div className="flex justify-between text-[10px] text-slate-600 mt-2 px-1">
          <span>API: {API_BASE_URL}</span>
          <span>THRESHOLD: {ALERT_THRESHOLD * 100}% | COOLDOWN: {ALERT_COOLDOWN_MS / 1000}s</span>
        </div>
      </div>
    </div>
  );
};

export default LiveCamera;