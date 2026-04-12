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

  // Zustand store actions
  const storeCameras = useCameraStore((s) => s.cameras);
  const setStoreCameras = useCameraStore((s) => s.setCameras);
  const addStoreCamera = useCameraStore((s) => s.addCamera);
  const removeStoreCamera = useCameraStore((s) => s.removeCamera);
  const updateStoreCamera = useCameraStore((s) => s.updateCamera);

  // Centralized Error Handling
  const handleApiError = useCallback((err: any, fallbackMessage: string) => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    console.error(`[useCameras] ${fallbackMessage}:`, err);
    setError(message);
    return message;
  }, []);

  // -------------------------------------------
  // FETCH ALL CAMERAS
  // -------------------------------------------
  const refreshCameras = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URL);
      
      // Defensive check for HTML error pages from Render/Vercel
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        throw new Error(`Server error: ${response.status} ${response.statusText}. Check MAIN_BACKEND_URL.`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.cameras)) {
        const formattedCameras: Camera[] = data.cameras.map((cam: any) => ({
          id: cam.cameraId || cam._id,
          name: cam.name || 'Unknown Camera',
          type: cam.type || 'webcam',
          streamUrl: cam.streamUrl || '',
          username: cam.username,
          password: cam.password,
          deviceId: cam.deviceId,
          location: cam.location,
          group: cam.group,
          enabled: cam.enabled !== false,
          status: cam.status || 'offline',
          lastSeen: cam.lastSeen,
          errorMessage: cam.lastError,
          createdAt: cam.createdAt ? new Date(cam.createdAt).getTime() : Date.now(),
          updatedAt: cam.updatedAt ? new Date(cam.updatedAt).getTime() : undefined,
        }));

        setCameras(formattedCameras);
        if (setStoreCameras) setStoreCameras(formattedCameras);
      } else {
        throw new Error(data.error || 'Invalid data format received from server');
      }
    } catch (err) {
      handleApiError(err, 'Failed to refresh cameras');
      setCameras(storeCameras); // Fallback to local store data
    } finally {
      setIsLoading(false);
    }
  }, [storeCameras, setStoreCameras, handleApiError]);

  // -------------------------------------------
  // ADD NEW CAMERA
  // -------------------------------------------
  const addCamera = useCallback(async (
    cameraData: Omit<Camera, 'id' | 'createdAt' | 'status'>
  ): Promise<Camera | null> => {
    setError(null);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraData),
      });

      const data = await response.json();

      if (data.success && data.camera) {
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
      throw new Error(data.error || 'Server failed to save camera');
    } catch (err) {
      handleApiError(err, 'Could not add camera');
      return null;
    }
  }, [addStoreCamera, handleApiError]);

  // -------------------------------------------
  // UPDATE CAMERA
  // -------------------------------------------
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
      throw new Error(data.error || 'Update failed');
    } catch (err) {
      handleApiError(err, 'Update error');
      return false;
    }
  }, [updateStoreCamera, handleApiError]);

  // -------------------------------------------
  // DELETE CAMERA
  // -------------------------------------------
  const deleteCamera = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setCameras(prev => prev.filter(c => c.id !== id));
        removeStoreCamera(id);
        return true;
      }
      throw new Error(data.error || 'Deletion failed');
    } catch (err) {
      handleApiError(err, 'Delete error');
      return false;
    }
  }, [removeStoreCamera, handleApiError]);

  // -------------------------------------------
  // TEST CONNECTION
  // -------------------------------------------
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
      return { success: false, error: err.message || 'Connection test failed' };
    }
  }, [updateStoreCamera]);

  // Auto-fetch on mount
  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  return { cameras, isLoading, error, addCamera, updateCamera, deleteCamera, refreshCameras, testCamera };
}

export default useCameras;