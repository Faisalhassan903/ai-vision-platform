import React, { useEffect } from 'react';
import { useRtspStream } from '../../hooks/useRtspStream';
import type { Camera } from '../../store';

interface RtspStreamPlayerProps {
  camera: Camera;
  className?: string;
  enableDetection?: boolean;
  onDetections?: (data: { detections: unknown[] }) => void;
  onAlert?: (data: unknown) => void;
  autoStart?: boolean;
}

const RtspStreamPlayer: React.FC<RtspStreamPlayerProps> = ({
  camera,
  className = 'w-full h-full object-contain',
  enableDetection = true,
  onDetections,
  onAlert,
  autoStart = false,
}) => {
  const { canvasRef, isStreaming, isConnecting, error, start, stop } = useRtspStream({
    cameraId: camera.id,
    cameraName: camera.name,
    enableDetection,
    onDetections,
    onAlert,
  });

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
  }, [autoStart, camera.id, start, stop]);

  return (
    <div className="relative w-full h-full min-h-[120px] bg-black">
      <canvas ref={canvasRef} className={className} />

      {!isStreaming && !isConnecting && (
        <button
          type="button"
          onClick={start}
          className="absolute inset-0 m-auto w-24 h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
        >
          Connect RTSP
        </button>
      )}

      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-white/70 text-sm">Connecting to {camera.name}…</p>
        </div>
      )}

      {isStreaming && (
        <button
          type="button"
          onClick={stop}
          className="absolute top-2 right-2 px-2 py-1 bg-black/60 hover:bg-red-600/80 text-white text-[10px] rounded"
        >
          Stop
        </button>
      )}

      {error && (
        <p className="absolute bottom-0 inset-x-0 bg-red-950/90 text-red-200 text-[10px] px-2 py-1.5 leading-tight">
          {error}
        </p>
      )}

      <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-emerald-700/90 text-white text-[9px] font-mono rounded uppercase tracking-wide">
        RTSP
      </span>
    </div>
  );
};

export default RtspStreamPlayer;
