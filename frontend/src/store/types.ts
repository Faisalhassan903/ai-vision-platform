// ===========================================
// AI VISION PLATFORM - TYPE DEFINITIONS
// ===========================================
// These types define the shape of ALL data in our system.
// TypeScript will catch errors at compile time if we use wrong types.

// -------------------------------------------
// ZONE TYPES
// -------------------------------------------

/**
 * A Zone is a rectangular area drawn on a camera view.
 * When a person enters this zone, an alarm triggers.
 * 
 * Coordinates are NORMALIZED (0-1 range) so they work
 * regardless of canvas/video size.
 */
export interface Zone {
  id: string;              // Unique identifier (e.g., "zone-1704067200000")
  cameraId: string;        // Which camera this zone belongs to
  name: string;            // User-friendly name (e.g., "Entrance", "Restricted Area")
  
  // Normalized coordinates (0-1 range)
  // Example: x=0.5 means 50% from left edge
  x: number;               // Left edge (0-1)
  y: number;               // Top edge (0-1)
  width: number;           // Width (0-1)
  height: number;          // Height (0-1)
  
  // Zone configuration
  color: string;           // Zone border color (default: red)
  enabled: boolean;        // Is this zone active for detection?
  
  // Metadata
  createdAt: number;       // Timestamp when created
}

/**
 * ZoneAlert - Generated when a person enters a zone
 */
export interface ZoneAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  cameraId: string;
  detectionLabel: string;  // What was detected (e.g., "person")
  confidence: number;      // Detection confidence (0-1)
  timestamp: number;
  acknowledged: boolean;   // Has user dismissed this alert?
}

// -------------------------------------------
// DETECTION TYPES
// -------------------------------------------

/**
 * A Detection is an object found by YOLOv8.
 * Bounding box coordinates are normalized (0-1 range).
 */
export interface Detection {
  label: string;           // What was detected: "person", "car", "bottle"
  confidence: number;      // How sure is YOLO? (0-1, e.g., 0.88 = 88%)
  
  // Bounding box (normalized 0-1)
  x: number;               // Left edge
  y: number;               // Top edge
  width: number;           // Box width
  height: number;          // Box height
  
  // Zone intersection (calculated by our system)
  inZone: boolean;         // Is this detection inside any zone?
  zoneIds: string[];       // Which zones is it inside?
}

/**
 * DetectionResult - What backend sends us via Socket.io
 */
export interface DetectionResult {
  detections: Detection[];
  totalObjects: number;
  timestamp: number;
  fps?: number;
}

// -------------------------------------------
// CAMERA TYPES
// -------------------------------------------

/**
 * Camera source types
 */
export type CameraType = 'webcam' | 'rtsp' | 'http' | 'file';

/**
 * Camera connection status
 */
export type CameraStatus = 'online' | 'offline' | 'connecting' | 'error';

/**
 * Camera configuration - Universal support for any camera type
 */
export interface Camera {
  id: string;                    // Unique camera ID (auto-generated)
  name: string;                  // Display name (e.g., "Front Door", "Parking Lot")
  type: CameraType;              // Camera source type
  
  // Connection settings
  streamUrl?: string;            // RTSP/HTTP stream URL (for IP cameras)
  username?: string;             // Auth username (for secured streams)
  password?: string;             // Auth password (for secured streams)
  deviceId?: string;             // WebRTC device ID (for webcams)
  filePath?: string;             // Local file path (for video files)
  
  // Stream settings
  fps?: number;                  // Target FPS for processing (default: 5)
  resolution?: {                 // Target resolution
    width: number;
    height: number;
  };
  
  // Location & Organization
  location?: string;             // Physical location (e.g., "Building A, Floor 2")
  group?: string;                // Camera group (e.g., "Entrance", "Warehouse")
  
  // Status (updated in real-time)
  enabled: boolean;              // Is camera active?
  status: CameraStatus;          // Current connection status
  lastSeen?: number;             // Last frame timestamp
  errorMessage?: string;         // Last error message
  
  // Metadata
  createdAt: number;             // When camera was added
  updatedAt?: number;            // Last configuration update
}

