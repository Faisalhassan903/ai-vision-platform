// ===========================================
// SENTRY AI - PROFESSIONAL MONITORING CENTER
// ===========================================
// Industry-grade security monitoring interface
// Integrates with: AlertEngine, IntelligentTelegramBot, Rule System

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCameraStore } from '../store';
import type { Detection, Zone } from '../store';

// -------------------------------------------
// TYPES
// -------------------------------------------

interface BackendDetection {
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

interface BackendAlert {
  _id: string;
  ruleName: string;
  priority: 'info' | 'warning' | 'critical';
  message: string;
  cameraName: string;
  detections: BackendDetection[];
  timestamp: string;
  acknowledged: boolean;
}

interface SystemHealth {
  ai: 'online' | 'offline' | 'processing';
  database: 'connected' | 'disconnected';
  telegram: 'active' | 'inactive';
  socket: 'connected' | 'disconnected';
}

// -------------------------------------------
// THREAT CLASSIFICATION
// -------------------------------------------

const THREAT_CONFIG = {
  critical: {
    classes: ['knife', 'scissors', 'gun', 'baseball bat', 'tennis racket'],
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.15)',
    label: 'THREAT'
  },
  warning: {
    classes: ['person', 'backpack', 'handbag', 'suitcase'],
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    label: 'WARNING'
  },
  info: {
    classes: ['car', 'truck', 'motorcycle', 'bicycle', 'bus'],
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    label: 'MONITORED'
  }
};

const getThreatLevel = (className: string): 'critical' | 'warning' | 'info' => {
  if (THREAT_CONFIG.critical.classes.includes(className)) return 'critical';
  if (THREAT_CONFIG.warning.classes.includes(className)) return 'warning';
  return 'info';
};

// -------------------------------------------
// MAIN COMPONENT
// -------------------------------------------

