import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../config';

const DETECTION_EVERY_N_FRAMES = 10; // ✅ reduced load

const LiveCamera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false); // ✅ prevent spam

  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('IDLE');

  // ─── STOP CAMERA ─────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) videoRef.current.srcObject = null;

    setIsLive(false);
    setStatus('STOPPED');
    console.log('🔴 Camera stopped');
  }, []);

  // ─── SEND FRAME TO BACKEND ─────────────────
  const sendFrameToBackend = async () => {
    if (!videoRef.current || isSendingRef.current) return;

    try {
      isSendingRef.current = true;

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.7)
      );

      if (!blob) return;

      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');

      const res = await axios.post(`${API_BASE_URL}/api/vision/detect`, formData);

      if (res.data?.alertTriggered) {
        console.log("🚨 ALERT FROM BACKEND");
      }

    } catch (err: any) {
      console.error("❌ Backend detect failed:", err.message);
    } finally {
      isSendingRef.current = false;
    }
  };

  // ─── DETECTION LOOP ─────────────────
  const detectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    frameCountRef.current++;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (video && canvas && model && video.readyState === 4) {
      try {
        const predictions = await model.detect(video);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          predictions.forEach(p => {
            const [x, y, w, h] = p.bbox;
            ctx.strokeStyle = p.class === 'person' ? 'red' : 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
          });
        }

        // ✅ SEND TO BACKEND (less frequent)
        if (frameCountRef.current % DETECTION_EVERY_N_FRAMES === 0) {
          sendFrameToBackend();
        }

      } catch (err) {
        console.warn("Frame skipped");
      }
    }

    rafRef.current = requestAnimationFrame(detectionLoop);
  }, []);

  // ─── START CAMERA ─────────────────
  const startCamera = async () => {
    try {
      setStatus('STARTING...');

      await tf.setBackend('webgl');
      await tf.ready();

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      if (!modelRef.current) {
        modelRef.current = await cocoSsd.load();
      }

      isRunningRef.current = true;
      setIsLive(true);
      setStatus('LIVE');

      detectionLoop();

    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      stopCamera();
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl mb-4">Live Camera</h1>

      <Button onClick={isLive ? stopCamera : startCamera}>
        {isLive ? 'STOP' : 'START'}
      </Button>

      <p className="mt-2 text-sm">{status}</p>

      <div className="relative mt-4">
        <video ref={videoRef} className="w-full" muted />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      </div>
    </div>
  );
};

export default LiveCamera;