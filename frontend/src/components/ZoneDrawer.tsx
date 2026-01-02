import { useState, useRef, useEffect } from 'react';

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'restricted' | 'warning' | 'monitored';
}

interface ZoneDrawerProps {
  videoWidth: number;
  videoHeight: number;
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
  isDrawing: boolean;
}

function ZoneDrawer({ videoWidth, videoHeight, zones, onZonesChange, isDrawing }: ZoneDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingZone, setDrawingZone] = useState<Zone | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    // Draw all zones
    zones.forEach(zone => {
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

      // Draw zone label
      ctx.fillStyle = zone.color;
      ctx.fillRect(zone.x, zone.y - 25, ctx.measureText(zone.name).width + 10, 25);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(zone.name, zone.x + 5, zone.y - 7);

      // Semi-transparent fill
      ctx.fillStyle = zone.color + '20';
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    });

    // Draw zone being created
    if (drawingZone) {
      ctx.strokeStyle = drawingZone.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(drawingZone.x, drawingZone.y, drawingZone.width, drawingZone.height);
      ctx.setLineDash([]);
    }
  }, [zones, drawingZone, videoWidth, videoHeight]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setDrawingZone({
      id: 'temp',
      name: 'New Zone',
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y),
      color: '#ef4444',
      type: 'restricted'
    });
  };

  const handleMouseUp = () => {
    if (!drawingZone || !startPos) return;

    // Only save if zone is big enough
    if (drawingZone.width > 20 && drawingZone.height > 20) {
      const newZone: Zone = {
        ...drawingZone,
        id: Date.now().toString(),
        name: `Zone ${zones.length + 1}`
      };

      onZonesChange([...zones, newZone]);
    }

    setDrawingZone(null);
    setStartPos(null);
  };

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="absolute inset-0 cursor-crosshair"
      style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
    />
  );
}

export default ZoneDrawer;