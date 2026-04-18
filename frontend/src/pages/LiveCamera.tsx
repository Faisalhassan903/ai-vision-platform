import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import axios from 'axios';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../config';

const DETECTION_EVERY_N_FRAMES = 5;
const POST_TIMEOUT_MS = 30000;

const ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  rules: `${API_BASE_URL}/api/rules`,
  alerts: `${API_BASE_URL}/api/alerts`,
  detect: `${API_BASE_URL}/api/vision/detect`,
};

interface AlertRule {
  _id: string;
  name: string;
  enabled: boolean;
  priority: 'info' | 'warning' | 'critical';
  conditions: {
    objectClasses: string[];
    minConfidence: number;
    timeRange?: { start: string; end: string };
  };
  actions: {
    notification: boolean;
    audioAlert: boolean;
  };
  cooldownMinutes: number;
}

interface RuleMatch {
  rule: AlertRule;
  detection: cocoSsd.DetectedObject;
  allDetections: cocoSsd.DetectedObject[];
}

const ruleCooldowns: Record<string, number> = {};

const LiveCamera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const rulesRef = useRef<AlertRule[]>([]);
  const running = useRef(false);

  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [objects, setObjects] = useState(0);
  const [lastAlert, setLastAlert] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const res = await axios.get(ENDPOINTS.rules);
      rulesRef.current = Array.isArray(res.data) ? res.data : [];
    } catch {
      rulesRef.current = [];
    }
  }, []);

  const evaluateRules = useCallback((preds: cocoSsd.DetectedObject[]): RuleMatch | null => {
    for (const rule of rulesRef.current) {
      if (!rule.enabled) continue;

      const cooldown = ruleCooldowns[rule._id] || 0;
      if (Date.now() - cooldown < rule.cooldownMinutes * 60000) continue;

      for (const obj of preds) {
        const matchClass = rule.conditions.objectClasses.includes(obj.class.toLowerCase());
        const matchScore = obj.score >= rule.conditions.minConfidence;

        if (matchClass && matchScore) {
          return { rule, detection: obj, allDetections: preds };
        }
      }
    }
    return null;
  }, []);

  const sendAlert = useCallback(async (match: RuleMatch) => {
    const { rule, detection } = match;

    ruleCooldowns[rule._id] = Date.now();

    try {
      await axios.post(
        ENDPOINTS.alerts,
        {
          ruleName: rule.name,
          message: `${detection.class} detected`,
          confidence: detection.score,
        },
        { timeout: POST_TIMEOUT_MS }
      );

      setLastAlert(`Alert: ${detection.class} (${Math.round(detection.score * 100)}%)`);
    } catch {
      setLastAlert('Alert failed to send');
    }
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, preds: cocoSsd.DetectedObject[]) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    preds.forEach(p => {
      const [x, y, w, h] = p.bbox;

      ctx.strokeStyle = '#4f8cff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(79,140,255,0.1)';
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${p.class} ${Math.round(p.score * 100)}%`, x, y - 5);
    });
  };

  const loop = useCallback(async () => {
    if (!running.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (video && canvas && model && video.readyState === 4) {
      const preds = await model.detect(video);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        draw(ctx, preds);
      }

      setObjects(preds.length);

      const match = evaluateRules(preds);
      if (match) sendAlert(match);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [evaluateRules, sendAlert]);

  const start = async () => {
    try {
      setStatus('starting');

      await loadRules();

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!modelRef.current) {
        modelRef.current = await cocoSsd.load();
      }

      running.current = true;
      setStatus('live');

      loop();
    } catch {
      setStatus('error');
    }
  };

  const stop = () => {
    running.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    setStatus('idle');
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow">
          <div>
            <h1 className="text-xl font-semibold">Security Camera</h1>
            <p className="text-sm text-gray-500">
              Status: {status.toUpperCase()}
            </p>
          </div>

          <Button
            onClick={status === 'live' ? stop : start}
            className={status === 'live' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}
          >
            {status === 'live' ? 'Stop' : 'Start'}
          </Button>
        </div>

        {/* CAMERA */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow">
          <video ref={videoRef} className="w-full h-auto" muted playsInline />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />

          {status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black/60">
              Click Start to begin
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-sm text-gray-500">Objects Detected</p>
            <p className="text-2xl font-semibold">{objects}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-sm text-gray-500">Latest Alert</p>
            <p className="text-sm">{lastAlert || 'None'}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LiveCamera;