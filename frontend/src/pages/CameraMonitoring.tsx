// ===========================================
// CAMERA MONITORING PAGE
// ===========================================
// Main page for zone-based security monitoring
// Replaces: MultiCamera.tsx, ZoneCamera.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CameraCanvas, ZoneList, AlertPanel } from '../components/camera';
import { useCameraStore } from '../store';
import type { Detection } from '../store';
import { Card, Button, StatCard } from '../components/ui';

// -------------------------------------------
// COMPONENT
// -------------------------------------------

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

  // -------------------------------------------
  // CAMERA CONTROL
  // -------------------------------------------

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
    // Stop video stream
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Disconnect socket
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
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected');
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('detections', (data) => {
      // Convert backend detection format to our normalized format
      const normalizedDetections: Detection[] = (data.detections || []).map((det: any) => ({
        label: det.class,
        confidence: det.confidence,
        // Convert from YOLO bbox to normalized coords
        // Backend sends x1,y1,x2,y2 in 416x416 scale
        x: det.bbox.x1 / 416,
        y: det.bbox.y1 / 416,
        width: (det.bbox.x2 - det.bbox.x1) / 416,
        height: (det.bbox.y2 - det.bbox.y1) / 416,
        inZone: false,  // Will be set by store
        zoneIds: [],
      }));

      // Update store (this will also check zone intersections)
      setDetections(cameraId, normalizedDetections);
      setProcessedFrames((prev) => prev + 1);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
  };

  // -------------------------------------------
  // FRAME PROCESSING
  // -------------------------------------------

  const startProcessing = () => {
    let frameCount = 0;
    let lastFpsUpdate = Date.now();

    // FPS counter
    const fpsInterval = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    // Send frames to backend
    intervalRef.current = setInterval(() => {
      if (videoRef.current && socketRef.current?.connected) {
        // Create temp canvas to capture frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 640;
        tempCanvas.height = 480;
        const ctx = tempCanvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const frameData = tempCanvas.toDataURL('image/jpeg', 0.6);
          
          // Send frame with zone data
          socketRef.current.emit('video-frame', {
            frame: frameData,
            cameraId,
            zones: zones,  // Send zones for backend processing if needed
          });
          
          frameCount++;
        }
      }
    }, 100);  // ~10 FPS for processing

    // Cleanup on unmount
    return () => {
      clearInterval(fpsInterval);
    };
  };

  // -------------------------------------------
  // CLEANUP ON UNMOUNT
  // -------------------------------------------

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // -------------------------------------------
  // RENDER
  // -------------------------------------------

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
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

        {/* Stats Bar */}
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Camera View (2/3 width) */}
          <div className="lg:col-span-2">
            <Card className="bg-black p-0 overflow-hidden">
              {/* Hidden video element */}
              <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
                autoPlay
              />
              
              {/* Canvas with zone drawing */}
              <CameraCanvas
                cameraId={cameraId}
                videoRef={videoRef}
                isStreaming={isStreaming}
                detections={detections}
                width={640}
                height={480}
              />
            </Card>

            {/* Controls below camera */}
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

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Alert Panel */}
            <AlertPanel />

            {/* Zone List */}
            <ZoneList cameraId={cameraId} />

            {/* Detection List */}
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

            {/* Instructions */}
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
