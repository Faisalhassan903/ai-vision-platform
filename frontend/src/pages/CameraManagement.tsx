import React, { useState, useEffect, useRef } from 'react';
import { useCameras } from '../hooks/useCameras';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { Camera, CameraType } from '../store';

// ── CAMERA PRESETS ────────────────────────────────────────────────────────────
const CAMERA_PRESETS = [
  { brand: 'Hikvision',   rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/Streaming/Channels/101', defaultPort: 554, instructions: 'Enable RTSP in camera settings. Channel 101 = Main stream.' },
  { brand: 'Dahua',       rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel=1&subtype=0', defaultPort: 554, instructions: 'subtype=0 for main stream, subtype=1 for sub stream.' },
  { brand: 'Reolink',     rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/h264Preview_01_main', defaultPort: 554, instructions: 'Use h264Preview_01_sub for lower quality.' },
  { brand: 'TP-Link Tapo',rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/stream1', defaultPort: 554, instructions: 'Enable RTSP in Tapo app under Camera Settings > Advanced.' },
  { brand: 'Wyze',        rtspTemplate: 'rtsp://{ip}:{port}/live', defaultPort: 8554, instructions: 'Requires RTSP firmware from Wyze website.' },
  { brand: 'Custom',      rtspTemplate: '', defaultPort: 554, instructions: 'Enter complete RTSP URL manually.' },
];

// ── VIDEO ANALYSIS TYPES ──────────────────────────────────────────────────────
interface AnalysisResult {
  timestamp: number;
  timeLabel: string;
  detections: Array<{ class: string; confidence: number }>;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const CameraManagement: React.FC = () => {
  const { cameras, isLoading, error, addCamera, updateCamera, deleteCamera, testCamera, refreshCameras } = useCameras();
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [editingCamera,    setEditingCamera]    = useState<Camera | null>(null);
  const [testingId,        setTestingId]        = useState<string | null>(null);
  const [testResult,       setTestResult]       = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [activeTab,        setActiveTab]        = useState<'cameras' | 'analyze'>('cameras');

  const handleTest = async (camera: Camera) => {
    setTestingId(camera.id);
    setTestResult(null);
    const result = await testCamera(camera.id);
    setTestResult({ id: camera.id, ...result });
    setTestingId(null);
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleDelete = async (camera: Camera) => {
    if (confirm(`Delete "${camera.name}"?`)) await deleteCamera(camera.id);
  };

  return (
    <div className="min-h-screen bg-[#080c12] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Cameras</h1>
            <p className="text-white/35 text-sm mt-0.5">Manage cameras and analyse video footage</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshCameras}
              className="px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-sm text-white/60 transition-all flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-400 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-red-500/20 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Camera
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6 w-full sm:w-fit">
          {(['cameras', 'analyze'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === t ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'
              }`}>
              {t === 'analyze' ? 'Video Analysis' : 'Cameras'}
            </button>
          ))}
        </div>

        {/* ── CAMERAS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'cameras' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cameras.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff30" strokeWidth="1.5">
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
                    <rect x="2" y="7" width="13" height="10" rx="2"/>
                  </svg>
                </div>
                <p className="text-white/40 text-sm mb-4">No cameras added yet</p>
                <button onClick={() => setShowAddModal(true)}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-xl transition-all">
                  Add your first camera
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cameras.map(camera => (
                  <CameraCard key={camera.id} camera={camera}
                    onEdit={() => setEditingCamera(camera)}
                    onDelete={() => handleDelete(camera)}
                    onTest={() => handleTest(camera)}
                    isTesting={testingId === camera.id}
                    testResult={testResult?.id === camera.id ? testResult : null}
                  />
                ))}
                {/* Add card */}
                <button onClick={() => setShowAddModal(true)}
                  className="border-2 border-dashed border-white/8 hover:border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all group min-h-[180px]">
                  <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-white/8 flex items-center justify-center transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff40" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <span className="text-white/25 group-hover:text-white/40 text-sm transition-colors">Add Camera</span>
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Total',   value: cameras.length,                                                       color: 'text-white' },
                { label: 'Online',  value: cameras.filter(c => c.status === 'online').length,                    color: 'text-emerald-400' },
                { label: 'Offline', value: cameras.filter(c => c.status === 'offline' || c.status === 'error').length, color: 'text-red-400' },
                { label: 'RTSP',    value: cameras.filter(c => c.type === 'rtsp').length,                        color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── VIDEO ANALYSIS TAB ──────────────────────────────────────────── */}
        {activeTab === 'analyze' && <VideoAnalysis />}

      </div>

      {/* Modal */}
      {(showAddModal || editingCamera) && (
        <AddCameraModal
          camera={editingCamera}
          onClose={() => { setShowAddModal(false); setEditingCamera(null); }}
          onSave={async (data) => {
            if (editingCamera) await updateCamera(editingCamera.id, data);
            else await addCamera(data);
            setShowAddModal(false); setEditingCamera(null);
          }}
        />
      )}
    </div>
  );
};

// ── VIDEO ANALYSIS COMPONENT ──────────────────────────────────────────────────
const VideoAnalysis: React.FC = () => {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const modelRef    = useRef<cocoSsd.ObjectDetection | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  const [file,       setFile]       = useState<File | null>(null);
  const [videoUrl,   setVideoUrl]   = useState<string | null>(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [results,    setResults]    = useState<AnalysisResult[]>([]);
  const [summary,    setSummary]    = useState<Record<string, number>>({});
  const [status,     setStatus]     = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults([]);
    setSummary({});
    setProgress(0);
    setStatus('');
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('video/')) {
      setFile(f);
      setResults([]);
      setSummary({});
      setProgress(0);
      const url = URL.createObjectURL(f);
      setVideoUrl(url);
    }
  };

  const analyzeVideo = async () => {
    if (!videoRef.current || !canvasRef.current || !file) return;
    setAnalyzing(true);
    setResults([]);
    setSummary({});
    setProgress(0);

    try {
      // Load model if needed
      if (!modelRef.current) {
        setStatus('Loading AI model…');
        await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
        await tf.ready();
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      }

      const video    = videoRef.current;
      const canvas   = canvasRef.current;
      const ctx      = canvas.getContext('2d')!;
      const duration = video.duration;
      const STEP     = 2; // analyse every 2 seconds
      const frames   = Math.floor(duration / STEP);
      const collected: AnalysisResult[] = [];
      const classTotals: Record<string, number> = {};

      for (let i = 0; i <= frames; i++) {
        const t = i * STEP;
        setProgress(Math.round((i / frames) * 100));
        setStatus(`Analysing frame ${i + 1} of ${frames + 1}…`);

        // Seek video to timestamp
        await new Promise<void>(resolve => {
          video.currentTime = t;
          video.onseeked = () => resolve();
        });

        // Draw frame to canvas
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 360;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Run detection
        const preds = await modelRef.current!.detect(canvas, 6, 0.35);

        if (preds.length > 0) {
          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          collected.push({
            timestamp: t,
            timeLabel: `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`,
            detections: preds.map(p => ({ class: p.class, confidence: p.score })),
          });
          preds.forEach(p => {
            classTotals[p.class] = (classTotals[p.class] || 0) + 1;
          });
        }
      }

      setResults(collected);
      setSummary(classTotals);
      setStatus(`Done — ${collected.length} frames with detections`);
      setProgress(100);

    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const jumpTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const topClasses = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !file && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          file ? 'border-white/15 bg-white/3' : 'border-white/10 hover:border-white/20 hover:bg-white/3'
        }`}
      >
        <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
        {!file ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff40" strokeWidth="1.75">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </div>
            <p className="text-white/50 text-sm font-medium">Drop a video file here</p>
            <p className="text-white/20 text-xs mt-1">or click to browse · MP4, MOV, AVI supported</p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                <p className="text-white/30 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setVideoUrl(null); setResults([]); setSummary({}); }}
              className="text-white/25 hover:text-white/50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Video player + canvas */}
      {videoUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-black rounded-2xl overflow-hidden">
            <video ref={videoRef} src={videoUrl} controls className="w-full" />
          </div>
          <div className="bg-black rounded-2xl overflow-hidden flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-auto" />
            {!analyzing && results.length === 0 && (
              <p className="absolute text-white/20 text-xs">Analysis preview will appear here</p>
            )}
          </div>
        </div>
      )}

      {/* Analyse button */}
      {file && (
        <button onClick={analyzeVideo} disabled={analyzing}
          className="w-full py-3 bg-red-500 hover:bg-red-400 disabled:bg-red-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
          {analyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {status}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Analyse Video
            </>
          )}
        </button>
      )}

      {/* Progress bar */}
      {analyzing && (
        <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-red-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Summary */}
      {topClasses.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white text-sm font-semibold mb-4">Objects Found</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {topClasses.map(([cls, count]) => (
              <div key={cls} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-white/40 text-xs mt-0.5 capitalize">{cls}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline results */}
      {results.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white text-sm font-semibold mb-4">
            Detection Timeline
            <span className="text-white/30 font-normal ml-2">— click a row to jump to that moment</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <button key={i} onClick={() => jumpTo(r.timestamp)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/6 border border-white/5 hover:border-white/10 transition-all text-left">
                <span className="text-white/50 font-mono text-xs w-10 flex-shrink-0">{r.timeLabel}</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {r.detections.slice(0, 5).map((d, j) => (
                    <span key={j} className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-red-300 text-[10px] font-medium capitalize">
                      {d.class} {Math.round(d.confidence * 100)}%
                    </span>
                  ))}
                  {r.detections.length > 5 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/8 text-white/30 text-[10px]">
                      +{r.detections.length - 5}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── CAMERA CARD ───────────────────────────────────────────────────────────────
interface CameraCardProps {
  camera: Camera; onEdit: () => void; onDelete: () => void; onTest: () => void;
  isTesting: boolean; testResult: { success: boolean; error?: string } | null;
}

const CameraCard: React.FC<CameraCardProps> = ({ camera, onEdit, onDelete, onTest, isTesting, testResult }) => {
  const statusDot: Record<string, string> = {
    online: 'bg-emerald-400', offline: 'bg-white/20', connecting: 'bg-yellow-400 animate-pulse', error: 'bg-red-500',
  };

  return (
    <div className={`bg-white/3 rounded-2xl border overflow-hidden transition-all ${
      camera.status === 'online' ? 'border-emerald-500/20' :
      camera.status === 'error'  ? 'border-red-500/20' : 'border-white/8'
    }`}>
      {/* Preview */}
      <div className="aspect-video bg-black relative flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff15" strokeWidth="1.5">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
          <rect x="2" y="7" width="13" height="10" rx="2"/>
        </svg>

        {/* Status */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot[camera.status] || 'bg-white/20'}`} />
          <span className="text-[10px] text-white/50 capitalize">{camera.status}</span>
        </div>

        <div className="absolute top-3 right-3 bg-black/60 px-2 py-0.5 rounded text-[9px] text-white/25 font-mono">
          {camera.id.slice(0, 8)}
        </div>

        {/* Test result overlay */}
        {testResult && (
          <div className={`absolute inset-0 flex items-center justify-center ${testResult.success ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}>
            <div className="text-center text-white">
              <p className="text-3xl mb-1">{testResult.success ? '✓' : '✗'}</p>
              <p className="text-xs">{testResult.success ? 'Connected' : testResult.error || 'Failed'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{camera.name}</p>
            {camera.location && <p className="text-white/30 text-xs mt-0.5 truncate">{camera.location}</p>}
          </div>
          <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            camera.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/25'
          }`}>
            {camera.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {camera.streamUrl && (
          <p className="text-[10px] text-white/20 font-mono truncate mb-3">
            {camera.streamUrl.replace(/\/\/.*:.*@/, '//●●●:●●●@')}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onTest} disabled={isTesting}
            className="flex-1 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-xs text-white/60 hover:text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {isTesting ? <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" /> : 
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            }
            {isTesting ? 'Testing' : 'Test'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-white/40 hover:text-white transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={onDelete}
            className="px-3 py-2 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 rounded-xl text-red-400/60 hover:text-red-400 transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ADD CAMERA MODAL ──────────────────────────────────────────────────────────
interface AddCameraModalProps {
  camera: Camera | null; onClose: () => void; onSave: (c: Partial<Camera>) => Promise<void>;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ camera, onClose, onSave }) => {
  const [step,            setStep]            = useState(1);
  const [cameraType,      setCameraType]      = useState<CameraType>(camera?.type || 'webcam');
  const [selectedPreset,  setSelectedPreset]  = useState<typeof CAMERA_PRESETS[0] | null>(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [webcamDevices,   setWebcamDevices]   = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice,  setSelectedDevice]  = useState(camera?.deviceId || '');
  const [formData,        setFormData]        = useState({
    name: camera?.name || '', location: camera?.location || '', streamUrl: camera?.streamUrl || '',
    username: camera?.username || '', password: camera?.password || '',
    ip: '', port: '554', enabled: camera?.enabled !== false,
  });

  useEffect(() => {
    if (cameraType === 'webcam') {
      navigator.mediaDevices.enumerateDevices().then(d => {
        const v = d.filter(x => x.kind === 'videoinput');
        setWebcamDevices(v);
        if (v.length > 0 && !selectedDevice) setSelectedDevice(v[0].deviceId);
      }).catch(() => {});
    }
  }, [cameraType]);

  const buildRtspUrl = () => {
    if (!selectedPreset || !formData.ip) return '';
    return selectedPreset.rtspTemplate
      .replace('{ip}', formData.ip).replace('{port}', formData.port || String(selectedPreset.defaultPort))
      .replace('{username}', formData.username || 'admin').replace('{password}', formData.password || 'password');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name:      formData.name || `Camera ${Date.now()}`,
        type:      cameraType,
        streamUrl: cameraType === 'rtsp' ? (selectedPreset?.brand === 'Custom' ? formData.streamUrl : buildRtspUrl()) :
                   cameraType === 'http' ? formData.streamUrl : undefined,
        username:  formData.username || undefined,
        password:  formData.password || undefined,
        deviceId:  cameraType === 'webcam' ? selectedDevice : undefined,
        location:  formData.location || undefined,
        enabled:   formData.enabled,
      });
    } finally { setIsSaving(false); }
  };

  const update = (k: string, v: any) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f1420] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-white font-semibold">{camera ? 'Edit Camera' : 'Add Camera'}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Step 1: Type */}
          {step === 1 && (
            <>
              <p className="text-white/40 text-sm">What type of camera are you adding?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'webcam' as CameraType, label: 'USB / Webcam', sub: 'Built-in or USB' },
                  { type: 'rtsp'   as CameraType, label: 'IP Camera',    sub: 'Hikvision, Dahua…' },
                  { type: 'http'   as CameraType, label: 'HTTP Stream',  sub: 'MJPEG / HLS' },
                  { type: 'file'   as CameraType, label: 'Video File',   sub: 'For testing' },
                ].map(o => (
                  <button key={o.type} onClick={() => setCameraType(o.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      cameraType === o.type ? 'border-red-500/60 bg-red-500/8' : 'border-white/8 hover:border-white/15'
                    }`}>
                    <p className="text-white text-sm font-medium">{o.label}</p>
                    <p className="text-white/30 text-xs mt-0.5">{o.sub}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)}
                className="w-full py-3 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-xl transition-all">
                Continue
              </button>
            </>
          )}

          {/* Step 2: Config */}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="text-white/30 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-white/40 text-xs mb-1.5 block">Camera name *</label>
                  <input value={formData.name} onChange={e => update('name', e.target.value)}
                    placeholder="Front Entrance"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-white/40 text-xs mb-1.5 block">Location</label>
                  <input value={formData.location} onChange={e => update('location', e.target.value)}
                    placeholder="Building A"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
              </div>

              {cameraType === 'webcam' && (
                <div>
                  <label className="text-white/40 text-xs mb-1.5 block">Select webcam</label>
                  {webcamDevices.length === 0 ? (
                    <p className="text-yellow-400/60 text-xs p-3 bg-yellow-500/8 rounded-xl border border-yellow-500/15">No webcams detected</p>
                  ) : (
                    <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-all">
                      {webcamDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,8)}`}</option>)}
                    </select>
                  )}
                </div>
              )}

              {cameraType === 'rtsp' && (
                <>
                  <div>
                    <label className="text-white/40 text-xs mb-1.5 block">Camera brand</label>
                    <select value={selectedPreset?.brand || ''} onChange={e => { const p = CAMERA_PRESETS.find(x => x.brand === e.target.value); setSelectedPreset(p||null); if(p) update('port', String(p.defaultPort)); }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-all">
                      <option value="">Select brand…</option>
                      {CAMERA_PRESETS.map(p => <option key={p.brand} value={p.brand}>{p.brand}</option>)}
                    </select>
                    {selectedPreset && <p className="text-white/25 text-xs mt-1.5">{selectedPreset.instructions}</p>}
                  </div>
                  {selectedPreset && selectedPreset.brand !== 'Custom' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-white/40 text-xs mb-1.5 block">IP address *</label>
                        <input value={formData.ip} onChange={e => update('ip', e.target.value)} placeholder="192.168.1.100"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1.5 block">Port</label>
                        <input value={formData.port} onChange={e => update('port', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-white/25 transition-all" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">Username</label>
                      <input value={formData.username} onChange={e => update('username', e.target.value)} placeholder="admin"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">Password</label>
                      <input type="password" value={formData.password} onChange={e => update('password', e.target.value)} placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                  </div>
                  {(!selectedPreset || selectedPreset.brand === 'Custom') && (
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">RTSP URL *</label>
                      <input value={formData.streamUrl} onChange={e => update('streamUrl', e.target.value)}
                        placeholder="rtsp://user:pass@192.168.1.100:554/stream"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                  )}
                </>
              )}

              {(cameraType === 'http' || cameraType === 'file') && (
                <div>
                  <label className="text-white/40 text-xs mb-1.5 block">{cameraType === 'http' ? 'Stream URL *' : 'File URL *'}</label>
                  <input value={formData.streamUrl} onChange={e => update('streamUrl', e.target.value)}
                    placeholder={cameraType === 'http' ? 'http://192.168.1.100/video.mjpg' : '/videos/sample.mp4'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
              )}

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Enable camera</p>
                  <p className="text-white/25 text-xs mt-0.5">Active for monitoring immediately</p>
                </div>
                <button onClick={() => update('enabled', !formData.enabled)}
                  className={`w-11 h-6 rounded-full relative transition-all ${formData.enabled ? 'bg-emerald-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/8 border border-white/8 text-white/50 text-sm rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={!formData.name || isSaving}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {isSaving ? 'Saving…' : camera ? 'Save Changes' : 'Add Camera'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraManagement;