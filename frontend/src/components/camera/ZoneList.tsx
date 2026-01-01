// ===========================================
// ZONE LIST COMPONENT
// ===========================================
// Displays all zones for a camera with controls

import React from 'react';
import { useCameraStore } from '../../store';

interface ZoneListProps {
  cameraId: string;
}

const ZoneList: React.FC<ZoneListProps> = ({ cameraId }) => {
  // Get zones from store
  const zonesRecord = useCameraStore((state) => state.zones);
  const removeZone = useCameraStore((state) => state.removeZone);
  const toggleZoneEnabled = useCameraStore((state) => state.toggleZoneEnabled);
  const clearZonesForCamera = useCameraStore((state) => state.clearZonesForCamera);

  const zones = zonesRecord[cameraId] || [];

  if (zones.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          🎯 Security Zones
        </h3>
        <p className="text-slate-400 text-sm">
          No zones defined. Click "Draw Zone" on the camera to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🎯 Security Zones
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {zones.length}
          </span>
        </h3>
        <button
          onClick={() => clearZonesForCamera(cameraId)}
          className="text-xs text-red-400 hover:text-red-300 transition"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition ${
              zone.enabled
                ? 'bg-red-900/30 border-red-500/50'
                : 'bg-slate-700/50 border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Enable/Disable Toggle */}
              <button
                onClick={() => toggleZoneEnabled(zone.id)}
                className={`w-10 h-6 rounded-full transition-all relative ${
                  zone.enabled ? 'bg-red-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    zone.enabled ? 'left-5' : 'left-1'
                  }`}
                />
              </button>

              {/* Zone Info */}
              <div>
                <p className="font-medium text-sm">{zone.name}</p>
                <p className="text-xs text-slate-400">
                  {(zone.width * 100).toFixed(0)}% × {(zone.height * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => removeZone(zone.id)}
              className="p-1 hover:bg-red-600 rounded transition text-slate-400 hover:text-white"
              title="Delete Zone"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 mb-2">Detection Behavior:</p>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-500 rounded"></span>
            <span className="text-slate-400">Outside Zone</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded animate-pulse"></span>
            <span className="text-slate-400">In Zone (ALERT)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneList;
