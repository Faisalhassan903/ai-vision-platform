// Multi-camera grid: RTSP IP cameras via backend proxy, webcams via browser

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCameraStore } from '../store';
import type { Camera, Detection } from '../store';
import { SOCKET_URL } from '../config';
import RtspStreamPlayer from '../components/camera/RtspStreamPlayer';
import { useCameras } from '../hooks/useCameras';

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

function normalizeDetectionsFromApi(data: { detections?: any[] }, base = 640): Detection[] {
  return (data.detections || []).map((det: any) => {
    const w = det.bbox?.x2 != null ? det.bbox.x2 - det.bbox.x1 : 0;
    const h = det.bbox?.y2 != null ? det.bbox.y2 - det.bbox.y1 : 0;
    return {
      label: det.class,
      confidence: det.confidence,
      x: (det.bbox?.x1 ?? 0) / base,
      y: (det.bbox?.y1 ?? 0) / base,
      width: w / base,
      height: h / base,
      inZone: false,
      zoneIds: [],
    };
  });
}

const MultiCameraView: React.FC = () => {
  useCameras();
  const cameras = useCameraStore((s) => s.cameras);
  const setDetections = useCameraStore((s) => s.setDetections);
  const [layout, setLayout] = useState<GridLayout>('2x2');
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);

  const getGridCols = (l: GridLayout) => ({ '1x1': 1, '2x2': 2, '3x3': 3, '4x4': 4 }[l]);
  const getMaxCameras = (l: GridLayout) => Math.pow(getGridCols(l), 2);

  const onDetections = useCallback(
    (cameraId: string, data: { detections?: any[] }) => {
      setDetections(cameraId, normalizeDetectionsFromApi(data));
    },
    [setDetections]
  );

  const onAlert = useCallback((camera: Camera, data: any) => {
    setGlobalAlerts((prev) => [
      {
        id: `${camera.id}-${Date.now()}`,
        cameraId: camera.id,
        cameraName: camera.name,
        ...data.alert,
        timestamp: new Date(),
      },
      ...prev,
    ].slice(0, 50));
  }, []);

  const displayCameras = cameras.filter((c) => c.enabled).slice(0, getMaxCameras(layout));

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <header className="bg-[#0d1424] border-b border-slate-800 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Multi-Camera View</h1>
            <p className="text-xs text-slate-500">
              {displayCameras.length} active · RTSP IP cameras + webcam
            </p>
          </div>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLayout(l)}
                className={`px-3 py-1.5 rounded-md text-sm ${layout === l ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4">
        {displayCameras.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-white mb-2">No cameras yet</p>
            <p className="text-sm">Add an RTSP camera under Cameras → then open Grid.</p>
          </div>
        ) : (
          <div
            className="grid gap-4 max-w-[1920px] mx-auto"
            style={{ gridTemplateColumns: `repeat(${getGridCols(layout)}, 1fr)` }}
          >
            {displayCameras.map((camera) => (
              <CameraGridItem
                key={camera.id}
                camera={camera}
                onExpand={() => setExpandedCamera(camera.id)}
                onDetections={(d) => onDetections(camera.id, d)}
                onAlert={(d) => onAlert(camera, d)}
              />
            ))}
          </div>
        )}
      </main>

      {expandedCamera && (() => {
        const cam = cameras.find((c) => c.id === expandedCamera);
        if (!cam) return null;
        return (
          <ExpandedCameraModal
            camera={cam}
            onClose={() => setExpandedCamera(null)}
            onDetections={(d) => onDetections(cam.id, d)}
            onAlert={(d) => onAlert(cam, d)}
          />
        );
      })()}
    </div>
  );
};

interface GridItemProps {
  camera: Camera;
  onExpand: () => void;
  onDetections: (data: { detections?: any[] }) => void;
  onAlert: (data: unknown) => void;
}

const CameraGridItem: React.FC<GridItemProps> = ({ camera, onExpand, onDetections, onAlert }) => (
  <div className="bg-[#111827] rounded-xl overflow-hidden border border-slate-800">
    <div className="px-3 py-2 bg-[#0d1424] flex justify-between items-center">
      <span className="text-sm text-white truncate">{camera.name}</span>
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase text-slate-500 font-mono">{camera.type}</span>
        <button type="button" onClick={onExpand} className="text-slate-400 text-xs hover:text-white">
          Expand
        </button>
      </div>
    </div>
    <div className="relative aspect-video bg-black">
      {camera.type === 'rtsp' ? (
        <RtspStreamPlayer
          camera={camera}
          onDetections={onDetections}
          onAlert={onAlert}
        />
      ) : (
        <WebcamGridPlayer camera={camera} onDetections={onDetections} onAlert={onAlert} />
      )}
    </div>
  </div>
);

const WebcamGridPlayer: React.FC<GridItemProps> = ({ camera, onDetections, onAlert }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const socket = io(SOCKET_URL, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsStreaming(true);
        intervalRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || !socket.connected) return;
          const ctx = canvas.getContext('2d');
          canvas.width = 640;
          canvas.height = 480;
          ctx?.drawImage(video, 0, 0, 640, 480);
          socket.emit('video-frame', {
            frame: canvas.toDataURL('image/jpeg', 0.5),
            cameraId: camera.id,
            cameraName: camera.name,
          });
        }, 400);
      });

      socket.on('detections', onDetections);
      socket.on('alert-triggered', onAlert);
    } catch (err) {
      console.error(err);
    }
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    socketRef.current?.disconnect();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    setIsStreaming(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
      {!isStreaming ? (
        <button
          type="button"
          onClick={start}
          className="absolute inset-0 m-auto w-24 h-10 bg-blue-600 text-white text-sm rounded-lg"
        >
          Start webcam
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded"
        >
          Stop
        </button>
      )}
    </div>
  );
};

const ExpandedCameraModal: React.FC<GridItemProps & { onClose: () => void }> = ({
  camera,
  onClose,
  onDetections,
  onAlert,
}) => (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
    <div className="bg-[#111827] w-full max-w-5xl rounded-xl overflow-hidden border border-slate-700">
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700">
        <h2 className="text-lg text-white font-semibold">{camera.name}</h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">
          ×
        </button>
      </div>
      <div className="aspect-video bg-black min-h-[300px]">
        {camera.type === 'rtsp' ? (
          <RtspStreamPlayer camera={camera} autoStart onDetections={onDetections} onAlert={onAlert} />
        ) : (
          <WebcamGridPlayer camera={camera} onExpand={() => {}} onDetections={onDetections} onAlert={onAlert} />
        )}
      </div>
    </div>
  </div>
);

export default MultiCameraView;
