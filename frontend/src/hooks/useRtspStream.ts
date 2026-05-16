import { useRef, useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

export interface UseRtspStreamOptions {
  cameraId: string;
  cameraName: string;
  enableDetection?: boolean;
  detectionIntervalMs?: number;
  onDetections?: (data: { detections: unknown[]; totalObjects?: number }) => void;
  onAlert?: (data: unknown) => void;
}

export function useRtspStream({
  cameraId,
  cameraName,
  enableDetection = true,
  detectionIntervalMs = 500,
  onDetections,
  onAlert,
}: UseRtspStreamOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFrameRef = useRef<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawFrame = useCallback((frameDataUrl: string) => {
    lastFrameRef.current = frameDataUrl;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
    };
    img.src = frameDataUrl;
  }, []);

  const stop = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.emit('stop-rtsp-stream', cameraId);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    lastFrameRef.current = null;
    setIsStreaming(false);
    setIsConnecting(false);
  }, [cameraId]);

  const start = useCallback(() => {
    if (socketRef.current?.connected) return;

    setError(null);
    setIsConnecting(true);

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('view-rtsp-stream', cameraId);
    });

    socket.on('rtsp-frame', (data: { cameraId: string; frame: string }) => {
      if (data.cameraId !== cameraId) return;
      drawFrame(data.frame);
      setIsStreaming(true);
      setIsConnecting(false);
    });

    socket.on('rtsp-stream-error', (data: { cameraId: string; error: string }) => {
      if (data.cameraId !== cameraId) return;
      setError(data.error);
      setIsConnecting(false);
      setIsStreaming(false);
    });

    socket.on('rtsp-stream-ended', () => {
      setIsStreaming(false);
      setError('RTSP stream ended');
    });

    socket.on('detections', (data) => onDetections?.(data));
    socket.on('alert-triggered', (data) => onAlert?.(data));

    socket.on('connect_error', (err) => {
      setError(`Server connection failed: ${err.message}`);
      setIsConnecting(false);
    });

    if (enableDetection) {
      detectionIntervalRef.current = setInterval(() => {
        const frame = lastFrameRef.current;
        if (frame && socket.connected) {
          socket.emit('video-frame', { frame, cameraId, cameraName });
        }
      }, detectionIntervalMs);
    }
  }, [
    cameraId,
    cameraName,
    drawFrame,
    enableDetection,
    detectionIntervalMs,
    onDetections,
    onAlert,
  ]);

  useEffect(() => () => stop(), [stop]);

  return { canvasRef, isStreaming, isConnecting, error, start, stop };
}

export default useRtspStream;
