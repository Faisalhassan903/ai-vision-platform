// ===========================================
// CAMERA MANAGEMENT PAGE - FIXED
// ===========================================
// Uses useCameras hook to sync with backend MongoDB
// Cameras persist across page navigation

import React, { useState, useEffect } from 'react';
import { useCameras } from '../hooks/useCameras';
import type { Camera, CameraType } from '../store';

// -------------------------------------------
// CAMERA PRESETS
// -------------------------------------------

const CAMERA_PRESETS = [
  {
    brand: 'Hikvision',
    model: 'General',
    rtspTemplate: 'rtsp://{username}:{password}@{ip}:554/Streaming/Channels/101',
    defaultPort: 554,
    instructions: 'Enable RTSP in camera settings. Channel 101 = Main stream.'
  },
  {
    brand: 'Dahua',
    model: 'General', 
    rtspTemplate: 'rtsp://{username}:{password}@{ip}:554/cam/realmonitor?channel=1&subtype=0',
    defaultPort: 554,
    instructions: 'subtype=0 for main stream, subtype=1 for sub stream.'
  },
  {
    brand: 'Reolink',
    model: 'General',
    rtspTemplate: 'rtsp://{username}:{password}@{ip}:554/h264Preview_01_main',
    defaultPort: 554,
    instructions: 'Use h264Preview_01_sub for lower quality stream.'
  },
  {
    brand: 'TP-Link Tapo',
    model: 'C200/C310',
    rtspTemplate: 'rtsp://{username}:{password}@{ip}:554/stream1',
    defaultPort: 554,
    instructions: 'Enable RTSP in Tapo app under Camera Settings > Advanced.'
  },
  {
    brand: 'Wyze',
    model: 'v2/v3',
    rtspTemplate: 'rtsp://{ip}:8554/live',
    defaultPort: 8554,
    instructions: 'Requires RTSP firmware from Wyze website.'
  },
  {
    brand: 'Custom',
    model: 'Manual URL',
    rtspTemplate: '',
    defaultPort: 554,
    instructions: 'Enter complete RTSP URL manually.'
  }
];

// -------------------------------------------
// MAIN COMPONENT
// -------------------------------------------

