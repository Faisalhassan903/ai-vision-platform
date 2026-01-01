// ===========================================
// AI VISION PLATFORM - ZUSTAND CAMERA STORE
// ===========================================
// FIXED VERSION - No infinite loop errors
// Removed immer middleware and inline selector hooks

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Zone,
  Detection,
  ZoneAlert,
  Camera,
  ViewMode,
  DrawingState,
} from './types';

// -------------------------------------------
// STATE INTERFACE
// -------------------------------------------

interface CameraStoreState {
  // Data
  cameras: Camera[];
  zones: Record<string, Zone[]>;
  detections: Record<string, Detection[]>;
  alerts: ZoneAlert[];
  
  // UI State
  selectedCameraId: string | null;
  viewMode: ViewMode;
  drawingState: DrawingState;
  
  // Settings
  alarmEnabled: boolean;
  alarmSound: boolean;
  showDetectionBoxes: boolean;
  showZones: boolean;
}

interface CameraStoreActions {
  // Zone actions
  addZone: (zone: Zone) => void;
  removeZone: (zoneId: string) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  clearZonesForCamera: (cameraId: string) => void;
  toggleZoneEnabled: (zoneId: string) => void;
  
  // Detection actions
  setDetections: (cameraId: string, detections: Detection[]) => void;
  clearDetections: (cameraId: string) => void;
  
  // Alert actions
  addAlert: (alert: ZoneAlert) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  
  // Camera actions
  addCamera: (camera: Camera) => void;
  removeCamera: (cameraId: string) => void;
  updateCamera: (cameraId: string, updates: Partial<Camera>) => void;
  setSelectedCamera: (cameraId: string | null) => void;
  
  // UI actions
  setViewMode: (mode: ViewMode) => void;
  setDrawingState: (state: Partial<DrawingState>) => void;
  resetDrawingState: () => void;
  
  // Settings actions
  toggleAlarm: () => void;
  toggleAlarmSound: () => void;
  toggleDetectionBoxes: () => void;
  toggleZones: () => void;
  
  // Utility
  reset: () => void;
}

type CameraStore = CameraStoreState & CameraStoreActions;

// -------------------------------------------
// INITIAL STATE
// -------------------------------------------

const initialDrawingState: DrawingState = {
  mode: 'none',
  startX: null,
  startY: null,
  currentX: null,
  currentY: null,
  selectedZoneId: null,
};

const initialState: CameraStoreState = {
  cameras: [
    {
      id: 'webcam-1',
      name: 'Webcam',
      type: 'webcam',
      enabled: true,
      isConnected: false,
    },
  ],
  zones: {},
  detections: {},
  alerts: [],
  selectedCameraId: 'webcam-1',
  viewMode: 'single',
  drawingState: initialDrawingState,
  alarmEnabled: true,
  alarmSound: true,
  showDetectionBoxes: true,
  showZones: true,
};

// -------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------

const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const isDetectionInZone = (detection: Detection, zone: Zone): boolean => {
  const detLeft = detection.x;
  const detRight = detection.x + detection.width;
  const detTop = detection.y;
  const detBottom = detection.y + detection.height;
  
  const zoneLeft = zone.x;
  const zoneRight = zone.x + zone.width;
  const zoneTop = zone.y;
  const zoneBottom = zone.y + zone.height;
  
  const noOverlap = 
    detRight < zoneLeft ||
    detLeft > zoneRight ||
    detBottom < zoneTop ||
    detTop > zoneBottom;
  
  return !noOverlap;
};

export const processDetectionsWithZones = (
  detections: Detection[],
  zones: Zone[]
): Detection[] => {
  const enabledZones = zones.filter(z => z.enabled);
  
  return detections.map(detection => {
    const intersectingZones = enabledZones.filter(zone => 
      isDetectionInZone(detection, zone)
    );
    
    return {
      ...detection,
      inZone: intersectingZones.length > 0,
      zoneIds: intersectingZones.map(z => z.id),
    };
  });
};

// -------------------------------------------
// CREATE STORE
// -------------------------------------------

