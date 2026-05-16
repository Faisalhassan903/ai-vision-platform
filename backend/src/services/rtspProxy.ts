// ===========================================
// RTSP STREAM PROXY SERVICE
// ===========================================
// Converts RTSP (IP cameras) to JPEG frames over Socket.io

import { spawn, ChildProcess } from 'child_process';
import { Server as SocketServer } from 'socket.io';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import Camera from '../models/Camera';

const FFMPEG_PATH = ffmpegInstaller.path;

// -------------------------------------------
// TYPES
// -------------------------------------------

interface CameraStream {
  id: string;
  name: string;
  rtspUrl: string;
  process: ChildProcess | null;
  isRunning: boolean;
  viewers: Set<string>;
  lastFrame: string | null;
  fps: number;
  errors: string[];
}

interface StreamConfig {
  cameraId: string;
  rtspUrl: string;
  fps?: number;
  resolution?: { width: number; height: number };
}

// -------------------------------------------
// RTSP PROXY CLASS
// -------------------------------------------

class RtspProxyService {
  private streams: Map<string, CameraStream> = new Map();
  private io: SocketServer | null = null;

  initialize(io: SocketServer) {
    this.io = io;
    console.log('[RTSP Proxy] Initialized (ffmpeg:', FFMPEG_PATH, ')');

    io.on('connection', (socket) => {
      socket.on('view-rtsp-stream', async (cameraId: string) => {
        if (!cameraId || typeof cameraId !== 'string') return;
        await this.ensureStreamAndAddViewer(cameraId, socket.id);
      });

      socket.on('stop-rtsp-stream', (cameraId: string) => {
        if (cameraId) this.removeViewer(cameraId, socket.id);
      });

      socket.on('disconnect', () => {
        this.removeViewerFromAll(socket.id);
      });
    });
  }

  /** Build RTSP URL with optional credentials */
  buildAuthUrl(streamUrl: string, username?: string, password?: string): string {
    if (!username || !password) return streamUrl;
    try {
      const urlObj = new URL(streamUrl);
      urlObj.username = username;
      urlObj.password = password;
      return urlObj.toString();
    } catch {
      if (streamUrl.startsWith('rtsp://') && !streamUrl.includes('@')) {
        return streamUrl.replace('rtsp://', `rtsp://${username}:${password}@`);
      }
      return streamUrl;
    }
  }

