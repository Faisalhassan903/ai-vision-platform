import React, { useState, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

interface AnalysisResult {
  timestamp: number;
  timeLabel: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
}

// Consistent colour per class
const CLASS_COLORS: Record<string, string> = {
  person:       '#ef4444',
  car:          '#3b82f6',
  truck:        '#8b5cf6',
  motorcycle:   '#ec4899',
  bicycle:      '#14b8a6',
  bus:          '#f97316',
  dog:          '#84cc16',
  cat:          '#eab308',
  chair:        '#6366f1',
  'dining table':'#06b6d4',
  bottle:       '#a78bfa',
  laptop:       '#34d399',
  cell phone:   '#fb7185',
  backpack:     '#fbbf24',
  handbag:      '#c084fc',
};

const getColor = (cls: string) => CLASS_COLORS[cls.toLowerCase()] || '#94a3b8';

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: cocoSsd.DetectedObject[]
) => {
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 360;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  detections.forEach(p => {
    const [x, y, w, h] = p.bbox;
    const color = getColor(p.class);
    const conf  = Math.round(p.score * 100);
    const label = `${p.class}  ${conf}%`;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(x, y, w, h);

    // Fill tint
    ctx.fillStyle = color + '18';
    ctx.fillRect(x, y, w, h);

    // Corner accents
    const cl = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + cl, y);       ctx.lineTo(x, y);       ctx.lineTo(x, y + cl);
    ctx.moveTo(x + w - cl, y);   ctx.lineTo(x + w, y);   ctx.lineTo(x + w, y + cl);
    ctx.moveTo(x, y + h - cl);   ctx.lineTo(x, y + h);   ctx.lineTo(x + cl, y + h);
    ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
    ctx.strokeStyle = color;
    ctx.stroke();

    // Label pill
    ctx.font = '600 11px "DM Mono", monospace';
    const tw  = ctx.measureText(label).width;
    const ph  = 20;
    const pw  = tw + 14;
    const lx  = Math.max(0, x);
    const ly  = y > ph + 6 ? y - ph - 4 : y + h + 4;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(lx, ly, pw, ph, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx + 7, ly + 14);
  });
};

