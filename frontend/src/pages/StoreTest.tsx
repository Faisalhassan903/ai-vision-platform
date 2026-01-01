// ===========================================
// STORE TEST COMPONENT - FIXED VERSION
// ===========================================
// Uses correct Zustand selector pattern

import React from 'react';
import { useCameraStore } from '../store';
import type { Zone } from '../store';

const StoreTest: React.FC = () => {
  // ==========================================
  // CORRECT WAY: Select primitive values or use shallow comparison
  // Each selector returns a STABLE reference
  // ==========================================
  
  const cameras = useCameraStore((state) => state.cameras);
  const selectedCameraId = useCameraStore((state) => state.selectedCameraId);
  const zonesRecord = useCameraStore((state) => state.zones);
  const alerts = useCameraStore((state) => state.alerts);
  const alarmEnabled = useCameraStore((state) => state.alarmEnabled);
  
  // Actions (these are stable, no re-render issues)
  const addZone = useCameraStore((state) => state.addZone);
  const removeZone = useCameraStore((state) => state.removeZone);
  const clearZonesForCamera = useCameraStore((state) => state.clearZonesForCamera);
  const reset = useCameraStore((state) => state.reset);
  const toggleAlarm = useCameraStore((state) => state.toggleAlarm);

  // Derive zones for selected camera (safe because zonesRecord is from state)
  const zones = selectedCameraId ? (zonesRecord[selectedCameraId] || []) : [];
  
  // Count active alerts
  const activeAlertCount = alerts.filter(a => !a.acknowledged).length;

  // Create a test zone
  const handleAddZone = () => {
    if (!selectedCameraId) return;
    
    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      cameraId: selectedCameraId,
      name: `Test Zone ${zones.length + 1}`,
      x: Math.random() * 0.5,
      y: Math.random() * 0.5,
      width: 0.2 + Math.random() * 0.2,
      height: 0.2 + Math.random() * 0.2,
      color: '#ff0000',
      enabled: true,
      createdAt: Date.now(),
    };
    
    addZone(newZone);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧪 Zustand Store Test</h1>
      
      {/* Store Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Store Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Cameras:</span>
            <span className="ml-2 text-green-400">{cameras.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Selected Camera:</span>
            <span className="ml-2 text-blue-400">{selectedCameraId || 'None'}</span>
          </div>
          <div>
            <span className="text-gray-400">Zones (this camera):</span>
            <span className="ml-2 text-yellow-400">{zones.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Active Alerts:</span>
            <span className="ml-2 text-red-400">{activeAlertCount}</span>
          </div>
          <div>
            <span className="text-gray-400">Alarm Enabled:</span>
            <span className={`ml-2 ${alarmEnabled ? 'text-green-400' : 'text-red-400'}`}>
              {alarmEnabled ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAddZone}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            ➕ Add Zone
          </button>
          <button
            onClick={() => selectedCameraId && clearZonesForCamera(selectedCameraId)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition"
          >
            🗑️ Clear Zones
          </button>
          <button
            onClick={toggleAlarm}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
          >
            🔔 Toggle Alarm
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            ⚠️ Reset Store
          </button>
        </div>
      </div>

      {/* Cameras */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Cameras</h2>
        <div className="space-y-2">
          {cameras.map((camera) => (
            <div 
              key={camera.id}
              className={`p-3 rounded-lg border ${
                camera.id === selectedCameraId 
                  ? 'border-blue-500 bg-blue-500/20' 
                  : 'border-gray-600 bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{camera.name}</span>
                <span className="text-sm text-gray-400">{camera.type}</span>
              </div>
              <div className="text-sm text-gray-400">ID: {camera.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zones */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Zones for {selectedCameraId || 'No Camera'}
        </h2>
        {zones.length === 0 ? (
          <p className="text-gray-400">No zones defined. Click "Add Zone" to create one!</p>
        ) : (
          <div className="space-y-2">
            {zones.map((zone) => (
              <div 
                key={zone.id}
                className="p-3 bg-gray-700 rounded-lg flex justify-between items-center"
              >
                <div>
                  <span className="font-medium">{zone.name}</span>
                  <div className="text-sm text-gray-400">
                    Position: ({(zone.x * 100).toFixed(0)}%, {(zone.y * 100).toFixed(0)}%) | 
                    Size: {(zone.width * 100).toFixed(0)}% × {(zone.height * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    zone.enabled ? 'bg-green-600' : 'bg-gray-600'
                  }`}>
                    {zone.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => removeZone(zone.id)}
                    className="p-1 hover:bg-red-600 rounded transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Persistence Test */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">🔄 Persistence Test</h2>
        <p className="text-gray-400 mb-3">
          Add some zones, then refresh the page. If they're still there, persistence is working!
        </p>
        <div className="text-sm text-gray-500">
          Check localStorage: <code className="bg-gray-700 px-2 py-1 rounded">
            localStorage.getItem('ai-vision-camera-store')
          </code>
        </div>
      </div>
    </div>
  );
};

export default StoreTest;