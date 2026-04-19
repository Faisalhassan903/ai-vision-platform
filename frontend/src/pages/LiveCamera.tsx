
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CentroidTracker } from './Tracker';

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const DETECTION_EVERY_N_FRAMES = 5;
const POST_TIMEOUT_MS          = 30000;
const KEEPALIVE_INTERVAL_MS    = 8 * 60 * 1000;

interface AlertRule {
  _id: string;
  name: string;
  enabled: boolean;
  priority: 'info' | 'warning' | 'critical';
  conditions: { objectClasses: string[]; minConfidence: number; timeRange?: { start: string; end: string }; zones?: any[] };
  actions: { audioAlert: boolean; notification: boolean; saveSnapshot: boolean; discord: boolean; email: boolean };
  cooldownMinutes: number;
  triggerCount: number;
}

interface LiveEvent {
  id: string;
  time: string;
  rule: string;
  object: string;
  confidence: number;
  priority: 'info' | 'warning' | 'critical';
}

const ruleCooldowns: Record<string, number> = {};

export default function LiveCamera() {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const modelRef        = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const rafRef          = useRef<number | null>(null);
  const keepAliveRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef   = useRef<number>(0);
  const isRunningRef    = useRef<boolean>(false);
  const isSendingRef    = useRef<boolean>(false);
  const rulesRef        = useRef<AlertRule[]>([]);
  const backendReadyRef = useRef<boolean>(false);

  const [phase,       setPhase]       = useState<'idle'|'booting'|'live'|'alert'|'error'>('idle');
  const [bootMsg,     setBootMsg]     = useState('');
  const [objects,     setObjects]     = useState(0);
  const [events,      setEvents]      = useState<LiveEvent[]>([]);
  const [alertFlash,  setAlertFlash]  = useState(false);
  const [rulesCount,  setRulesCount]  = useState(0);
  const [watchList,   setWatchList]   = useState<string[]>([]);
  const [uptime,      setUptime]      = useState(0);
  const uptimeRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UPTIME COUNTER ──────────────────────────────────────────────────────────
  const startUptime = () => {
    const start = Date.now();
    uptimeRef.current = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  };
  const stopUptime = () => {
    if (uptimeRef.current) { clearInterval(uptimeRef.current); uptimeRef.current = null; }
    setUptime(0);
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const isWithinTimeRange = (tr?: { start: string; end: string }) => {
    if (!tr?.start || !tr?.end) return true;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    return tr.start <= tr.end ? hhmm >= tr.start && hhmm <= tr.end : hhmm >= tr.start || hhmm <= tr.end;
  };

  // ── WAKE BACKEND ────────────────────────────────────────────────────────────
  const wakeBackend = useCallback(async () => {
    try {
      await axios.get(`${API_BASE_URL}/health`, { timeout: 60000 });
      backendReadyRef.current = true;
    } catch {
      backendReadyRef.current = false;
    }
  }, []);

  // ── KEEP ALIVE ───────────────────────────────────────────────────────────────
  const startKeepAlive = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = setInterval(async () => {
      try { await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 }); backendReadyRef.current = true; }
      catch { backendReadyRef.current = false; }
    }, KEEPALIVE_INTERVAL_MS);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
  }, []);

  // ── LOAD RULES ───────────────────────────────────────────────────────────────
  const loadRules = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/rules`, { timeout: 10000 });
      const rules: AlertRule[] = Array.isArray(res.data) ? res.data : res.data?.rules || [];
      const active = rules.filter(r => r.enabled !== false);
      rulesRef.current = active;
      setRulesCount(active.length);
      const classes = [...new Set(active.flatMap(r => r.conditions?.objectClasses || []))];
      setWatchList(classes);
    } catch {
      rulesRef.current = [{ _id:'fallback', name:'Person Detection', enabled:true, priority:'critical',
        conditions:{ objectClasses:['person'], minConfidence:0.5 },
        actions:{ audioAlert:true, notification:true, saveSnapshot:false, discord:false, email:false },
        cooldownMinutes:1, triggerCount:0 }];
      setRulesCount(1);
      setWatchList(['person']);
    }
  }, []);

  // ── EVALUATE RULES ───────────────────────────────────────────────────────────
  const evaluateRules = useCallback((preds: cocoSsd.DetectedObject[]) => {
    for (const rule of rulesRef.current) {
      if (!rule.enabled) continue;
      if (!isWithinTimeRange(rule.conditions?.timeRange)) continue;
      const coolMs = (rule.cooldownMinutes || 1) * 60 * 1000;
      if (Date.now() - (ruleCooldowns[rule._id] || 0) < coolMs) continue;
      for (const cls of (rule.conditions?.objectClasses || [])) {
        const match = preds.find(p => p.class.toLowerCase() === cls.toLowerCase() && p.score >= (rule.conditions?.minConfidence || 0.5));
        if (match) return { rule, detection: match, allDetections: preds };
      }
    }
    return null;
  }, []);

  // ── ALARM ────────────────────────────────────────────────────────────────────
  const playAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.2);
    } catch { /* blocked */ }
  }, []);

  // ── STOP ─────────────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    stopKeepAlive(); stopUptime();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const c = canvasRef.current.getContext('2d');
      if (c) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setPhase('idle'); setObjects(0);
  }, [stopKeepAlive]);

  // ── SEND ALERT ───────────────────────────────────────────────────────────────
  const sendAlert = useCallback(async (match: any) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    const { rule, detection, allDetections } = match;
    ruleCooldowns[rule._id] = Date.now();
    const safetyTimer = setTimeout(() => { isSendingRef.current = false; }, 35000);

    setPhase('alert');
    setAlertFlash(true);
    setTimeout(() => { setAlertFlash(false); if (isRunningRef.current) setPhase('live'); }, 4000);

    if (rule.actions?.audioAlert) playAlarm();

    // Add to live event feed
    const event: LiveEvent = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      rule: rule.name,
      object: detection.class,
      confidence: detection.score,
      priority: rule.priority,
    };
    setEvents(prev => [event, ...prev].slice(0, 8));

    try {
      if (!backendReadyRef.current) await wakeBackend();
      await axios.post(`${API_BASE_URL}/api/alerts`, {
        ruleName: rule.name, priority: rule.priority,
        message: `${detection.class.toUpperCase()} detected. Confidence: ${Math.round(detection.score * 100)}%`,
        cameraName: 'Sentry_Node_01',
        analytics: { device_id: 'SENTRY_ALPHA', primary_target: detection.class, confidence_avg: detection.score },
        detections: allDetections.map((d: any) => ({ class: d.class, confidence: d.score,
          bbox: { x1: d.bbox[0], y1: d.bbox[1], x2: d.bbox[0]+d.bbox[2], y2: d.bbox[1]+d.bbox[3] } })),
      }, { timeout: POST_TIMEOUT_MS });
      axios.patch(`${API_BASE_URL}/api/rules/${rule._id}/trigger`, {}, { timeout: 5000 }).catch(() => {});
    } catch (err: any) {
      console.error('Alert failed:', err.message);
    } finally {
      clearTimeout(safetyTimer);
      isSendingRef.current = false;
    }
  }, [playAlarm, wakeBackend]);

  // ── DRAW ─────────────────────────────────────────────────────────────────────
  const drawDetections = (ctx: CanvasRenderingContext2D, preds: cocoSsd.DetectedObject[]) => {
    const watched = new Set(rulesRef.current.flatMap(r => r.conditions?.objectClasses?.map(c => c.toLowerCase()) || []));
    preds.forEach(p => {
      const [x, y, w, h] = p.bbox;
      const hit = watched.has(p.class.toLowerCase());
      const conf = Math.round(p.score * 100);
      const label = `${p.class.toUpperCase()}  ${conf}%`;

      // Clean minimal box — no corners, just a clean rectangle
      ctx.strokeStyle = hit ? 'rgba(239,68,68,0.9)' : 'rgba(99,102,241,0.7)';
      ctx.lineWidth = hit ? 2 : 1.5;
      ctx.strokeRect(x, y, w, h);

      // Subtle fill on target
      if (hit) {
        ctx.fillStyle = 'rgba(239,68,68,0.06)';
        ctx.fillRect(x, y, w, h);
      }

      // Label pill
      ctx.font = '600 11px "DM Mono", "Courier New", monospace';
      const tw = ctx.measureText(label).width;
      const ph = 20; const pw = tw + 16;
      const lx = x; const ly = y > ph + 4 ? y - ph - 4 : y + h + 4;

      ctx.fillStyle = hit ? 'rgba(239,68,68,0.95)' : 'rgba(99,102,241,0.9)';
      ctx.beginPath();
      ctx.roundRect(lx, ly, pw, ph, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + 8, ly + 14);
    });
  };

  // ── DETECTION LOOP ───────────────────────────────────────────────────────────
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;
    frameCountRef.current++;
    if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
      const video = videoRef.current; const canvas = canvasRef.current; const model = modelRef.current;
      if (video && canvas && model && video.readyState === 4 && video.videoWidth > 0) {
        try {
          const preds = await model.detect(video, 6, 0.25);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawDetections(ctx, preds);
          }
          setObjects(preds.length);
          const match = evaluateRules(preds);
          if (match) sendAlert(match);
        } catch { /* skip frame */ }
      }
    }
    if (isRunningRef.current) rafRef.current = requestAnimationFrame(detectionLoop);
  }, [sendAlert, evaluateRules]);
//----uniqu object count -------------//
const personTracker = new CentroidTracker();

async function onFrame() {
  const predictions = await model.detect(video);
  
  // This is the "Filter" that stops over-counting
  const newPersonIDs = personTracker.update(predictions);

  if (newPersonIDs.length > 0) {
    // ONLY runs if a brand new person entered the frame
    console.log(`Detected ${newPersonIDs.length} new unique person(s)!`);
    sendToVercelTimeline(newPersonIDs); 
  }
}
  // ── START ─────────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (isRunningRef.current) return;
    isSendingRef.current = false;
    backendReadyRef.current = false;
    Object.keys(ruleCooldowns).forEach(k => delete ruleCooldowns[k]);

    try {
      setPhase('booting'); setBootMsg('Connecting to server…');
      await Promise.all([wakeBackend(), loadRules()]);

      setBootMsg('Initialising AI engine…');
      try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
      await tf.ready();

      setBootMsg('Requesting camera access…');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720} }, audio:false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Video ref not ready');
      videoRef.current.srcObject = stream;
      await new Promise<void>((res, rej) => {
        const v = videoRef.current!;
        v.onloadedmetadata = () => v.play().then(res).catch(rej);
        v.onerror = rej;
      });

      if (!modelRef.current) {
        setBootMsg('Loading detection model…');
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      }

      startKeepAlive(); startUptime();
      isRunningRef.current = true;
      frameCountRef.current = 0;
      setPhase('live');
      rafRef.current = requestAnimationFrame(detectionLoop);

    } catch (err: any) {
      setPhase('error'); setBootMsg(err.message || 'Failed to start');
    }
  };

  useEffect(() => { return () => { stopCamera(); stopKeepAlive(); }; }, [stopCamera, stopKeepAlive]);

  const priorityColor = { critical: '#ef4444', warning: '#f59e0b', info: '#6366f1' };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
      className="min-h-screen bg-[#080c12] text-white flex flex-col">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Sentry Hub</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Live Monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {phase === 'live' || phase === 'alert' ? (
            <>
              <Stat label="UPTIME" value={formatUptime(uptime)} />
              <Stat label="IN FRAME" value={String(objects)} />
              <Stat label="RULES" value={String(rulesCount)} />
            </>
          ) : null}
          <button
            onClick={phase === 'live' || phase === 'alert' ? stopCamera : startCamera}
            disabled={phase === 'booting'}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              phase === 'live' || phase === 'alert'
                ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                : phase === 'booting'
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
            }`}
          >
            {phase === 'booting' ? 'Starting…' : phase === 'live' || phase === 'alert' ? 'Stop' : 'Start Camera'}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── VIDEO PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 relative bg-black">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

          {/* ALERT FLASH OVERLAY */}
          {alertFlash && (
            <div className="absolute inset-0 z-20 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 80px rgba(239,68,68,0.5)', border: '2px solid rgba(239,68,68,0.6)' }} />
          )}

          {/* IDLE STATE */}
          {phase === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#080c12]">
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                  <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                </svg>
              </div>
              <p className="text-white/60 text-sm font-medium mb-1">Camera offline</p>
              <p className="text-white/25 text-xs">Press Start Camera to begin monitoring</p>
            </div>
          )}

          {/* BOOTING STATE */}
          {phase === 'booting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#080c12]">
              <div className="relative w-12 h-12 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-red-500 animate-spin" />
              </div>
              <p className="text-white/80 text-sm font-medium mb-1">{bootMsg}</p>
              <p className="text-white/25 text-xs">This may take up to 60s on first load</p>
            </div>
          )}

          {/* ERROR STATE */}
          {phase === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#080c12]">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                <span className="text-red-400 text-xl">!</span>
              </div>
              <p className="text-white/60 text-sm mb-4">{bootMsg}</p>
              <button onClick={() => setPhase('idle')} className="text-xs text-white/30 hover:text-white/60 underline">Dismiss</button>
            </div>
          )}

          {/* LIVE BADGE */}
          {(phase === 'live' || phase === 'alert') && (
            <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-xs font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${phase === 'alert' ? 'bg-red-400 animate-ping' : 'bg-red-500 animate-pulse'}`} />
              {phase === 'alert' ? 'ALERT' : 'LIVE'}
            </div>
          )}

          {/* WATCH LIST TAGS — bottom of video */}
          {(phase === 'live' || phase === 'alert') && watchList.length > 0 && (
            <div className="absolute bottom-4 left-4 z-30 flex flex-wrap gap-1.5">
              {watchList.slice(0, 6).map(cls => (
                <span key={cls} className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-[10px] text-white/50 uppercase tracking-wide">
                  {cls}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="w-72 flex flex-col border-l border-white/5 bg-[#0a0f18]">

          {/* SYSTEM STATUS */}
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3">System Status</p>
            <div className="space-y-2">
              <StatusRow label="Camera" value={phase === 'live' || phase === 'alert' ? 'Active' : 'Offline'}
                active={phase === 'live' || phase === 'alert'} />
              <StatusRow label="AI Engine" value={phase === 'live' || phase === 'alert' ? tf.getBackend()?.toUpperCase() || 'ON' : 'Standby'}
                active={phase === 'live' || phase === 'alert'} />
              <StatusRow label="Rules" value={`${rulesCount} loaded`} active={rulesCount > 0} />
              <StatusRow label="Backend" value={backendReadyRef.current ? 'Online' : 'Offline'}
                active={backendReadyRef.current} />
            </div>
          </div>

          {/* LIVE EVENT FEED */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3">Event Feed</p>

            {events.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-white/3 border border-white/5 flex items-center justify-center mb-3">
                  <span className="text-white/20 text-lg">◎</span>
                </div>
                <p className="text-white/20 text-xs text-center">No events yet</p>
                <p className="text-white/10 text-[10px] text-center mt-1">Detections will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {events.map((ev, i) => (
                  <div key={ev.id}
                    className="p-3 rounded-lg border transition-all"
                    style={{
                      borderColor: i === 0 ? `${priorityColor[ev.priority]}30` : 'rgba(255,255,255,0.05)',
                      background: i === 0 ? `${priorityColor[ev.priority]}08` : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: priorityColor[ev.priority] }}>
                        {ev.priority}
                      </span>
                      <span className="text-[10px] text-white/20 font-mono">{ev.time}</span>
                    </div>
                    <p className="text-xs font-medium text-white/80 mb-0.5">{ev.object}</p>
                    <p className="text-[10px] text-white/30">{ev.rule} · {Math.round(ev.confidence * 100)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-white/5">
            <p className="text-[10px] text-white/15 text-center">
              COCO-SSD · lite_mobilenet_v2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUB COMPONENTS ────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs font-semibold text-white">{value}</p>
      <p className="text-[9px] text-white/25 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/30">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/15'}`} />
        <span className={`text-xs font-medium ${active ? 'text-white/70' : 'text-white/20'}`}>{value}</span>
      </div>
    </div>
  );
}