  async startStream(config: StreamConfig): Promise<{ success: boolean; error?: string }> {
    const { cameraId, rtspUrl, fps = 5, resolution } = config;

    const existing = this.streams.get(cameraId);
    if (existing?.isRunning) {
      return { success: true };
    }

    if (existing?.process) {
      existing.process.kill('SIGTERM');
      this.streams.delete(cameraId);
    }

    console.log(`[RTSP Proxy] Starting stream: ${cameraId}`);
    console.log(`[RTSP Proxy] URL: ${rtspUrl.replace(/\/\/.*:.*@/, '//***:***@')}`);

    try {
      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'error',
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-an',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-vf', resolution
          ? `fps=${fps},scale=${resolution.width}:${resolution.height}`
          : `fps=${fps}`,
        '-q:v', '5',
        '-',
      ];

      const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

      const stream: CameraStream = {
        id: cameraId,
        name: cameraId,
        rtspUrl,
        process: ffmpegProcess,
        isRunning: true,
        viewers: new Set(),
        lastFrame: null,
        fps,
        errors: [],
      };

      this.streams.set(cameraId, stream);

      let frameBuffer = Buffer.alloc(0);
      const SOI = Buffer.from([0xff, 0xd8]);
      const EOI = Buffer.from([0xff, 0xd9]);

      ffmpegProcess.stdout.on('data', (data: Buffer) => {
        frameBuffer = Buffer.concat([frameBuffer, data]);

        let soiIndex = frameBuffer.indexOf(SOI);
        let eoiIndex = frameBuffer.indexOf(EOI);

        while (soiIndex !== -1 && eoiIndex !== -1 && eoiIndex > soiIndex) {
          const frame = frameBuffer.slice(soiIndex, eoiIndex + 2);
          const base64Frame = `data:image/jpeg;base64,${frame.toString('base64')}`;
          stream.lastFrame = base64Frame;
          this.broadcastFrame(cameraId, base64Frame);
          frameBuffer = frameBuffer.slice(eoiIndex + 2);
          soiIndex = frameBuffer.indexOf(SOI);
          eoiIndex = frameBuffer.indexOf(EOI);
        }

        if (frameBuffer.length > 10 * 1024 * 1024) {
          frameBuffer = Buffer.alloc(0);
        }
      });

      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message && (message.includes('error') || message.includes('Error'))) {
          console.error(`[RTSP ${cameraId}] ${message}`);
          stream.errors.push(message);
        }
      });

      ffmpegProcess.on('close', (code) => {
        console.log(`[RTSP ${cameraId}] FFmpeg exited (code ${code})`);
        stream.isRunning = false;
        this.io?.to(`camera-${cameraId}`).emit('rtsp-stream-ended', { cameraId, code });
        if (code !== 0 && code !== null) {
          this.io?.to(`camera-${cameraId}`).emit('rtsp-stream-error', {
            cameraId,
            error: stream.errors[stream.errors.length - 1] || `FFmpeg exited with code ${code}`,
          });
        }
      });

      ffmpegProcess.on('error', (err) => {
        console.error(`[RTSP ${cameraId}] Spawn error:`, err.message);
        stream.isRunning = false;
        stream.errors.push(err.message);
        this.io?.to(`camera-${cameraId}`).emit('rtsp-stream-error', {
          cameraId,
          error: err.message.includes('ENOENT')
            ? 'FFmpeg not found. Install FFmpeg or run backend locally.'
            : err.message,
        });
      });

      return { success: true };
    } catch (error: any) {
      console.error(`[RTSP Proxy] Failed to start ${cameraId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  stopStream(cameraId: string): boolean {
    const stream = this.streams.get(cameraId);
    if (!stream) return false;

    if (stream.process) {
      stream.process.kill('SIGTERM');
      stream.isRunning = false;
    }

    this.streams.delete(cameraId);
    console.log(`[RTSP Proxy] Stopped stream: ${cameraId}`);
    return true;
  }

  private async ensureStreamAndAddViewer(cameraId: string, socketId: string): Promise<void> {
    const stream = this.streams.get(cameraId);

    if (!stream?.isRunning) {
      const camera = await Camera.findOne({ cameraId });
      if (!camera) {
        this.io?.to(socketId).emit('rtsp-stream-error', {
          cameraId,
          error: 'Camera not found in database',
        });
        return;
      }

      if (camera.type !== 'rtsp' || !camera.streamUrl) {
        this.io?.to(socketId).emit('rtsp-stream-error', {
          cameraId,
          error: 'Camera is not configured as RTSP or has no stream URL',
        });
        return;
      }

      const rtspUrl = this.buildAuthUrl(
        camera.streamUrl,
        camera.username,
        camera.password
      );

      const result = await this.startStream({
        cameraId,
        rtspUrl,
        fps: camera.settings?.fps || 5,
        resolution: camera.settings?.resolution,
      });

      if (!result.success) {
        this.io?.to(socketId).emit('rtsp-stream-error', {
          cameraId,
          error: result.error || 'Failed to start RTSP stream',
        });
        return;
      }

      await Camera.updateOne(
        { cameraId },
        { status: 'online', lastSeen: new Date(), lastError: undefined }
      );
    }

    this.addViewer(cameraId, socketId);
  }

  private addViewer(cameraId: string, socketId: string) {
    const stream = this.streams.get(cameraId);
    if (!stream) return;

    stream.viewers.add(socketId);
    this.io?.sockets.sockets.get(socketId)?.join(`camera-${cameraId}`);

    if (stream.lastFrame) {
      this.io?.to(socketId).emit('rtsp-frame', {
        cameraId,
        frame: stream.lastFrame,
        timestamp: Date.now(),
      });
    }

    console.log(`[RTSP ${cameraId}] Viewer ${socketId} (${stream.viewers.size} total)`);
  }

  private removeViewer(cameraId: string, socketId: string) {
    const stream = this.streams.get(cameraId);
    if (!stream) return;

    stream.viewers.delete(socketId);
    this.io?.sockets.sockets.get(socketId)?.leave(`camera-${cameraId}`);

    if (stream.viewers.size === 0) {
      console.log(`[RTSP ${cameraId}] No viewers — stopping stream`);
      this.stopStream(cameraId);
    }
  }

  private removeViewerFromAll(socketId: string) {
    this.streams.forEach((stream, cameraId) => {
      if (stream.viewers.has(socketId)) {
        this.removeViewer(cameraId, socketId);
      }
    });
  }

  private broadcastFrame(cameraId: string, frame: string) {
    this.io?.to(`camera-${cameraId}`).emit('rtsp-frame', {
      cameraId,
      frame,
      timestamp: Date.now(),
    });
  }

  getStreamStatus(cameraId: string): { isRunning: boolean; viewers: number; fps: number } | null {
    const stream = this.streams.get(cameraId);
    if (!stream) return null;
    return {
      isRunning: stream.isRunning,
      viewers: stream.viewers.size,
      fps: stream.fps,
    };
  }

  getActiveStreams(): Array<{ id: string; viewers: number; isRunning: boolean }> {
    return Array.from(this.streams.values()).map((s) => ({
      id: s.id,
      viewers: s.viewers.size,
      isRunning: s.isRunning,
    }));
  }

  async testConnection(rtspUrl: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testProcess.kill('SIGKILL');
        resolve({ success: false, error: 'Connection timeout (15s). Check IP, RTSP path, and network.' });
      }, 15000);

      const testProcess = spawn(FFMPEG_PATH, [
        '-hide_banner',
        '-loglevel', 'error',
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-frames:v', '1',
        '-f', 'null',
        '-',
      ]);

      let stderr = '';

      testProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ success: true });
        } else {
          const msg = stderr.trim().split('\n').pop() || `FFmpeg test failed (code ${code})`;
          resolve({ success: false, error: msg });
        }
      });

      testProcess.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: err.message.includes('ENOENT')
            ? 'FFmpeg not found on server'
            : err.message,
        });
      });
    });
  }
}

export const rtspProxy = new RtspProxyService();
export default rtspProxy;
