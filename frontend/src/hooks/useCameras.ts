// ===========================================
// USE CAMERAS HOOK
// ===========================================
// Syncs cameras between frontend Zustand and backend MongoDB
// This is the SINGLE SOURCE OF TRUTH approach

import { useState, useEffect, useCallback } from 'react';
import { useCameraStore } from '../store';
import type { Camera } from '../store';

const API_URL = 'http://localhost:5000/api/cameras';

interface UseCamerasReturn {
  cameras: Camera[];
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  addCamera: (camera: Omit<Camera, 'id' | 'createdAt' | 'status'>) => Promise<Camera | null>;
  updateCamera: (id: string, updates: Partial<Camera>) => Promise<boolean>;
  deleteCamera: (id: string) => Promise<boolean>;
  
  // Actions
  refreshCameras: () => Promise<void>;
  testCamera: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function useCameras(): UseCamerasReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zustand store - for real-time UI updates
  const storeCameras = useCameraStore((s) => s.cameras);
  const setStoreCameras = useCameraStore((s) => s.addCamera);
  const removeStoreCamera = useCameraStore((s) => s.removeCamera);
  const updateStoreCamera = useCameraStore((s) => s.updateCamera);

  // We'll use local state that syncs with backend
  const [cameras, setCameras] = useState<Camera[]>([]);

  // -------------------------------------------
  // FETCH CAMERAS FROM BACKEND
  // -------------------------------------------
  const refreshCameras = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      if (data.success) {
        // Convert backend format to frontend format
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
        
        // Also update Zustand store for components that use it directly
        // Clear and re-add all cameras
        formattedCameras.forEach((cam) => {
          // Check if camera exists in store, if not add it
          const exists = storeCameras.find((c) => c.id === cam.id);
          if (!exists) {
            setStoreCameras(cam);
          } else {
            updateStoreCamera(cam.id, cam);
          }
        });
      } else {
        throw new Error(data.error || 'Failed to fetch cameras');
      }
    } catch (err: any) {
      console.error('[useCameras] Fetch error:', err);
      setError(err.message);
      
      // Fall back to Zustand store if backend fails
      setCameras(storeCameras);
    } finally {
      setIsLoading(false);
    }
  }, [storeCameras, setStoreCameras, updateStoreCamera]);

  // -------------------------------------------
  // ADD CAMERA
  // -------------------------------------------
  const addCamera = useCallback(async (
    cameraData: Omit<Camera, 'id' | 'createdAt' | 'status'>
  ): Promise<Camera | null> => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cameraData.name,
          type: cameraData.type,
          streamUrl: cameraData.streamUrl,
          username: cameraData.username,
          password: cameraData.password,
          deviceId: cameraData.deviceId,
          location: cameraData.location,
          group: cameraData.group,
          enabled: cameraData.enabled,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newCamera: Camera = {
          id: data.camera.cameraId,
          name: data.camera.name,
          type: data.camera.type,
          streamUrl: data.camera.streamUrl,
          username: data.camera.username,
          password: data.camera.password,
          deviceId: data.camera.deviceId,
          location: data.camera.location,
          group: data.camera.group,
          enabled: data.camera.enabled,
          status: 'offline',
          createdAt: Date.now(),
        };

        // Update local state
        setCameras((prev) => [...prev, newCamera]);
        
        // Update Zustand store
        setStoreCameras(newCamera);

        console.log('[useCameras] Camera added:', newCamera.name);
        return newCamera;
      } else {
        throw new Error(data.error || 'Failed to add camera');
      }
    } catch (err: any) {
      console.error('[useCameras] Add error:', err);
      setError(err.message);
      return null;
    }
  }, [setStoreCameras]);

  // -------------------------------------------
  // UPDATE CAMERA
  // -------------------------------------------
  const updateCamera = useCallback(async (
    id: string,
    updates: Partial<Camera>
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setCameras((prev) =>
          prev.map((cam) => (cam.id === id ? { ...cam, ...updates } : cam))
        );
        
        // Update Zustand store
        updateStoreCamera(id, updates);

        console.log('[useCameras] Camera updated:', id);
        return true;
      } else {
        throw new Error(data.error || 'Failed to update camera');
      }
    } catch (err: any) {
      console.error('[useCameras] Update error:', err);
      setError(err.message);
      return false;
    }
  }, [updateStoreCamera]);

  // -------------------------------------------
  // DELETE CAMERA
  // -------------------------------------------
  const deleteCamera = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setCameras((prev) => prev.filter((cam) => cam.id !== id));
        
        // Update Zustand store
        removeStoreCamera(id);

        console.log('[useCameras] Camera deleted:', id);
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete camera');
      }
    } catch (err: any) {
      console.error('[useCameras] Delete error:', err);
      setError(err.message);
      return false;
    }
  }, [removeStoreCamera]);

  // -------------------------------------------
  // TEST CAMERA CONNECTION
  // -------------------------------------------
  const testCamera = useCallback(async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_URL}/${id}/test`, {
        method: 'POST',
      });

      const data = await response.json();

      // Update camera status in local state
      if (data.success) {
        setCameras((prev) =>
          prev.map((cam) =>
            cam.id === id ? { ...cam, status: 'online' } : cam
          )
        );
        updateStoreCamera(id, { status: 'online' });
      } else {
        setCameras((prev) =>
          prev.map((cam) =>
            cam.id === id ? { ...cam, status: 'error', errorMessage: data.error } : cam
          )
        );
        updateStoreCamera(id, { status: 'error', errorMessage: data.error });
      }

      return { success: data.success, error: data.error };
    } catch (err: any) {
      console.error('[useCameras] Test error:', err);
      return { success: false, error: err.message };
    }
  }, [updateStoreCamera]);

  // -------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------
  useEffect(() => {
    refreshCameras();
  }, []);

  // -------------------------------------------
  // RETURN
  // -------------------------------------------
  return {
    cameras,
    isLoading,
    error,
    addCamera,
    updateCamera,
    deleteCamera,
    refreshCameras,
    testCamera,
  };
}

export default useCameras;