/**
 * Camera presets for common brands
 */
export interface CameraPreset {
  brand: string;
  model: string;
  rtspTemplate: string;          // e.g., "rtsp://{ip}:{port}/stream1"
  defaultPort: number;
  instructions: string;
}

/**
 * CameraState - Current state of a camera in the UI
 */
export interface CameraState {
  cameraId: string;
  isStreaming: boolean;
  fps: number;
  detectionCount: number;
  lastDetections: Detection[];
  hasAlarm: boolean;       // Currently in alarm state?
}

// -------------------------------------------
// UI STATE TYPES
// -------------------------------------------

/**
 * ViewMode - How cameras are displayed
 */
export type ViewMode = 'grid' | 'single';

/**
 * DrawingMode - What the user is doing on canvas
 */
export type DrawingMode = 'none' | 'drawing' | 'editing' | 'deleting';

/**
 * DrawingState - Tracks zone drawing progress
 */
export interface DrawingState {
  mode: DrawingMode;
  startX: number | null;   // Where mouse started (normalized)
  startY: number | null;
  currentX: number | null; // Current mouse position
  currentY: number | null;
  selectedZoneId: string | null;  // Zone being edited
}

// -------------------------------------------
// STORE STATE TYPE
// -------------------------------------------

/**
 * CameraStoreState - The complete state shape for Zustand
 * This is what gets stored and persisted.
 */
export interface CameraStoreState {
  // === DATA ===
  cameras: Camera[];                              // All configured cameras
  zones: Record<string, Zone[]>;                  // Zones per camera: { "cam1": [zone1, zone2] }
  detections: Record<string, Detection[]>;        // Latest detections per camera
  alerts: ZoneAlert[];                            // Active zone alerts
  
  // === UI STATE ===
  selectedCameraId: string | null;                // Currently focused camera
  viewMode: ViewMode;                             // Grid or single view
  drawingState: DrawingState;                     // Zone drawing progress
  
  // === SETTINGS ===
  alarmEnabled: boolean;                          // Global alarm on/off
  alarmSound: boolean;                            // Play sound on alarm?
  showDetectionBoxes: boolean;                    // Show blue detection boxes?
  showZones: boolean;                             // Show zone overlays?
}

// -------------------------------------------
// STORE ACTIONS TYPE
// -------------------------------------------

/**
 * CameraStoreActions - All actions available in the store
 * Actions are functions that modify state.
 */
export interface CameraStoreActions {
  // === ZONE ACTIONS ===
  addZone: (zone: Zone) => void;
  removeZone: (zoneId: string) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  clearZonesForCamera: (cameraId: string) => void;
  getZonesForCamera: (cameraId: string) => Zone[];
  toggleZoneEnabled: (zoneId: string) => void;
  
  // === DETECTION ACTIONS ===
  setDetections: (cameraId: string, detections: Detection[]) => void;
  clearDetections: (cameraId: string) => void;
  
  // === ALERT ACTIONS ===
  addAlert: (alert: ZoneAlert) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  
  // === CAMERA ACTIONS ===
  addCamera: (camera: Camera) => void;
  removeCamera: (cameraId: string) => void;
  updateCamera: (cameraId: string, updates: Partial<Camera>) => void;
  setSelectedCamera: (cameraId: string | null) => void;
  
  // === UI ACTIONS ===
  setViewMode: (mode: ViewMode) => void;
  setDrawingState: (state: Partial<DrawingState>) => void;
  resetDrawingState: () => void;
  
  // === SETTINGS ACTIONS ===
  toggleAlarm: () => void;
  toggleAlarmSound: () => void;
  toggleDetectionBoxes: () => void;
  toggleZones: () => void;
  
  // === UTILITY ===
  reset: () => void;  // Reset entire store to defaults
}

// -------------------------------------------
// COMPLETE STORE TYPE
// -------------------------------------------

/**
 * CameraStore - Combined state + actions
 * This is the type of what useCameraStore() returns
 */
export type CameraStore = CameraStoreState & CameraStoreActions;