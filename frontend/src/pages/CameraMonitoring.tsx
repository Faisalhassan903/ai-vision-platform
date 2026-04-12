import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CameraCanvas, ZoneList, AlertPanel } from '../components/camera';
import { useCameraStore } from '../store';
import type { Detection } from '../store';
import { Card, Button, StatCard } from '../components/ui';
// 1. IMPORT THE SOCKET URL
import { SOCKET_URL } from '../config'; 

const CameraMonitoring: React.FC = () => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local state
  const [isStreaming, setIsStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);

  // Zustand store
  const selectedCameraId = useCameraStore((state) => state.selectedCameraId);
  const setDetections = useCameraStore((state) => state.setDetections);
  const detectionsRecord = useCameraStore((state) => state.detections);
  const zonesRecord = useCameraStore((state) => state.zones);
  const alarmEnabled = useCameraStore((state) => state.alarmEnabled);
  const toggleAlarm = useCameraStore((state) => state.toggleAlarm);
  const showDetectionBoxes = useCameraStore((state) => state.showDetectionBoxes);
  const toggleDetectionBoxes = useCameraStore((state) => state.toggleDetectionBoxes);
  const showZones = useCameraStore((state) => state.showZones);
  const toggleZones = useCameraStore((state) => state.toggleZones);

  // Derived state
  const cameraId = selectedCameraId || 'webcam-1';
  const detections = detectionsRecord[cameraId] || [];
  const zones = zonesRecord[cameraId] || [];
  const personsInZone = detections.filter((d) => d.label === 'person' && d.inZone);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        connectSocket();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      alert('Camera error: ' + err.message);
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsStreaming(false);
  }, []);

  // -------------------------------------------
  // SOCKET CONNECTION
  // -------------------------------------------

  const connectSocket = () => {
    // 2. USE SOCKET_URL VARIABLE
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected to:', SOCKET_URL);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      const normalizedDetections: Detection[] = (data.detections || []).map((det: any) => ({
        label: det.class,
        confidence: det.confidence,
        x: det.bbox.x1 / 416,
        y: det.bbox.y1 / 416,
        width: (det.bbox.x2 - det.bbox.x1) / 416,
        height: (det.bbox.y2 - det.bbox.y1) / 416,
        inZone: false,
        zoneIds: [],
      }));

      setDetections(cameraId, normalizedDetections);
      setProcessedFrames((prev) => prev + 1);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
  };

  const startProcessing = () => {
    let frameCount = 0;

    const fpsInterval = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    intervalRef.current = setInterval(() => {
      if (videoRef.current && socketRef.current?.connected) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 640;
        tempCanvas.height = 480;
        const ctx = tempCanvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const frameData = tempCanvas.toDataURL('image/jpeg', 0.6);
          
          socketRef.current.emit('video-frame', {
            frame: frameData,
            cameraId,
            zones: zones,
          });
          
          frameCount++;
        }
      }
    }, 100);

    return () => {
      clearInterval(fpsInterval);
    };
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🛡️ Zone Security Monitor
            </h1>
            <p className="text-slate-400 mt-1">
              Draw zones on camera • Detect intrusions • Get alerts
            </p>
          </div>

          <div className="flex gap-3">
            {!isStreaming ? (
              <Button onClick={startCamera} variant="primary">
                ▶️ Start Camera
              </Button>
            ) : (
              <Button onClick={stopCamera} variant="danger">
                ⏹️ Stop Camera
              </Button>
            )}
          </div>
        </div>

        {isStreaming && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatCard icon="📊" value={fps} label="FPS" />
            <StatCard icon="🎯" value={detections.length} label="Detections" />
            <StatCard icon="🔲" value={zones.length} label="Zones" />
            <StatCard 
              icon="🚨" 
              value={personsInZone.length} 
              label="In Zone"
              className={personsInZone.length > 0 ? 'border-2 border-red-500 animate-pulse' : ''}
            />
            <StatCard icon="🔄" value={processedFrames} label="Frames" />
            <div className="bg-slate-800 rounded-lg p-3 flex items-center justify-center">
              <span className={`text-sm ${alarmEnabled ? 'text-green-400' : 'text-slate-500'}`}>
                {alarmEnabled ? '🔔 Alarm ON' : '🔕 Alarm OFF'}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-black p-0 overflow-hidden">
              <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
                autoPlay
              />
              
              <CameraCanvas
                cameraId={cameraId}
                videoRef={videoRef}
                isStreaming={isStreaming}
                detections={detections}
                width={640}
                height={480}
              />
            </Card>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={toggleAlarm}
                variant={alarmEnabled ? 'primary' : 'secondary'}
                className="text-sm"
              >
                {alarmEnabled ? '🔔 Alarm ON' : '🔕 Alarm OFF'}
              </Button>
              <Button
                onClick={toggleDetectionBoxes}
                variant={showDetectionBoxes ? 'primary' : 'secondary'}
                className="text-sm"
              >
                {showDetectionBoxes ? '📦 Boxes ON' : '📦 Boxes OFF'}
              </Button>
              <Button
                onClick={toggleZones}
                variant={showZones ? 'primary' : 'secondary'}
                className="text-sm"
              >
                {showZones ? '🔲 Zones ON' : '🔲 Zones OFF'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <AlertPanel />
            <ZoneList cameraId={cameraId} />
            <Card title="🎯 Live Detections">
              {detections.length === 0 ? (
                <p className="text-slate-500 text-center py-4">
                  {isStreaming ? 'Scanning...' : 'Camera offline'}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detections.map((det, i) => (
                    <div
                      key={i}
                      className={`flex justify-between items-center p-2 rounded ${
                        det.inZone
                          ? 'bg-red-900/50 border border-red-500 animate-pulse'
                          : det.label === 'person'
                          ? 'bg-yellow-900/30 border border-yellow-500/50'
                          : 'bg-slate-700/50'
                      }`}
                    >
                      <span className="capitalize text-sm">
                        {det.inZone ? '🚨' : det.label === 'person' ? '👤' : '📦'}{' '}
                        {det.label}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          det.inZone ? 'bg-red-500' : 'bg-slate-600'
                        }`}
                      >
                        {(det.confidence * 100).toFixed(0)}%
                        {det.inZone && ' IN ZONE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="📋 How to Use">
              <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
                <li>Click "Start Camera" to begin</li>
                <li>Click "Draw Zone" on the camera</li>
                <li>Click and drag to create a red zone</li>
                <li>When a person enters the zone → ALERT!</li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraMonitoring;