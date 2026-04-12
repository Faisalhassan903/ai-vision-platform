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
// IMPORT PRODUCTION URLS
import { SOCKET_URL } from '../config'; 

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
  const cameras = useCameraStore((s) => s.cameras);
  const zonesRecord = useCameraStore((s) => s.zones);
  const setDetections = useCameraStore((s) => s.setDetections);

  const [layout, setLayout] = useState<GridLayout>('2x2');
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [streams, setStreams] = useState<Map<string, CameraStream>>(new Map());
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);

  const socketsRef = useRef<Map<string, Socket>>(new Map());
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getGridCols = (layout: GridLayout) => {
    const cols: Record<GridLayout, number> = { '1x1': 1, '2x2': 2, '3x3': 3, '4x4': 4 };
    return cols[layout];
  };

  const getMaxCameras = (layout: GridLayout) => Math.pow(getGridCols(layout), 2);

  const connectCamera = useCallback((camera: Camera) => {
    if (socketsRef.current.has(camera.id)) return;

    // Use SOCKET_URL from config
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { cameraId: camera.id }
    });

    socket.on('connect', () => {
      console.log(`✅ Camera ${camera.name} connected to ${SOCKET_URL}`);
      setStreams((prev) => {
        const newMap = new Map(prev);
        const stream = newMap.get(camera.id);
        if (stream) newMap.set(camera.id, { ...stream, isStreaming: true, error: null });
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
        if (stream) newMap.set(camera.id, { ...stream, isStreaming: false });
        return newMap;
      });
    });

    socketsRef.current.set(camera.id, socket);
  }, [setDetections]);

  useEffect(() => {
    return () => {
      socketsRef.current.forEach((socket) => socket.disconnect());
      intervalsRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const displayCameras = cameras.filter((c) => c.enabled).slice(0, getMaxCameras(layout));
  const unacknowledgedAlerts = globalAlerts.filter((a) => !a.acknowledged);

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <header className="bg-[#0d1424] border-b border-slate-800 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">📹</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Multi-Camera View</h1>
              <p className="text-xs text-slate-500">{displayCameras.length} active</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
              {(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`px-3 py-1.5 rounded-md text-sm transition ${layout === l ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4">
        <div 
          className="grid gap-4 max-w-[1920px] mx-auto"
          style={{ gridTemplateColumns: `repeat(${getGridCols(layout)}, 1fr)` }}
        >
          {displayCameras.map((camera) => (
            <CameraGridItem
              key={camera.id}
              camera={camera}
              zones={zonesRecord[camera.id] || []}
              onExpand={() => setExpandedCamera(camera.id)}
            />
          ))}
        </div>
      </main>

      {expandedCamera && (
        <ExpandedCameraModal
          camera={cameras.find((c) => c.id === expandedCamera)!}
          onClose={() => setExpandedCamera(null)}
        />
      )}
    </div>
  );
};

// -------------------------------------------
// CAMERA GRID ITEM
// -------------------------------------------

const CameraGridItem: React.FC<{ camera: Camera; zones: Zone[]; onExpand: () => void }> = ({ camera, zones, onExpand }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        socketRef.current = io(SOCKET_URL);
        socketRef.current.on('connect', () => {
          setIsStreaming(true);
          frameIntervalRef.current = setInterval(() => {
            if (canvasRef.current && socketRef.current?.connected) {
              const ctx = canvasRef.current.getContext('2d');
              canvasRef.current.width = 640;
              canvasRef.current.height = 480;
              ctx?.drawImage(videoRef.current!, 0, 0, 640, 480);
              socketRef.current.emit('video-frame', {
                frame: canvasRef.current.toDataURL('image/jpeg', 0.5),
                cameraId: camera.id
              });
            }
          }, 200);
        });
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="bg-[#111827] rounded-xl overflow-hidden border border-slate-800">
      <div className="px-3 py-2 bg-[#0d1424] flex justify-between items-center">
        <span className="text-sm text-white">{camera.name}</span>
        <button onClick={onExpand} className="text-slate-400 text-xs">Expand</button>
      </div>
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full" />
        {!isStreaming && (
          <button onClick={startStream} className="absolute inset-0 m-auto w-20 h-10 bg-blue-600 text-white rounded">
            Start
          </button>
        )}
      </div>
    </div>
  );
};

const ExpandedCameraModal: React.FC<{ camera: Camera; onClose: () => void }> = ({ camera, onClose }) => (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
    <div className="bg-[#111827] w-full max-w-4xl p-4 rounded-xl">
       <div className="flex justify-between mb-4">
         <h2 className="text-xl text-white font-bold">{camera.name}</h2>
         <button onClick={onClose} className="text-white text-2xl">&times;</button>
       </div>
       <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-slate-500">
         Full View Rendering...
       </div>
    </div>
  </div>
);

export default MultiCameraView;