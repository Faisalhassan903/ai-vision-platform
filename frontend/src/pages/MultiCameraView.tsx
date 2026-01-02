// ===========================================
// MULTI-CAMERA VIEW PAGE
// ===========================================
// Grid view for monitoring multiple cameras simultaneously
// Supports 2x2, 3x3, 4x4 layouts with click-to-expand

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { useCameraStore } from '../store';
import type { Camera, Detection, Zone } from '../store';

// -------------------------------------------
// TYPES
// -------------------------------------------

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

interface CameraStream {
  cameraId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  socket: Socket | null;
  isStreaming: boolean;
  detections: Detection[];
  fps: number;
  error: string | null;
}

// -------------------------------------------
// MAIN COMPONENT
// -------------------------------------------

const MultiCameraView: React.FC = () => {
  // Zustand store
  const cameras = useCameraStore((s) => s.cameras);
  const zonesRecord = useCameraStore((s) => s.zones);
  const setDetections = useCameraStore((s) => s.setDetections);

  // State
  const [layout, setLayout] = useState<GridLayout>('2x2');
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [streams, setStreams] = useState<Map<string, CameraStream>>(new Map());
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);

  // Socket refs for each camera
  const socketsRef = useRef<Map<string, Socket>>(new Map());
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Get grid dimensions
  const getGridCols = (layout: GridLayout) => {
    const cols: Record<GridLayout, number> = {
      '1x1': 1, '2x2': 2, '3x3': 3, '4x4': 4
    };
    return cols[layout];
  };

  // Calculate max cameras for layout
  const getMaxCameras = (layout: GridLayout) => {
    return Math.pow(getGridCols(layout), 2);
  };

  // Connect camera to backend
  const connectCamera = useCallback((camera: Camera) => {
    if (socketsRef.current.has(camera.id)) return;

    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      query: { cameraId: camera.id }
    });

    socket.on('connect', () => {
      console.log(`✅ Camera ${camera.name} connected`);
      setStreams((prev) => {
        const newMap = new Map(prev);
        const stream = newMap.get(camera.id);
        if (stream) {
          newMap.set(camera.id, { ...stream, isStreaming: true, error: null });
        }
        return newMap;
      });
    });

    socket.on('detections', (data) => {
      const normalized: Detection[] = (data.detections || []).map((det: any) => ({
        label: det.class,
        confidence: det.confidence,
        x: det.bbox.x1 / 416,
        y: det.bbox.y1 / 416,
        width: (det.bbox.x2 - det.bbox.x1) / 416,
        height: (det.bbox.y2 - det.bbox.y1) / 416,
        inZone: false,
        zoneIds: []
      }));

      setDetections(camera.id, normalized);

      setStreams((prev) => {
        const newMap = new Map(prev);
        const stream = newMap.get(camera.id);
        if (stream) {
          newMap.set(camera.id, { ...stream, detections: normalized });
        }
        return newMap;
      });
    });

    socket.on('alert-triggered', (data) => {
      setGlobalAlerts((prev) => [{
        id: `${camera.id}-${Date.now()}`,
        cameraId: camera.id,
        cameraName: camera.name,
        ...data.alert,
        timestamp: new Date()
      }, ...prev].slice(0, 50));
    });

    socket.on('disconnect', () => {
      setStreams((prev) => {
        const newMap = new Map(prev);
        const stream = newMap.get(camera.id);
        if (stream) {
          newMap.set(camera.id, { ...stream, isStreaming: false });
        }
        return newMap;
      });
    });

    socketsRef.current.set(camera.id, socket);
  }, [setDetections]);

  // Disconnect camera
  const disconnectCamera = useCallback((cameraId: string) => {
    const socket = socketsRef.current.get(cameraId);
    if (socket) {
      socket.disconnect();
      socketsRef.current.delete(cameraId);
    }

    const interval = intervalsRef.current.get(cameraId);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(cameraId);
    }
  }, []);

  // Initialize streams for enabled cameras
  useEffect(() => {
    const enabledCameras = cameras.filter((c) => c.enabled);
    
    enabledCameras.forEach((camera) => {
      if (!streams.has(camera.id)) {
        setStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(camera.id, {
            cameraId: camera.id,
            videoRef: React.createRef(),
            canvasRef: React.createRef(),
            socket: null,
            isStreaming: false,
            detections: [],
            fps: 0,
            error: null
          });
          return newMap;
        });
      }
    });
  }, [cameras]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketsRef.current.forEach((socket) => socket.disconnect());
      intervalsRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Get cameras to display
  const displayCameras = cameras.filter((c) => c.enabled).slice(0, getMaxCameras(layout));
  const unacknowledgedAlerts = globalAlerts.filter((a) => !a.acknowledged);

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="bg-[#0d1424] border-b border-slate-800 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">📹</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Multi-Camera View</h1>
              <p className="text-xs text-slate-500">
                {displayCameras.length} of {cameras.length} cameras active
              </p>
            </div>

            {/* Alert Badge */}
            {unacknowledgedAlerts.length > 0 && (
              <div className="flex items-center gap-2 ml-4 px-3 py-1.5 bg-red-600/20 border border-red-600/30 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-400 font-medium">
                  {unacknowledgedAlerts.length} Alert{unacknowledgedAlerts.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Layout Selector */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
              {(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    layout === l
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Manage Cameras Link */}
            <Link
              to="/cameras"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition border border-slate-700"
            >
              ⚙️ Manage Cameras
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {cameras.length === 0 ? (
          <EmptyState />
        ) : displayCameras.length === 0 ? (
          <NoCamerasEnabled />
        ) : (
          <div 
            className="grid gap-4 max-w-[1920px] mx-auto"
            style={{
              gridTemplateColumns: `repeat(${getGridCols(layout)}, 1fr)`,
            }}
          >
            {displayCameras.map((camera) => (
              <CameraGridItem
                key={camera.id}
                camera={camera}
                zones={zonesRecord[camera.id] || []}
                isExpanded={expandedCamera === camera.id}
                onExpand={() => setExpandedCamera(expandedCamera === camera.id ? null : camera.id)}
                onConnect={() => connectCamera(camera)}
                layout={layout}
              />
            ))}
          </div>
        )}
      </main>

      {/* Expanded Camera Modal */}
      {expandedCamera && (
        <ExpandedCameraModal
          camera={cameras.find((c) => c.id === expandedCamera)!}
          zones={zonesRecord[expandedCamera] || []}
          onClose={() => setExpandedCamera(null)}
        />
      )}

      {/* Global Alerts Panel */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 w-80 bg-[#111827] rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 bg-red-600/20 border-b border-red-600/30 flex justify-between items-center">
            <span className="font-semibold text-red-400">🚨 Active Alerts</span>
            <button
              onClick={() => setGlobalAlerts([])}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {unacknowledgedAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-4 py-3 border-b border-slate-800">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-white">{alert.ruleName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      📹 {alert.cameraName}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    alert.priority === 'critical' ? 'bg-red-600' : 'bg-yellow-600'
                  } text-white`}>
                    {alert.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------
// CAMERA GRID ITEM
// -------------------------------------------

interface CameraGridItemProps {
  camera: Camera;
  zones: Zone[];
  isExpanded: boolean;
  onExpand: () => void;
  onConnect: () => void;
  layout: GridLayout;
}

const CameraGridItem: React.FC<CameraGridItemProps> = ({
  camera,
  zones,
  isExpanded,
  onExpand,
  onConnect,
  layout
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [detections, setLocalDetections] = useState<any[]>([]);
  const [hasAlert, setHasAlert] = useState(false);

  const setDetections = useCameraStore((s) => s.setDetections);
  const detectionsRecord = useCameraStore((s) => s.detections);
  const storeDetections = detectionsRecord[camera.id] || [];

  // Start streaming
  const startStream = async () => {
    try {
      if (camera.type === 'webcam') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          connectSocket();
        }
      }
      // TODO: Add RTSP support via backend proxy
    } catch (err: any) {
      console.error(`Camera ${camera.name} error:`, err);
    }
  };

  // Connect socket
  const connectSocket = () => {
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      setIsStreaming(true);
      startFrameLoop();
    });

    socketRef.current.on('detections', (data) => {
      const normalized = (data.detections || []).map((det: any) => ({
        label: det.class,
        confidence: det.confidence,
        x: det.bbox.x1 / 416,
        y: det.bbox.y1 / 416,
        width: (det.bbox.x2 - det.bbox.x1) / 416,
        height: (det.bbox.y2 - det.bbox.y1) / 416,
        inZone: false,
        zoneIds: []
      }));

      setLocalDetections(data.detections || []);
      setDetections(camera.id, normalized);
    });

    socketRef.current.on('alert-triggered', () => {
      setHasAlert(true);
      setTimeout(() => setHasAlert(false), 3000);
    });
  };

  // Frame loop
  const startFrameLoop = () => {
    const render = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && video && ctx && video.readyState >= 2) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw zones
        zones.forEach((zone) => {
          if (!zone.enabled) return;
          const zx = zone.x * canvas.width;
          const zy = zone.y * canvas.height;
          const zw = zone.width * canvas.width;
          const zh = zone.height * canvas.height;

          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(zx, zy, zw, zh);
          ctx.setLineDash([]);
        });

        // Draw detections
        detections.forEach((det) => {
          const scaleX = canvas.width / 416;
          const scaleY = canvas.height / 416;
          const x = det.bbox.x1 * scaleX;
          const y = det.bbox.y1 * scaleY;
          const w = (det.bbox.x2 - det.bbox.x1) * scaleX;
          const h = (det.bbox.y2 - det.bbox.y1) * scaleY;

          ctx.strokeStyle = det.class === 'person' ? '#ef4444' : '#3b82f6';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          ctx.fillStyle = det.class === 'person' ? '#ef4444' : '#3b82f6';
          ctx.font = 'bold 10px Arial';
          ctx.fillText(`${det.class} ${(det.confidence * 100).toFixed(0)}%`, x, y - 4);
        });
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    // Send frames
    frameIntervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.6);
        socketRef.current.emit('video-frame', {
          frame: frameData,
          cameraId: camera.id
        });
      }
    }, 1000);
  };

  // Stop streaming
  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    setIsStreaming(false);
  };

  // Cleanup
  useEffect(() => {
    return () => stopStream();
  }, []);

  const personsInZone = storeDetections.filter((d) => d.label === 'person' && d.inZone);

  return (
    <div className={`bg-[#111827] rounded-xl overflow-hidden border transition-all ${
      hasAlert || personsInZone.length > 0
        ? 'border-red-500 shadow-lg shadow-red-500/20'
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      {/* Camera Header */}
      <div className="px-3 py-2 bg-[#0d1424] border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isStreaming ? 'bg-green-500 animate-pulse' : 'bg-slate-600'
          }`} />
          <span className="text-sm font-medium text-white truncate max-w-[120px]">
            {camera.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {zones.length > 0 && (
            <span className="text-xs bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded">
              {zones.length} zone{zones.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onExpand}
            className="p-1 hover:bg-slate-700 rounded transition"
            title="Expand"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full" />

        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
            <span className="text-3xl mb-2">📹</span>
            <p className="text-slate-500 text-sm mb-3">{camera.type.toUpperCase()}</p>
            <button
              onClick={startStream}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              ▶️ Start
            </button>
          </div>
        )}

        {/* Alert Overlay */}
        {(hasAlert || personsInZone.length > 0) && (
          <div className="absolute inset-0 border-4 border-red-500 pointer-events-none animate-pulse" />
        )}

        {/* Detection Count */}
        {isStreaming && detections.length > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
            {detections.length} object{detections.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------
// EXPANDED CAMERA MODAL
// -------------------------------------------

interface ExpandedCameraModalProps {
  camera: Camera;
  zones: Zone[];
  onClose: () => void;
}

const ExpandedCameraModal: React.FC<ExpandedCameraModalProps> = ({ camera, zones, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-5xl">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white text-3xl hover:text-slate-300"
        >
          ×
        </button>
        <div className="bg-[#111827] rounded-2xl overflow-hidden border border-slate-700">
          <div className="px-4 py-3 bg-[#0d1424] border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-white">{camera.name}</span>
              {camera.location && (
                <span className="text-sm text-slate-400">📍 {camera.location}</span>
              )}
            </div>
            <Link
              to={`/monitor?camera=${camera.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              Open in Monitor →
            </Link>
          </div>
          <div className="aspect-video bg-black flex items-center justify-center">
            <p className="text-slate-500">Full monitoring view coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------
// EMPTY STATES
// -------------------------------------------

const EmptyState: React.FC = () => (
  <div className="text-center py-20">
    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
      <span className="text-5xl">📹</span>
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">No Cameras Configured</h2>
    <p className="text-slate-400 mb-8">Add cameras to start multi-camera monitoring.</p>
    <Link
      to="/cameras"
      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold"
    >
      + Add Cameras
    </Link>
  </div>
);

const NoCamerasEnabled: React.FC = () => (
  <div className="text-center py-20">
    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
      <span className="text-5xl">⏸️</span>
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">All Cameras Disabled</h2>
    <p className="text-slate-400 mb-8">Enable cameras in the management page to start monitoring.</p>
    <Link
      to="/cameras"
      className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold"
    >
      ⚙️ Manage Cameras
    </Link>
  </div>
);

export default MultiCameraView;