const CameraManagement: React.FC = () => {
  // Use the cameras hook (syncs with backend)
  const { 
    cameras, 
    isLoading, 
    error,
    addCamera, 
    updateCamera, 
    deleteCamera, 
    testCamera,
    refreshCameras 
  } = useCameras();

  // UI State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [testingCameraId, setTestingCameraId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);

  // Handle test camera
  const handleTestCamera = async (camera: Camera) => {
    setTestingCameraId(camera.id);
    setTestResult(null);

    const result = await testCamera(camera.id);
    
    setTestResult({ id: camera.id, ...result });
    setTestingCameraId(null);

    // Clear result after 3 seconds
    setTimeout(() => setTestResult(null), 3000);
  };

  // Handle delete camera
  const handleDeleteCamera = async (camera: Camera) => {
    if (confirm(`Delete camera "${camera.name}"? This cannot be undone.`)) {
      await deleteCamera(camera.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              📹 Camera Management
            </h1>
            <p className="text-slate-400 mt-1">
              Add and configure cameras • RTSP, Webcam, IP Camera supported
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshCameras}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition border border-slate-700"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2"
            >
              <span className="text-xl">+</span> Add Camera
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600/50 rounded-xl text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading cameras...</p>
          </div>
        ) : cameras.length === 0 ? (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        ) : (
          /* Camera Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                onEdit={() => setEditingCamera(camera)}
                onDelete={() => handleDeleteCamera(camera)}
                onTest={() => handleTestCamera(camera)}
                isTesting={testingCameraId === camera.id}
                testResult={testResult?.id === camera.id ? testResult : null}
              />
            ))}
            
            {/* Add Camera Card */}
            <button
              onClick={() => setShowAddModal(true)}
              className="border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all group min-h-[200px]"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center transition-all">
                <span className="text-3xl text-slate-500 group-hover:text-blue-400">+</span>
              </div>
              <span className="text-slate-500 group-hover:text-blue-400 font-medium">Add Camera</span>
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <StatBox label="Total Cameras" value={cameras.length} icon="📹" />
          <StatBox 
            label="Online" 
            value={cameras.filter(c => c.status === 'online').length} 
            icon="🟢" 
            color="green"
          />
          <StatBox 
            label="Offline" 
            value={cameras.filter(c => c.status === 'offline' || c.status === 'error').length} 
            icon="🔴" 
            color="red"
          />
          <StatBox 
            label="RTSP Cameras" 
            value={cameras.filter(c => c.type === 'rtsp').length} 
            icon="📡" 
          />
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || editingCamera) && (
          <AddCameraModal
            camera={editingCamera}
            onClose={() => {
              setShowAddModal(false);
              setEditingCamera(null);
            }}
            onSave={async (cameraData) => {
              if (editingCamera) {
                await updateCamera(editingCamera.id, cameraData);
              } else {
                await addCamera(cameraData);
              }
              setShowAddModal(false);
              setEditingCamera(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

// -------------------------------------------
// CAMERA CARD COMPONENT
// -------------------------------------------

interface CameraCardProps {
  camera: Camera;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: { success: boolean; error?: string } | null;
}

const CameraCard: React.FC<CameraCardProps> = ({ 
  camera, 
  onEdit, 
  onDelete, 
  onTest, 
  isTesting,
  testResult 
}) => {
  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-slate-500',
    connecting: 'bg-yellow-500 animate-pulse',
    error: 'bg-red-500'
  };

  const typeIcons: Record<string, string> = {
    webcam: '🎥',
    rtsp: '📡',
    http: '🌐',
    file: '📁'
  };

  return (
    <div className={`bg-[#111827] rounded-2xl border overflow-hidden hover:border-slate-600 transition-all ${
      camera.status === 'online' ? 'border-green-600/50' : 
      camera.status === 'error' ? 'border-red-600/50' : 'border-slate-800'
    }`}>
      {/* Preview Area */}
      <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl">{typeIcons[camera.type] || '📹'}</span>
          <p className="text-slate-500 text-sm mt-2">{camera.type.toUpperCase()}</p>
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 px-2 py-1 rounded-full">
          <div className={`w-2 h-2 rounded-full ${statusColors[camera.status]}`} />
          <span className="text-xs text-slate-300 capitalize">{camera.status}</span>
        </div>

        {/* Camera ID */}
        <div className="absolute top-3 right-3">
          <span className="text-xs text-slate-600 font-mono bg-black/50 px-2 py-1 rounded">
            {camera.id.slice(0, 12)}
          </span>
        </div>

        {/* Test Result Overlay */}
        {testResult && (
          <div className={`absolute inset-0 flex items-center justify-center ${
            testResult.success ? 'bg-green-600/80' : 'bg-red-600/80'
          }`}>
            <div className="text-center text-white">
              <span className="text-4xl">{testResult.success ? '✓' : '✗'}</span>
              <p className="text-sm mt-2">
                {testResult.success ? 'Connection OK!' : testResult.error || 'Failed'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-white">{camera.name}</h3>
            {camera.location && (
              <p className="text-xs text-slate-500 mt-1">📍 {camera.location}</p>
            )}
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            camera.enabled 
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {camera.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Stream URL (truncated) */}
        {camera.streamUrl && (
          <p className="text-xs text-slate-600 font-mono truncate mb-3" title={camera.streamUrl}>
            {camera.streamUrl.replace(/\/\/.*:.*@/, '//***:***@')}
          </p>
        )}

        {/* Error Message */}
        {camera.errorMessage && (
          <p className="text-xs text-red-400 mb-3 truncate" title={camera.errorMessage}>
            ⚠️ {camera.errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-medium transition border border-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isTesting ? (
              <>
                <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                Testing...
              </>
            ) : (
              '🔍 Test'
            )}
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition border border-red-600/30"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------
// ADD CAMERA MODAL
// -------------------------------------------

interface AddCameraModalProps {
  camera: Camera | null;
  onClose: () => void;
  onSave: (camera: Partial<Camera>) => Promise<void>;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ camera, onClose, onSave }) => {
  const [step, setStep] = useState(1);
  const [cameraType, setCameraType] = useState<CameraType>(camera?.type || 'webcam');
  const [selectedPreset, setSelectedPreset] = useState<typeof CAMERA_PRESETS[0] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: camera?.name || '',
    location: camera?.location || '',
    group: camera?.group || '',
    streamUrl: camera?.streamUrl || '',
    username: camera?.username || '',
    password: camera?.password || '',
    ip: '',
    port: '554',
    enabled: camera?.enabled !== false,
  });

  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(camera?.deviceId || '');

  // Load webcam devices
  useEffect(() => {
    if (cameraType === 'webcam') {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setWebcamDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(videoDevices[0].deviceId);
        }
      }).catch(() => {
        // Permission denied or no devices
      });
    }
  }, [cameraType]);

  // Build RTSP URL from preset
  const buildRtspUrl = () => {
    if (!selectedPreset || !formData.ip) return '';
    
    let url = selectedPreset.rtspTemplate
      .replace('{ip}', formData.ip)
      .replace('{port}', formData.port || String(selectedPreset.defaultPort))
      .replace('{username}', formData.username || 'admin')
      .replace('{password}', formData.password || 'password');
    
    return url;
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      await onSave({
        name: formData.name || `Camera ${Date.now()}`,
        type: cameraType,
        streamUrl: cameraType === 'rtsp' 
          ? (selectedPreset?.brand === 'Custom' ? formData.streamUrl : buildRtspUrl())
          : cameraType === 'http' ? formData.streamUrl
          : undefined,
        username: formData.username || undefined,
        password: formData.password || undefined,
        deviceId: cameraType === 'webcam' ? selectedDevice : undefined,
        location: formData.location || undefined,
        group: formData.group || undefined,
        enabled: formData.enabled,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {camera ? '✏️ Edit Camera' : '➕ Add New Camera'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Step 1: Select Camera Type */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Select Camera Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'webcam' as CameraType, icon: '🎥', label: 'USB Webcam', desc: 'Built-in or USB camera' },
                    { type: 'rtsp' as CameraType, icon: '📡', label: 'IP Camera (RTSP)', desc: 'Hikvision, Dahua, etc.' },
                    { type: 'http' as CameraType, icon: '🌐', label: 'HTTP Stream', desc: 'MJPEG or HLS stream' },
                    { type: 'file' as CameraType, icon: '📁', label: 'Video File', desc: 'For testing' },
                  ].map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => setCameraType(opt.type)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        cameraType === opt.type
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <h3 className="font-semibold text-white mt-2">{opt.label}</h3>
                      <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition"
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Configure Camera */}
          {step === 2 && (
            <div className="space-y-6">
              <button
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
              >
                ← Back
              </button>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Camera Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Front Entrance"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Building A"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* RTSP Configuration */}
              {cameraType === 'rtsp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Camera Brand
                    </label>
                    <select
                      value={selectedPreset?.brand || ''}
                      onChange={(e) => {
                        const preset = CAMERA_PRESETS.find((p) => p.brand === e.target.value);
                        setSelectedPreset(preset || null);
                        if (preset) {
                          setFormData({ ...formData, port: String(preset.defaultPort) });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select brand...</option>
                      {CAMERA_PRESETS.map((preset) => (
                        <option key={preset.brand} value={preset.brand}>
                          {preset.brand} - {preset.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPreset && selectedPreset.brand !== 'Custom' && (
                    <>
                      <div className="p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                        <p className="text-sm text-blue-300">💡 {selectedPreset.instructions}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-300 mb-2">IP Address *</label>
                          <input
                            type="text"
                            value={formData.ip}
                            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                            placeholder="192.168.1.100"
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Port</label>
                          <input
                            type="text"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="admin"
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {(selectedPreset?.brand === 'Custom' || !selectedPreset) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">RTSP URL *</label>
                      <input
                        type="text"
                        value={formData.streamUrl}
                        onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                        placeholder="rtsp://username:password@192.168.1.100:554/stream"
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      />
                    </div>
                  )}

                  {selectedPreset && selectedPreset.brand !== 'Custom' && formData.ip && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Generated URL</label>
                      <div className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-mono text-sm break-all">
                        {buildRtspUrl().replace(/\/\/.*:.*@/, '//***:***@')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Webcam Configuration */}
              {cameraType === 'webcam' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Webcam</label>
                  {webcamDevices.length === 0 ? (
                    <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                      <p className="text-sm text-yellow-300">⚠️ No webcams detected. Connect a webcam and refresh.</p>
                    </div>
                  ) : (
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      {webcamDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* HTTP Stream */}
              {cameraType === 'http' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">HTTP Stream URL *</label>
                  <input
                    type="text"
                    value={formData.streamUrl}
                    onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                    placeholder="http://192.168.1.100/video.mjpg"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Enable Camera</p>
                  <p className="text-xs text-slate-400">Camera will be active for monitoring</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                  className={`w-12 h-7 rounded-full transition-all relative ${
                    formData.enabled ? 'bg-green-600' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                    formData.enabled ? 'left-6' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || isSaving}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    camera ? '💾 Save Changes' : '✓ Add Camera'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------
// EMPTY STATE
// -------------------------------------------

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="text-center py-20">
    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
      <span className="text-5xl">📹</span>
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">No Cameras Added</h2>
    <p className="text-slate-400 mb-8 max-w-md mx-auto">
      Add your first camera to start monitoring. Supports IP cameras, webcams, and streams.
    </p>
    <button
      onClick={onAdd}
      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold"
    >
      + Add Your First Camera
    </button>
  </div>
);

// -------------------------------------------
// STAT BOX
// -------------------------------------------

const StatBox: React.FC<{ label: string; value: number; icon: string; color?: string }> = ({ 
  label, value, icon, color = 'slate' 
}) => {
  const colors: Record<string, string> = {
    green: 'from-green-600/20 to-green-600/5 border-green-500/30',
    red: 'from-red-600/20 to-red-600/5 border-red-500/30',
    slate: 'from-slate-600/20 to-slate-600/5 border-slate-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
};

export default CameraManagement;