const VideoAnalysis: React.FC = () => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef  = useRef<cocoSsd.ObjectDetection | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const [file,      setFile]      = useState<File | null>(null);
  const [videoUrl,  setVideoUrl]  = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [results,   setResults]   = useState<AnalysisResult[]>([]);
  const [summary,   setSummary]   = useState<Record<string, number>>({});
  const [status,    setStatus]    = useState('');
  const [activeFrame, setActiveFrame] = useState<AnalysisResult | null>(null);

  const resetState = () => {
    setResults([]); setSummary({}); setProgress(0);
    setStatus(''); setActiveFrame(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); resetState();
    setVideoUrl(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('video/')) { setFile(f); resetState(); setVideoUrl(URL.createObjectURL(f)); }
  };

  // Draw a specific result's bounding boxes on the canvas
  const showResultOnCanvas = async (result: AnalysisResult) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    videoRef.current.currentTime = result.timestamp;
    await new Promise<void>(res => { video.onseeked = () => res(); });

    // Reconstruct detections with bbox for drawing
    const fakePreds = result.detections.map(d => ({
      class: d.class, score: d.confidence, bbox: d.bbox,
    }));
    drawFrame(ctx, canvas, video, fakePreds as cocoSsd.DetectedObject[]);
    setActiveFrame(result);
  };

  const analyzeVideo = async () => {
    if (!videoRef.current || !canvasRef.current || !file) return;
    setAnalyzing(true); resetState();

    try {
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
      const STEP     = 2;
      const frames   = Math.floor(duration / STEP);
      const collected: AnalysisResult[] = [];
      const classTotals: Record<string, number> = {};

      for (let i = 0; i <= frames; i++) {
        const t = i * STEP;
        setProgress(Math.round((i / (frames || 1)) * 100));
        setStatus(`Scanning ${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')} — frame ${i+1} of ${frames+1}`);

        await new Promise<void>(res => { video.currentTime = t; video.onseeked = () => res(); });

        const preds = await modelRef.current!.detect(video, 8, 0.30);

        // Draw live on canvas as we go
        drawFrame(ctx, canvas, video, preds);

        if (preds.length > 0) {
          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          collected.push({
            timestamp: t,
            timeLabel: `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`,
            detections: preds.map(p => ({
              class: p.class, confidence: p.score,
              bbox: p.bbox as [number, number, number, number],
            })),
          });
          preds.forEach(p => { classTotals[p.class] = (classTotals[p.class] || 0) + 1; });

          // Update results live
          setResults([...collected]);
          setSummary({ ...classTotals });
        }
      }

      setResults(collected);
      setSummary(classTotals);
      setStatus(`Complete — ${collected.length} moments with detections`);
      setProgress(100);

      // Show last frame with boxes
      if (collected.length > 0) {
        setActiveFrame(collected[collected.length - 1]);
      }

    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const jumpTo = async (result: AnalysisResult) => {
    if (videoRef.current) videoRef.current.currentTime = result.timestamp;
    await showResultOnCanvas(result);
  };

  const topClasses = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">

      {/* Upload */}
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => !file && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
          file ? 'border-white/15 bg-white/3' : 'border-white/10 hover:border-white/20 hover:bg-white/3'
        }`}>
        <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
        {!file ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff40" strokeWidth="1.75">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </div>
            <p className="text-white/50 text-sm font-medium">Drop a video file here</p>
            <p className="text-white/20 text-xs mt-1">or click to browse · MP4, MOV, AVI, MKV</p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium truncate max-w-[220px]">{file.name}</p>
                <p className="text-white/30 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setVideoUrl(null); resetState(); }}
              className="text-white/25 hover:text-white/50 transition-colors p-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Video + Canvas side by side */}
      {videoUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Original video */}
          <div className="bg-black rounded-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <span className="text-white/30 text-[10px] uppercase tracking-wide">Original</span>
            </div>
            <video ref={videoRef} src={videoUrl} controls className="w-full" />
          </div>

          {/* Analysis canvas */}
          <div className="bg-black rounded-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${analyzing ? 'bg-red-500 animate-pulse' : results.length > 0 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="text-white/30 text-[10px] uppercase tracking-wide">
                  {analyzing ? 'Analysing…' : results.length > 0 ? 'Detection View' : 'Waiting'}
                </span>
              </div>
              {activeFrame && (
                <span className="text-white/20 text-[10px] font-mono">{activeFrame.timeLabel}</span>
              )}
            </div>
            <div className="relative">
              <canvas ref={canvasRef} className="w-full h-auto block" />
              {!analyzing && results.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/15 text-xs">Bounding boxes will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analyse button */}
      {file && (
        <button onClick={analyzeVideo} disabled={analyzing}
          className="w-full py-3 bg-red-500 hover:bg-red-400 disabled:bg-red-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
          {analyzing ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{status}</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>Analyse Video</>
          )}
        </button>
      )}

      {/* Progress */}
      {analyzing && (
        <div className="space-y-1.5">
          <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-red-500 transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-white/25 text-xs text-right font-mono">{progress}%</p>
        </div>
      )}

      {/* Object summary */}
      {topClasses.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-sm font-semibold">Objects Detected</h3>
            <span className="text-white/25 text-xs">{topClasses.length} unique class{topClasses.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {topClasses.map(([cls, count]) => {
              const color = getColor(cls);
              return (
                <div key={cls} className="rounded-xl p-3 border transition-all"
                  style={{ borderColor: color + '25', background: color + '0d' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <p className="text-white/60 text-[10px] uppercase tracking-wide capitalize truncate">{cls}</p>
                  </div>
                  <p className="text-xl font-bold text-white">{count}</p>
                  <p className="text-white/25 text-[10px]">detection{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {results.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-sm font-semibold">Detection Timeline</h3>
            <span className="text-white/25 text-xs">{results.length} event{results.length !== 1 ? 's' : ''} · tap to view</span>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <button key={i} onClick={() => jumpTo(r)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  activeFrame?.timestamp === r.timestamp
                    ? 'bg-white/8 border-white/15'
                    : 'bg-white/2 hover:bg-white/5 border-white/5 hover:border-white/10'
                }`}>

                {/* Timestamp */}
                <span className="text-white/40 font-mono text-xs w-10 flex-shrink-0">{r.timeLabel}</span>

                {/* Colour dots per class */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {[...new Set(r.detections.map(d => d.class))].slice(0, 4).map(cls => (
                    <div key={cls} className="w-2 h-2 rounded-full" style={{ background: getColor(cls) }}
                      title={cls} />
                  ))}
                </div>

                {/* Detection pills */}
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {r.detections.slice(0, 4).map((d, j) => (
                    <span key={j} className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border"
                      style={{ color: getColor(d.class), borderColor: getColor(d.class) + '40', background: getColor(d.class) + '12' }}>
                      {d.class} {Math.round(d.confidence * 100)}%
                    </span>
                  ))}
                  {r.detections.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/8 text-white/30 text-[10px]">
                      +{r.detections.length - 4}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff20" strokeWidth="2" className="flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {topClasses.length > 0 && (
        <div className="bg-white/2 border border-white/5 rounded-xl p-4">
          <p className="text-white/20 text-[10px] uppercase tracking-widest mb-3">Colour Legend</p>
          <div className="flex flex-wrap gap-3">
            {topClasses.map(([cls]) => (
              <div key={cls} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: getColor(cls) }} />
                <span className="text-white/35 text-xs capitalize">{cls}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoAnalysis;