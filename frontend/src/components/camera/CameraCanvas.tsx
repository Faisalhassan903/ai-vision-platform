// ===========================================
// CAMERA CANVAS COMPONENT
// ===========================================
// Handles: Video rendering, Zone drawing, Detection boxes
// This is the CORE visual component - reusable across pages

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCameraStore } from '../../store';
import type { Zone, Detection } from '../../store';

// -------------------------------------------
// TYPES
// -------------------------------------------

interface CameraCanvasProps {
  cameraId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  detections: Detection[];
  width?: number;
  height?: number;
  onZoneCreated?: (zone: Zone) => void;
}

// Threat level colors (from your LiveCamera)
const THREAT_COLORS = {
  critical: '#ef4444',  // Red
  warning: '#f59e0b',   // Yellow
  info: '#3b82f6',      // Blue
  inZone: '#ff0000',    // Bright red for zone alerts
};

const THREAT_LEVELS: Record<string, 'critical' | 'warning' | 'info'> = {
  person: 'critical',
  knife: 'critical',
  scissors: 'critical',
  bottle: 'critical',
  backpack: 'warning',
  handbag: 'warning',
  suitcase: 'warning',
};

// -------------------------------------------
// COMPONENT
// -------------------------------------------

const CameraCanvas: React.FC<CameraCanvasProps> = ({
  cameraId,
  videoRef,
  isStreaming,
  detections,
  width = 640,
  height = 480,
  onZoneCreated,
}) => {
  // Canvas ref for drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Zone drawing state (local, not in Zustand)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);

  // Get zones from Zustand store
  const zonesRecord = useCameraStore((state) => state.zones);
  const addZone = useCameraStore((state) => state.addZone);
  const showZones = useCameraStore((state) => state.showZones);
  const showDetectionBoxes = useCameraStore((state) => state.showDetectionBoxes);

  // Get zones for THIS camera
  const zones = zonesRecord[cameraId] || [];

  // -------------------------------------------
  // HELPER: Get threat level for object class
  // -------------------------------------------
  const getThreatLevel = (objectClass: string): 'critical' | 'warning' | 'info' => {
    return THREAT_LEVELS[objectClass.toLowerCase()] || 'info';
  };

  // -------------------------------------------
  // HELPER: Convert mouse event to normalized coords (0-1)
  // -------------------------------------------
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;  // Normalized 0-1
    const y = (e.clientY - rect.top) / rect.height;  // Normalized 0-1
    
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  // -------------------------------------------
  // MOUSE HANDLERS FOR ZONE DRAWING
  // -------------------------------------------
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled) return;
    
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
    
    console.log('[Canvas] Started drawing at:', coords);
  }, [drawingEnabled, getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingEnabled) return;
    
    const coords = getCanvasCoords(e);
    setDrawCurrent(coords);
  }, [isDrawing, drawingEnabled, getCanvasCoords]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !drawCurrent || !drawingEnabled) {
      setIsDrawing(false);
      return;
    }

    // Calculate zone dimensions
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const zoneWidth = Math.abs(drawCurrent.x - drawStart.x);
    const zoneHeight = Math.abs(drawCurrent.y - drawStart.y);

    // Only create zone if it's big enough (at least 5% of canvas)
    if (zoneWidth > 0.05 && zoneHeight > 0.05) {
      const newZone: Zone = {
        id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        cameraId,
        name: `Zone ${zones.length + 1}`,
        x,
        y,
        width: zoneWidth,
        height: zoneHeight,
        color: '#ff0000',
        enabled: true,
        createdAt: Date.now(),
      };

      // Add to Zustand store
      addZone(newZone);
      
      console.log('[Canvas] Created zone:', newZone.name);
      
      // Callback if provided
      if (onZoneCreated) {
        onZoneCreated(newZone);
      }
    }

    // Reset drawing state
    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }, [isDrawing, drawStart, drawCurrent, drawingEnabled, cameraId, zones.length, addZone, onZoneCreated]);

  // -------------------------------------------
  // MAIN DRAW LOOP
  // -------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw video frame (or black background)
      if (video && isStreaming && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
        
        // Show "Camera Offline" text
        if (!isStreaming) {
          ctx.fillStyle = '#64748b';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Camera Offline', width / 2, height / 2);
        }
      }

      // Draw existing zones
      if (showZones) {
        zones.forEach((zone) => {
          if (!zone.enabled) return;

          const zx = zone.x * width;
          const zy = zone.y * height;
          const zw = zone.width * width;
          const zh = zone.height * height;

          // Zone border
          ctx.strokeStyle = zone.color || '#ff0000';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);  // Dashed line
          ctx.strokeRect(zx, zy, zw, zh);
          ctx.setLineDash([]);  // Reset

          // Zone fill (semi-transparent)
          ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          ctx.fillRect(zx, zy, zw, zh);

          // Zone label
          ctx.font = 'bold 14px Arial';
          const labelWidth = ctx.measureText(zone.name).width;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.fillRect(zx, zy - 22, labelWidth + 10, 22);
          ctx.fillStyle = 'white';
          ctx.fillText(zone.name, zx + 5, zy - 6);
        });
      }

      // Draw detection boxes
      if (showDetectionBoxes && detections.length > 0) {
        detections.forEach((det) => {
          // Scale from normalized (0-1) to canvas pixels
          const x1 = det.x * width;
          const y1 = det.y * height;
          const w = det.width * width;
          const h = det.height * height;

          // Determine color based on zone status
          let color: string;
          let lineWidth: number;

          if (det.inZone) {
            // IN ZONE = RED + PULSE
            color = THREAT_COLORS.inZone;
            lineWidth = 4;

            // Pulsing fill effect
            const alpha = 0.2 + 0.2 * Math.sin(Date.now() / 150);
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.fillRect(x1, y1, w, h);
          } else {
            // Normal detection
            const level = getThreatLevel(det.label);
            color = THREAT_COLORS[level];
            lineWidth = level === 'critical' ? 3 : 2;

            // Pulse for critical (person) even outside zone
            if (level === 'critical') {
              const alpha = 0.1 + 0.1 * Math.sin(Date.now() / 200);
              ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
              ctx.fillRect(x1, y1, w, h);
            }
          }

          // Draw bounding box
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.strokeRect(x1, y1, w, h);

          // Draw label
          const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%${det.inZone ? ' ⚠️' : ''}`;
          ctx.font = 'bold 14px Arial';
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = color;
          ctx.fillRect(x1, y1 - 22, textWidth + 10, 22);
          ctx.fillStyle = 'white';
          ctx.fillText(label, x1 + 5, y1 - 6);
        });
      }

      // Draw zone being created (preview rectangle)
      if (isDrawing && drawStart && drawCurrent) {
        const x = Math.min(drawStart.x, drawCurrent.x) * width;
        const y = Math.min(drawStart.y, drawCurrent.y) * height;
        const w = Math.abs(drawCurrent.x - drawStart.x) * width;
        const h = Math.abs(drawCurrent.y - drawStart.y) * height;

        // Preview rectangle
        ctx.strokeStyle = '#00ff00';  // Green for preview
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Preview fill
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(x, y, w, h);

        // Size indicator
        ctx.font = '12px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(
          `${(Math.abs(drawCurrent.x - drawStart.x) * 100).toFixed(0)}% × ${(Math.abs(drawCurrent.y - drawStart.y) * 100).toFixed(0)}%`,
          x + 5,
          y + 15
        );
      }

      // Draw mode indicator
      if (drawingEnabled) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(10, 10, 120, 25);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('✏️ DRAW MODE', 18, 27);
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Start drawing
    draw();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef, isStreaming, detections, zones, width, height, showZones, showDetectionBoxes, isDrawing, drawStart, drawCurrent, drawingEnabled]);

  // -------------------------------------------
  // RENDER
  // -------------------------------------------
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className={`w-full h-auto block rounded-lg ${drawingEnabled ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ maxHeight: '70vh' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setDrawStart(null);
            setDrawCurrent(null);
          }
        }}
      />

      {/* Draw Mode Toggle Button */}
      <button
        onClick={() => setDrawingEnabled(!drawingEnabled)}
        className={`absolute bottom-4 right-4 px-4 py-2 rounded-lg font-semibold transition-all ${
          drawingEnabled
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        {drawingEnabled ? '✓ Drawing ON' : '✏️ Draw Zone'}
      </button>

      {/* Zone Count Badge */}
      {zones.length > 0 && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
          {zones.length} Zone{zones.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default CameraCanvas;
