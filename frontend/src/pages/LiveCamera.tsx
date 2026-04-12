import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, Button, StatCard, Badge } from '../components/ui';
import AlertToast from '../components/AlertToast';

// 1. IMPORT BOTH URLS
import { SOCKET_URL, AI_SERVICE_URL } from '../config'; 

// ... (Detection and THREAT_LEVELS interfaces remain the same)

function LiveCamera() {
  // ... (Refs and State remain the same)

  const connectSocket = () => {
    // 2. CRITICAL FIX: Connect to AI_SERVICE_URL for frame processing
    // This stops the 404 error because the AI server handles 'video-frame'
    socketRef.current = io(AI_SERVICE_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ AI Service Connected:', AI_SERVICE_URL);
      setIsStreaming(true);
      startProcessing();
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ AI Socket Connection Error. Check if AI-Vision-Platform-1 is awake:', err.message);
    });

    socketRef.current.on('detections', (data) => {
      setDetections(data.detections || []);
      setProcessedFrames(prev => prev + 1);
    });

    // Handle alerts coming from the AI Service
    socketRef.current.on('alert-triggered', (data) => {
      console.log('🚨 ALERT:', data.alert.ruleName);
      const alertWithId = { ...data.alert, id: Date.now(), priority: data.priority };
      setActiveAlerts(prev => [...prev, alertWithId]);
      
      if (hasInteractedRef.current && (data.priority === 'critical')) {
        playAlarm();
      }
      
      if (Notification.permission === 'granted') {
        new Notification(`${data.priority === 'critical' ? '🔴' : '⚠️'} ${data.alert.ruleName}`, {
          body: data.alert.message,
        });
      }
    });
  };

  const startProcessing = () => {
    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();

    const drawLoop = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Draw detections logic... (remains the same)

      fpsCounter++;
      if (Date.now() - lastFpsUpdate >= 1000) {
        setFps(fpsCounter);
        fpsCounter = 0;
        lastFpsUpdate = Date.now();
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    // 3. SENDING FRAMES TO THE CORRECT SOCKET
    intervalRef.current = setInterval(() => {
      if (canvasRef.current && socketRef.current?.connected) {
        // Lower quality slightly to 0.5 to help Render's free tier bandwidth
        const frameData = canvasRef.current.toDataURL('image/jpeg', 0.5);
        socketRef.current.emit('video-frame', { 
          frame: frameData, 
          cameraId: 'webcam-01' 
        });
      }
    }, 1000); // 1 FPS is safe for testing
  };
  const criticalDetections = detections.filter(d => getThreatLevel(d.class) === 'critical');
  const warningDetections = detections.filter(d => getThreatLevel(d.class) === 'warning');

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {activeAlerts.map((alert) => (
          <AlertToast 
            key={alert.id} 
            alert={alert} 
            onClose={() => setActiveAlerts(prev => prev.filter(a => a.id !== alert.id))} 
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">🎥 Live Security Feed</h1>
            <p className="text-slate-400">AI-Powered Threat Detection</p>
          </div>
          <div className="flex gap-4">
            {notificationPermission !== 'granted' && (
              <Button onClick={requestNotifications} variant="secondary">
                🔔 Enable Alerts
              </Button>
            )}
            {!isStreaming ? (
              <Button onClick={startCamera} variant="primary">▶️ Start Camera</Button>
            ) : (
              <Button onClick={stopCamera} variant="danger">⏹️ Stop Camera</Button>
            )}
          </div>
        </div>

        {isStreaming && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard icon="📊" value={fps} label="FPS" />
            <StatCard icon="🎯" value={detections.length} label="Objects" />
            <StatCard icon="🔴" value={criticalDetections.length} label="Critical" />
            <StatCard icon="⚠️" value={warningDetections.length} label="Warnings" />
            <StatCard icon="🔄" value={processedFrames} label="Frames" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="relative overflow-hidden bg-black p-0">
              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} className="w-full h-auto block" style={{ maxHeight: '70vh' }} />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <p className="text-slate-400">Camera Offline</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="🎯 Live Detections">
              {detections.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Scanning...</p>
              ) : (
                <div className="space-y-2">
                  {detections.map((d, i) => {
                    const level = getThreatLevel(d.class);
                    return (
                      <div 
                        key={i} 
                        className={`flex justify-between items-center p-2 rounded ${
                          level === 'critical' ? 'bg-red-900/40 border border-red-500' :
                          level === 'warning' ? 'bg-yellow-900/30 border border-yellow-500' :
                          'bg-slate-800'
                        }`}
                      >
                        <span className="capitalize">
                          {level === 'critical' ? '🔴' : level === 'warning' ? '⚠️' : 'ℹ️'} {d.class}
                        </span>
                        <Badge variant={level === 'critical' ? 'error' : level === 'warning' ? 'warning' : 'info'}>
                          {(d.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveCamera;