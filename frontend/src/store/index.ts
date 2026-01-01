// ===========================================
// STORE INDEX - Clean exports
// ===========================================

// Main store hook and helpers
export { 
  useCameraStore,
  isDetectionInZone,
  processDetectionsWithZones,
} from './cameraStore';

// All types
export type {
  Zone,
  ZoneAlert,
  Detection,
  DetectionResult,
  Camera,
  CameraState,
  ViewMode,
  DrawingMode,
  DrawingState,
  CameraStoreState,
  CameraStoreActions,
  CameraStore,
} from './types';