const CameraMonitoring: React.FC = () => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDetectionsRef = useRef<BackendDetection[]>([]);

  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [fps, setFps] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [backendAlerts, setBackendAlerts] = useState<BackendAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    ai: 'offline',
    database: 'disconnected',
    telegram: 'inactive',
    socket: 'disconnected'
  });

  // Zone drawing
  const [drawMode, setDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Zustand store
  const zonesRecord = useCameraStore((s) => s.zones);
  const detectionsRecord = useCameraStore((s) => s.detections);
  const addZone = useCameraStore((s) => s.addZone);
  const removeZone = useCameraStore((s) => s.removeZone);
  const clearZonesForCamera = useCameraStore((s) => s.clearZonesForCamera);
  const setDetections = useCameraStore((s) => s.setDetections);
  const alarmEnabled = useCameraStore((s) => s.alarmEnabled);
  const toggleAlarm = useCameraStore((s) => s.toggleAlarm);

  // Derived
  const cameraId = 'webcam-01';
  const zones = zonesRecord[cameraId] || [];
  const storeDetections = detectionsRecord[cameraId] || [];
  const personsInZone = storeDetections.filter((d) => d.label === 'person' && d.inZone);
  const unacknowledgedAlerts = backendAlerts.filter((a) => !a.acknowledged);

  // -------------------------------------------
  // START CAMERA
  // -------------------------------------------
  const startCamera = async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 }, 
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      });

      if (videoRef.current && canvasRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Set canvas to match video
        const vw = videoRef.current.videoWidth || 1280;
        const vh = videoRef.current.videoHeight || 720;
        canvasRef.current.width = vw;
        canvasRef.current.height = vh;

        connectSocket();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      alert('Camera access denied: ' + err.message);
      setIsConnecting(false);
    }
  };

  // -------------------------------------------
  // STOP CAMERA
  // -------------------------------------------
  const stopCamera = useCallback(() => {
    // Stop video
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    // Clear intervals
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsStreaming(false);
    setIsConnecting(false);
    setSystemHealth((h) => ({ ...h, socket: 'disconnected', ai: 'offline' }));
  }, []);

  // -------------------------------------------
  // SOCKET CONNECTION
  // -------------------------------------------
  const connectSocket = () => {
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected');
      setIsStreaming(true);
      setIsConnecting(false);
      setSystemHealth((h) => ({ ...h, socket: 'connected', database: 'connected' }));
      startFrameProcessing();
    });

    // Handle detections from backend (processed by AI service)
    socketRef.current.on('detections', (data) => {
      const detections: BackendDetection[] = data.detections || [];
      lastDetectionsRef.current = detections;
      
      setProcessingTime(data.processingTime || 0);
      setSystemHealth((h) => ({ ...h, ai: 'online' }));

      // Convert to store format and check zones
      const normalized: Detection[] = detections.map((det) => ({
        label: det.class,
        confidence: det.confidence,
        x: det.bbox.x1 / 416,
        y: det.bbox.y1 / 416,
        width: (det.bbox.x2 - det.bbox.x1) / 416,
        height: (det.bbox.y2 - det.bbox.y1) / 416,
        inZone: false,
        zoneIds: []
      }));

      setDetections(cameraId, normalized);
    });

    // Handle alerts from backend AlertEngine
    socketRef.current.on('alert-triggered', (data) => {
      console.log('🚨 Backend Alert:', data.alert?.ruleName);
      
      const alert: BackendAlert = {
        _id: data.alert?._id || `local-${Date.now()}`,
        ruleName: data.alert?.ruleName || 'Security Alert',
        priority: data.priority || 'warning',
        message: data.message || data.alert?.message || 'Alert triggered',
        cameraName: data.alert?.cameraName || 'Main Camera',
        detections: data.alert?.detections || [],
        timestamp: data.alert?.timestamp || new Date().toISOString(),
        acknowledged: false
      };

      setBackendAlerts((prev) => [alert, ...prev].slice(0, 100));
      setSystemHealth((h) => ({ ...h, telegram: 'active' }));

      // Play alarm sound
      if (alarmEnabled) {
        playAlarmSound(alert.priority);
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setSystemHealth((h) => ({ ...h, socket: 'disconnected' }));
    });
  };

  // -------------------------------------------
  // FRAME PROCESSING LOOP
  // -------------------------------------------
  const startFrameProcessing = () => {
    let fpsCount = 0;
    let lastFpsTime = Date.now();

    // FPS counter
    const fpsInterval = setInterval(() => {
      setFps(fpsCount);
      fpsCount = 0;
    }, 1000);

    // Render loop (60fps visual)
    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && video && ctx && video.readyState >= 2) {
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw security zones
        drawZones(ctx, canvas.width, canvas.height);

        // Draw detection boxes
        drawDetections(ctx, canvas.width, canvas.height);

        // Draw mode indicator
        if (drawMode) {
          drawModeIndicator(ctx, canvas.width);
        }

        // Draw zone preview while drawing
        if (isDrawing && drawStart && drawCurrent) {
          drawZonePreview(ctx, canvas.width, canvas.height);
        }

        fpsCount++;
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Send frames to backend (controlled rate)
    frameIntervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.7);
        socketRef.current.emit('video-frame', {
          frame: frameData,
          cameraId: cameraId
        });
        setFrameCount((c) => c + 1);
      }
    }, 1000); // 1 FPS to backend (adjust as needed)

    return () => {
      clearInterval(fpsInterval);
    };
  };

  // -------------------------------------------
  // DRAWING FUNCTIONS
  // -------------------------------------------

  const drawZones = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    zones.forEach((zone) => {
      if (!zone.enabled) return;

      const zx = zone.x * w;
      const zy = zone.y * h;
      const zw = zone.width * w;
      const zh = zone.height * h;

      // Check if intruder in zone
      const hasIntruder = storeDetections.some(
        (d) => d.label === 'person' && d.inZone && d.zoneIds.includes(zone.id)
      );

      if (hasIntruder) {
        // ALARM STATE
        const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 80);
        ctx.fillStyle = `rgba(220, 38, 38, ${pulse})`;
        ctx.fillRect(zx, zy, zw, zh);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
      } else {
        // Normal state
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(zx, zy, zw, zh);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
      }

      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      // Zone label
      const label = hasIntruder ? `⚠️ ${zone.name} - INTRUSION!` : zone.name;
      ctx.font = 'bold 13px "Inter", "SF Pro Display", system-ui, sans-serif';
      const labelW = ctx.measureText(label).width;

      ctx.fillStyle = hasIntruder ? 'rgba(220, 38, 38, 0.95)' : 'rgba(0, 0, 0, 0.75)';
      roundRect(ctx, zx, zy - 26, labelW + 16, 24, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, zx + 8, zy - 9);
    });
  };

  const drawDetections = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    lastDetectionsRef.current.forEach((det) => {
      // Scale from 416 to canvas size
      const scaleX = w / 416;
      const scaleY = h / 416;
      
      const x = det.bbox.x1 * scaleX;
      const y = det.bbox.y1 * scaleY;
      const bw = (det.bbox.x2 - det.bbox.x1) * scaleX;
      const bh = (det.bbox.y2 - det.bbox.y1) * scaleY;

      // Check if in zone
      const storeDet = storeDetections.find(
        (d) => d.label === det.class && Math.abs(d.confidence - det.confidence) < 0.01
      );
      const isInZone = storeDet?.inZone || false;

      // Get threat config
      const level = getThreatLevel(det.class);
      const config = THREAT_CONFIG[level];

      // Override color if in zone
      const boxColor = isInZone ? '#dc2626' : config.color;
      const lineWidth = isInZone ? 4 : level === 'critical' ? 3 : 2;

      // Draw fill effect
      if (isInZone || level === 'critical') {
        const alpha = isInZone 
          ? 0.25 + 0.15 * Math.sin(Date.now() / 80)
          : 0.1 + 0.05 * Math.sin(Date.now() / 150);
        ctx.fillStyle = isInZone 
          ? `rgba(220, 38, 38, ${alpha})`
          : `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(x, y, bw, bh);
      }

      // Draw bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x, y, bw, bh);

      // Draw label
      const confidence = (det.confidence * 100).toFixed(0);
      const labelText = isInZone 
        ? `🚨 ${det.class.toUpperCase()} ${confidence}% IN ZONE`
        : `${det.class} ${confidence}%`;
      
      ctx.font = 'bold 12px "Inter", system-ui, sans-serif';
      const labelW = ctx.measureText(labelText).width;

      ctx.fillStyle = boxColor;
      roundRect(ctx, x, y - 22, labelW + 12, 20, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 6, y - 7);
    });
  };

  const drawModeIndicator = (ctx: CanvasRenderingContext2D, w: number) => {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
    roundRect(ctx, w - 155, 12, 145, 32, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
    ctx.fillText('✏️ DRAW MODE ON', w - 145, 34);
  };

  const drawZonePreview = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!drawStart || !drawCurrent) return;

    const sx = Math.min(drawStart.x, drawCurrent.x) * w;
    const sy = Math.min(drawStart.y, drawCurrent.y) * h;
    const sw = Math.abs(drawCurrent.x - drawStart.x) * w;
    const sh = Math.abs(drawCurrent.y - drawStart.y) * h;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.fillRect(sx, sy, sw, sh);

    // Size label
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
    ctx.fillText(
      `${(Math.abs(drawCurrent.x - drawStart.x) * 100).toFixed(0)}% × ${(Math.abs(drawCurrent.y - drawStart.y) * 100).toFixed(0)}%`,
      sx + 5,
      sy + 16
    );
  };

  // Rounded rectangle helper
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // -------------------------------------------
  // ZONE DRAWING MOUSE HANDLERS
  // -------------------------------------------

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode) return;
    setDrawCurrent(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    if (width > 0.03 && height > 0.03) {
      const newZone: Zone = {
        id: `zone-${Date.now()}`,
        cameraId,
        name: `Zone ${zones.length + 1}`,
        x,
        y,
        width,
        height,
        color: '#ef4444',
        enabled: true,
        createdAt: Date.now()
      };
      addZone(newZone);
      console.log('✅ Zone created:', newZone.name);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // -------------------------------------------
  // ALARM SOUND
  // -------------------------------------------

  const playAlarmSound = (priority: string) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beeps = priority === 'critical' ? 10 : 5;
      const baseFreq = priority === 'critical' ? 880 : 660;

      for (let i = 0; i < beeps; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = i % 2 === 0 ? baseFreq : baseFreq - 110;
          osc.type = 'square';
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }, i * 100);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  // -------------------------------------------
  // ZONE INTRUSION CHECK
  // -------------------------------------------

  useEffect(() => {
    if (personsInZone.length > 0 && alarmEnabled && socketRef.current?.connected) {
      // Emit zone intrusion to backend for Telegram
      personsInZone.forEach((person) => {
        person.zoneIds.forEach((zoneId) => {
          const zone = zones.find((z) => z.id === zoneId);
          if (zone) {
            socketRef.current?.emit('zone-intrusion', {
              cameraId,
              zoneName: zone.name,
              confidence: person.confidence,
              timestamp: Date.now()
            });
          }
        });
      });
    }
  }, [personsInZone, zones, alarmEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // -------------------------------------------
  // RENDER
  // -------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header Bar */}
      <header className="bg-[#0d1424] border-b border-slate-800 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto flex justify-between items-center">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">SENTRY AI</h1>
              <p className="text-xs text-slate-500">Security Monitoring Center</p>
            </div>

            {/* System Health */}
            <div className="flex items-center gap-4 ml-8 pl-8 border-l border-slate-700/50">
              <HealthIndicator label="AI" status={systemHealth.ai} />
              <HealthIndicator label="Socket" status={systemHealth.socket} />
              <HealthIndicator label="Database" status={systemHealth.database} />
              <HealthIndicator label="Telegram" status={systemHealth.telegram} />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAlarm}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                alarmEnabled
                  ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {alarmEnabled ? '🔔 Alarm ON' : '🔕 Alarm OFF'}
            </button>

            {!isStreaming ? (
              <button
                onClick={startCamera}
                disabled={isConnecting}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-green-600/25 disabled:opacity-50"
              >
                {isConnecting ? '⏳ Connecting...' : '▶️ Start Monitoring'}
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-red-600/25"
              >
                ⏹️ Stop
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Sidebar - Metrics */}
          <aside className="col-span-12 xl:col-span-2 space-y-3">
            <MetricCard icon="📊" value={fps} label="Render FPS" accent="blue" />
            <MetricCard icon="⚡" value={`${processingTime}ms`} label="AI Latency" accent="yellow" />
            <MetricCard icon="🎯" value={lastDetectionsRef.current.length} label="Objects" accent="purple" />
            <MetricCard 
              icon="🚨" 
              value={personsInZone.length} 
              label="Zone Intrusions" 
              accent={personsInZone.length > 0 ? 'red' : 'green'}
              pulse={personsInZone.length > 0}
            />
            <MetricCard icon="🔲" value={zones.length} label="Active Zones" accent="slate" />
            <MetricCard icon="📡" value={frameCount} label="Frames Sent" accent="slate" />
          </aside>

          {/* Center - Camera Feed */}
          <section className="col-span-12 xl:col-span-7">
            <div className="bg-[#111827] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              {/* Camera Header */}
              <div className="px-5 py-3 bg-[#0d1424] border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    isStreaming ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-slate-600'
                  }`} />
                  <span className="font-semibold text-white">Main Camera</span>
                  <span className="text-xs text-slate-500 font-mono">{cameraId}</span>
                </div>
                <button
                  onClick={() => setDrawMode(!drawMode)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    drawMode
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {drawMode ? '✓ Drawing Mode' : '✏️ Draw Zone'}
                </button>
              </div>

              {/* Video Canvas */}
              <div className="relative bg-black aspect-video">
                <video ref={videoRef} className="hidden" playsInline muted autoPlay />
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full ${drawMode ? 'cursor-crosshair' : ''}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => setIsDrawing(false)}
                />

                {/* Offline State */}
                {!isStreaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1a]/95">
                    <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                      <span className="text-4xl">📹</span>
                    </div>
                    <p className="text-xl font-semibold text-slate-400">Camera Offline</p>
                    <p className="text-sm text-slate-600 mt-2">Click "Start Monitoring" to begin</p>
                  </div>
                )}

                {/* Intrusion Alert Overlay */}
                {personsInZone.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none border-4 border-red-500 animate-pulse" />
                )}

                {/* Zone Count Badge */}
                {zones.length > 0 && (
                  <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    {zones.length} Zone{zones.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Zone Management Bar */}
            <div className="mt-4 bg-[#111827] rounded-xl p-4 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  🎯 Security Zones
                  {zones.length > 0 && (
                    <span className="bg-red-600/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-600/30">
                      {zones.length} active
                    </span>
                  )}
                </h3>
                {zones.length > 0 && (
                  <button
                    onClick={() => clearZonesForCamera(cameraId)}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {zones.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Click "Draw Zone" above, then click and drag on the camera to create security zones.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {zones.map((zone) => {
                    const hasAlert = storeDetections.some(
                      (d) => d.inZone && d.zoneIds.includes(zone.id)
                    );
                    return (
                      <div
                        key={zone.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                          hasAlert
                            ? 'bg-red-900/30 border-red-500 animate-pulse'
                            : 'bg-slate-800/50 border-slate-700'
                        }`}
                      >
                        <span className="text-sm font-medium text-white">{zone.name}</span>
                        <span className="text-xs text-slate-400">
                          {(zone.width * 100).toFixed(0)}% × {(zone.height * 100).toFixed(0)}%
                        </span>
                        <button
                          onClick={() => removeZone(zone.id)}
                          className="ml-1 text-slate-500 hover:text-red-400 transition"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right Sidebar - Alerts & Detections */}
          <aside className="col-span-12 xl:col-span-3 space-y-4">
            {/* Backend Alerts */}
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-[#0d1424] border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  🚨 Rule Alerts
                  {unacknowledgedAlerts.length > 0 && (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                      {unacknowledgedAlerts.length}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setBackendAlerts([])}
                  className="text-xs text-slate-500 hover:text-white transition"
                >
                  Clear
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {unacknowledgedAlerts.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-600/10 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">✓</span>
                    </div>
                    <p className="text-green-400 font-semibold">All Clear</p>
                    <p className="text-slate-600 text-sm mt-1">No active alerts</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {unacknowledgedAlerts.slice(0, 10).map((alert) => (
                      <div
                        key={alert._id}
                        className={`p-3 rounded-lg border ${
                          alert.priority === 'critical'
                            ? 'bg-red-900/20 border-red-600/50'
                            : alert.priority === 'warning'
                            ? 'bg-yellow-900/20 border-yellow-600/50'
                            : 'bg-blue-900/20 border-blue-600/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-white truncate">
                              {alert.priority === 'critical' ? '🚨' : '⚠️'} {alert.ruleName}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 truncate">{alert.message}</p>
                            <p className="text-xs text-slate-600 mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <button
                            onClick={() => setBackendAlerts((prev) =>
                              prev.map((a) => a._id === alert._id ? { ...a, acknowledged: true } : a)
                            )}
                            className="text-slate-500 hover:text-white transition shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Detections */}
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-[#0d1424] border-b border-slate-800">
                <h3 className="font-semibold text-white">🎯 Live Detections</h3>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {lastDetectionsRef.current.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    {isStreaming ? 'Scanning...' : 'Camera offline'}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {lastDetectionsRef.current.map((det, i) => {
                      const level = getThreatLevel(det.class);
                      const storeDet = storeDetections.find(
                        (d) => d.label === det.class && Math.abs(d.confidence - det.confidence) < 0.01
                      );
                      const isInZone = storeDet?.inZone || false;

                      return (
                        <div
                          key={i}
                          className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                            isInZone
                              ? 'bg-red-900/30 border border-red-600/50'
                              : level === 'critical'
                              ? 'bg-red-900/10 border border-red-600/20'
                              : level === 'warning'
                              ? 'bg-yellow-900/10 border border-yellow-600/20'
                              : 'bg-slate-800/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {isInZone ? '🚨' : level === 'critical' ? '⚠️' : level === 'warning' ? '👤' : '📦'}
                            </span>
                            <span className="text-sm font-medium text-white capitalize">{det.class}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            isInZone ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {(det.confidence * 100).toFixed(0)}%
                            {isInZone && ' IN ZONE'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
              <h3 className="font-semibold text-white mb-3">⚡ Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => playAlarmSound('critical')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition border border-slate-700"
                >
                  🔊 Test Alarm
                </button>
                <button
                  onClick={() => {
                    socketRef.current?.emit('test-telegram');
                  }}
                  className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-xs font-medium text-blue-400 transition border border-blue-600/30"
                >
                  📱 Test Telegram
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

// -------------------------------------------
// SUB-COMPONENTS
// -------------------------------------------

const HealthIndicator: React.FC<{ label: string; status: string }> = ({ label, status }) => {
  const colors: Record<string, string> = {
    online: 'bg-green-500 shadow-green-500/50',
    processing: 'bg-yellow-500 shadow-yellow-500/50',
    connected: 'bg-green-500 shadow-green-500/50',
    active: 'bg-green-500 shadow-green-500/50',
    offline: 'bg-slate-600',
    disconnected: 'bg-red-500 shadow-red-500/50',
    inactive: 'bg-slate-600'
  };

  const isActive = ['online', 'processing', 'connected', 'active'].includes(status);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full shadow-sm ${colors[status] || 'bg-slate-600'} ${isActive ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: string;
  value: number | string;
  label: string;
  accent: string;
  pulse?: boolean;
}> = ({ icon, value, label, accent, pulse }) => {
  const accents: Record<string, string> = {
    blue: 'from-blue-600/15 to-blue-600/5 border-blue-500/20',
    yellow: 'from-yellow-600/15 to-yellow-600/5 border-yellow-500/20',
    purple: 'from-purple-600/15 to-purple-600/5 border-purple-500/20',
    red: 'from-red-600/15 to-red-600/5 border-red-500/20',
    green: 'from-green-600/15 to-green-600/5 border-green-500/20',
    slate: 'from-slate-600/15 to-slate-600/5 border-slate-500/20'
  };

  return (
    <div className={`bg-gradient-to-br ${accents[accent]} border rounded-xl p-4 ${pulse ? 'animate-pulse' : ''}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
};

export default CameraMonitoring;