export const useCameraStore = create<CameraStore>()(
  persist(
    (set) => ({
      ...initialState,

      // =========================================
      // ZONE ACTIONS
      // =========================================

      addZone: (zone: Zone) => {
        set((state) => {
          const cameraId = zone.cameraId;
          const existingZones = state.zones[cameraId] || [];
          
          console.log(`[Store] Adding zone: ${zone.name}`);
          
          return {
            zones: {
              ...state.zones,
              [cameraId]: [...existingZones, zone],
            },
          };
        });
      },

      removeZone: (zoneId: string) => {
        set((state) => {
          const newZones = { ...state.zones };
          
          for (const cameraId of Object.keys(newZones)) {
            const filtered = newZones[cameraId].filter(z => z.id !== zoneId);
            if (filtered.length !== newZones[cameraId].length) {
              newZones[cameraId] = filtered;
              console.log(`[Store] Removed zone: ${zoneId}`);
              break;
            }
          }
          
          return { zones: newZones };
        });
      },

      updateZone: (zoneId: string, updates: Partial<Zone>) => {
        set((state) => {
          const newZones = { ...state.zones };
          
          for (const cameraId of Object.keys(newZones)) {
            const index = newZones[cameraId].findIndex(z => z.id === zoneId);
            if (index !== -1) {
              newZones[cameraId] = [...newZones[cameraId]];
              newZones[cameraId][index] = { ...newZones[cameraId][index], ...updates };
              break;
            }
          }
          
          return { zones: newZones };
        });
      },

      clearZonesForCamera: (cameraId: string) => {
        set((state) => {
          console.log(`[Store] Cleared zones for: ${cameraId}`);
          return {
            zones: {
              ...state.zones,
              [cameraId]: [],
            },
          };
        });
      },

      toggleZoneEnabled: (zoneId: string) => {
        set((state) => {
          const newZones = { ...state.zones };
          
          for (const cameraId of Object.keys(newZones)) {
            const index = newZones[cameraId].findIndex(z => z.id === zoneId);
            if (index !== -1) {
              newZones[cameraId] = [...newZones[cameraId]];
              newZones[cameraId][index] = {
                ...newZones[cameraId][index],
                enabled: !newZones[cameraId][index].enabled,
              };
              break;
            }
          }
          
          return { zones: newZones };
        });
      },

      // =========================================
      // DETECTION ACTIONS
      // =========================================

      setDetections: (cameraId: string, detections: Detection[]) => {
        set((state) => {
          const cameraZones = state.zones[cameraId] || [];
          const processedDetections = processDetectionsWithZones(detections, cameraZones);
          
          // Check for persons in zones
          const newAlerts: ZoneAlert[] = [];
          
          if (state.alarmEnabled) {
            const personsInZones = processedDetections.filter(
              d => d.label === 'person' && d.inZone
            );
            
            personsInZones.forEach(person => {
              person.zoneIds.forEach(zoneId => {
                const zone = cameraZones.find(z => z.id === zoneId);
                if (zone) {
                  const recentAlert = state.alerts.find(
                    a => a.zoneId === zoneId && 
                         Date.now() - a.timestamp < 5000 &&
                         !a.acknowledged
                  );
                  
                  if (!recentAlert) {
                    newAlerts.push({
                      id: generateId('alert'),
                      zoneId: zone.id,
                      zoneName: zone.name,
                      cameraId,
                      detectionLabel: 'person',
                      confidence: person.confidence,
                      timestamp: Date.now(),
                      acknowledged: false,
                    });
                    console.log(`[Store] 🚨 ALERT: Person in zone "${zone.name}"!`);
                  }
                }
              });
            });
          }
          
          return {
            detections: {
              ...state.detections,
              [cameraId]: processedDetections,
            },
            alerts: newAlerts.length > 0 
              ? [...state.alerts, ...newAlerts]
              : state.alerts,
          };
        });
      },

      clearDetections: (cameraId: string) => {
        set((state) => ({
          detections: {
            ...state.detections,
            [cameraId]: [],
          },
        }));
      },

      // =========================================
      // ALERT ACTIONS
      // =========================================

      addAlert: (alert: ZoneAlert) => {
        set((state) => ({
          alerts: [...state.alerts, alert],
        }));
      },

      acknowledgeAlert: (alertId: string) => {
        set((state) => ({
          alerts: state.alerts.map(a =>
            a.id === alertId ? { ...a, acknowledged: true } : a
          ),
        }));
      },

      clearAlerts: () => {
        set({ alerts: [] });
      },

      // =========================================
      // CAMERA ACTIONS
      // =========================================

      addCamera: (camera: Camera) => {
        set((state) => {
          if (state.cameras.find(c => c.id === camera.id)) {
            return state;
          }
          return { cameras: [...state.cameras, camera] };
        });
      },

      removeCamera: (cameraId: string) => {
        set((state) => {
          const newZones = { ...state.zones };
          delete newZones[cameraId];
          
          const newDetections = { ...state.detections };
          delete newDetections[cameraId];
          
          const newCameras = state.cameras.filter(c => c.id !== cameraId);
          
          return {
            cameras: newCameras,
            zones: newZones,
            detections: newDetections,
            selectedCameraId: state.selectedCameraId === cameraId
              ? newCameras[0]?.id || null
              : state.selectedCameraId,
          };
        });
      },

      updateCamera: (cameraId: string, updates: Partial<Camera>) => {
        set((state) => ({
          cameras: state.cameras.map(c =>
            c.id === cameraId ? { ...c, ...updates } : c
          ),
        }));
      },

      setSelectedCamera: (cameraId: string | null) => {
        set({ selectedCameraId: cameraId });
      },

      // =========================================
      // UI ACTIONS
      // =========================================

      setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode });
      },

      setDrawingState: (updates: Partial<DrawingState>) => {
        set((state) => ({
          drawingState: { ...state.drawingState, ...updates },
        }));
      },

      resetDrawingState: () => {
        set({ drawingState: initialDrawingState });
      },

      // =========================================
      // SETTINGS ACTIONS
      // =========================================

      toggleAlarm: () => {
        set((state) => ({ alarmEnabled: !state.alarmEnabled }));
      },

      toggleAlarmSound: () => {
        set((state) => ({ alarmSound: !state.alarmSound }));
      },

      toggleDetectionBoxes: () => {
        set((state) => ({ showDetectionBoxes: !state.showDetectionBoxes }));
      },

      toggleZones: () => {
        set((state) => ({ showZones: !state.showZones }));
      },

      // =========================================
      // UTILITY
      // =========================================

      reset: () => {
        set(initialState);
        console.log('[Store] Reset to initial state');
      },
    }),
    {
      name: 'ai-vision-camera-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cameras: state.cameras,
        zones: state.zones,
        selectedCameraId: state.selectedCameraId,
        viewMode: state.viewMode,
        alarmEnabled: state.alarmEnabled,
        alarmSound: state.alarmSound,
        showDetectionBoxes: state.showDetectionBoxes,
        showZones: state.showZones,
      }),
    }
  )
);

// -------------------------------------------
// DEFAULT EXPORT
// -------------------------------------------
export default useCameraStore;