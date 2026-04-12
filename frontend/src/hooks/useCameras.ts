// ===========================================
// USE CAMERAS HOOK - DB MANAGEMENT (Main Backend)
// ===========================================

import { useState, useEffect, useCallback } from 'react';
import { useCameraStore } from '../store';
import type { Camera } from '../store';
import { MAIN_BACKEND_URL } from '../config'; 

const API_URL = `${MAIN_BACKEND_URL}/api/cameras`;

interface UseCamerasReturn {
  cameras: Camera[];
  isLoading: boolean;
  error: string | null;
  addCamera: (camera: Omit<Camera, 'id' | 'createdAt' | 'status'>) => Promise<Camera | null>;
  updateCamera: (id: string, updates: Partial<Camera>) => Promise<boolean>;
  deleteCamera: (id: string) => Promise<boolean>;
  refreshCameras: () => Promise<void>;
  testCamera: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function useCameras(): UseCamerasReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);

  const storeCameras = useCameraStore((s) => s.cameras);
  const setStoreCameras = useCameraStore((s) => s.setCameras);
  const addStoreCamera = useCameraStore((s) => s.addCamera);
  const removeStoreCamera = useCameraStore((s) => s.removeCamera);
  const updateStoreCamera = useCameraStore((s) => s.updateCamera);

  const refreshCameras = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URL);
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Backend returned non-JSON response. Check your MAIN_BACKEND_URL.");
      }

      const data = await response.json();

      if (data.success) {
        const formattedCameras: Camera[] = data.cameras.map((cam: any) => ({
          id: cam.cameraId || cam._id,
          name: cam.name,
          type: cam.type || 'webcam',
          streamUrl: cam.streamUrl,
          username: cam.username,
          password: cam.password,
          deviceId: cam.deviceId,
          location: cam.location,
          group: cam.group,
          enabled: cam.enabled !== false,
          status: cam.status || 'offline',
          lastSeen: cam.lastSeen,
          errorMessage: cam.lastError,
          createdAt: new Date(cam.createdAt).getTime(),
          updatedAt: cam.updatedAt ? new Date(cam.updatedAt).getTime() : undefined,
        }));

        setCameras(formattedCameras);
        if (typeof setStoreCameras === 'function') {
          setStoreCameras(formattedCameras);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch cameras');
      }
    } catch (err: any) {
      console.error('[useCameras] Fetch error:', err);
      setError(err.message);
      setCameras(storeCameras);
    } finally {
      setIsLoading(false);
    }
  }, [storeCameras, setStoreCameras]);

  const addCamera = useCallback(async (
    cameraData: Omit<Camera, 'id' | 'createdAt' | 'status'>
  ): Promise<Camera | null> => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraData),
      });

      const data = await response.json();

      if (data.success) {
        const newCamera: Camera = {
          ...cameraData,
          id: data.camera.cameraId || data.camera._id,
          status: 'offline',
          createdAt: Date.now(),
        };

        setCameras((prev) => [...prev, newCamera]);
        addStoreCamera(newCamera);
        return newCamera;
      }
      throw new Error(data.error || 'Failed to add camera');
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [addStoreCamera]);

  const updateCamera = useCallback(async (id: string, updates: Partial<Camera>) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (data.success) {
        setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        updateStoreCamera(id, updates);
        return true;
      }
      return false;
    } catch { return false; }
  }, [updateStoreCamera]);

  const deleteCamera = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setCameras(prev => prev.filter(c => c.id !== id));
        removeStoreCamera(id);
        return true;
      }
      return false;
    } catch { return false; }
  }, [removeStoreCamera]);

  const testCamera = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}/test`, { method: 'POST' });
      const data = await response.json();
      const statusUpdate = { 
        status: data.success ? 'online' : 'error' as any, 
        errorMessage: data.error 
      };
      
      setCameras(prev => prev.map(c => c.id === id ? { ...c, ...statusUpdate } : c));
      updateStoreCamera(id, statusUpdate);
      
      return { success: data.success, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [updateStoreCamera]);

  // INITIAL FETCH ONLY
  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  return { cameras, isLoading, error, addCamera, updateCamera, deleteCamera, refreshCameras, testCamera };
}

export default useCameras;