import React, { useState, useEffect } from 'react';
import { useCameras } from '../hooks/useCameras';
import type { Camera, CameraType } from '../store';
import VideoAnalysis from './VideoAnalysis';

// ── CAMERA PRESETS ────────────────────────────────────────────────────────────
const CAMERA_PRESETS = [
  { brand: 'Hikvision',    rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/Streaming/Channels/101', defaultPort: 554, instructions: 'Enable RTSP in camera settings. Channel 101 = Main stream.' },
  { brand: 'Dahua',        rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel=1&subtype=0', defaultPort: 554, instructions: 'subtype=0 for main stream, subtype=1 for sub stream.' },
  { brand: 'Reolink',      rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/h264Preview_01_main', defaultPort: 554, instructions: 'Use h264Preview_01_sub for lower quality.' },
  { brand: 'TP-Link Tapo', rtspTemplate: 'rtsp://{username}:{password}@{ip}:{port}/stream1', defaultPort: 554, instructions: 'Enable RTSP in Tapo app under Camera Settings > Advanced.' },
  { brand: 'Wyze',         rtspTemplate: 'rtsp://{ip}:{port}/live', defaultPort: 8554, instructions: 'Requires RTSP firmware from Wyze website.' },
  { brand: 'Custom',       rtspTemplate: '', defaultPort: 554, instructions: 'Enter complete RTSP URL manually.' },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const CameraManagement: React.FC = () => {
  const { cameras, isLoading, error, addCamera, updateCamera, deleteCamera, testCamera, refreshCameras } = useCameras();
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [testingId,     setTestingId]     = useState<string | null>(null);
  const [testResult,    setTestResult]    = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [activeTab,     setActiveTab]     = useState<'cameras' | 'analyze'>('cameras');

  const handleTest = async (camera: Camera) => {
    setTestingId(camera.id);
    setTestResult(null);
    const result = await testCamera(camera.id);
    setTestResult({ id: camera.id, ...result });
    setTestingId(null);
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleDelete = async (camera: Camera) => {
    if (confirm(`Delete "${camera.name}"?`)) await deleteCamera(camera.id);
  };

  return (
    <div className="min-h-screen bg-[#080c12] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Cameras</h1>
            <p className="text-white/35 text-sm mt-0.5">Manage cameras and analyse video footage</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshCameras}
              className="px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-sm text-white/60 transition-all flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-400 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-red-500/20 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Camera
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6 w-full sm:w-fit">
          {(['cameras', 'analyze'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'
              }`}>
              {t === 'analyze' ? 'Video Analysis' : 'Cameras'}
            </button>
          ))}
        </div>

        {/* ── CAMERAS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'cameras' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cameras.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff30" strokeWidth="1.5">
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
                    <rect x="2" y="7" width="13" height="10" rx="2"/>
                  </svg>
                </div>
                <p className="text-white/40 text-sm mb-4">No cameras added yet</p>
                <button onClick={() => setShowAddModal(true)}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-xl transition-all">
                  Add your first camera
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cameras.map(camera => (
                  <CameraCard key={camera.id} camera={camera}
                    onEdit={() => setEditingCamera(camera)}
                    onDelete={() => handleDelete(camera)}
                    onTest={() => handleTest(camera)}
                    isTesting={testingId === camera.id}
                    testResult={testResult?.id === camera.id ? testResult : null}
                  />
                ))}
                <button onClick={() => setShowAddModal(true)}
                  className="border-2 border-dashed border-white/8 hover:border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all group min-h-[180px]">
                  <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-white/8 flex items-center justify-center transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff40" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <span className="text-white/25 group-hover:text-white/40 text-sm transition-colors">Add Camera</span>
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Total',   value: cameras.length,                                                            color: 'text-white' },
                { label: 'Online',  value: cameras.filter(c => c.status === 'online').length,                         color: 'text-emerald-400' },
                { label: 'Offline', value: cameras.filter(c => c.status === 'offline' || c.status === 'error').length, color: 'text-red-400' },
                { label: 'RTSP',    value: cameras.filter(c => c.type === 'rtsp').length,                             color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-4">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── VIDEO ANALYSIS TAB ───────────────────────────────────────────── */}
        {activeTab === 'analyze' && <VideoAnalysis />}

      </div>

      {/* Modal */}
      {(showAddModal || editingCamera) && (
        <AddCameraModal
          camera={editingCamera}
          onClose={() => { setShowAddModal(false); setEditingCamera(null); }}
          onSave={async (data) => {
            if (editingCamera) await updateCamera(editingCamera.id, data);
            else await addCamera(data);
            setShowAddModal(false); setEditingCamera(null);
          }}
        />
      )}
    </div>
  );
};

// ── CAMERA CARD ───────────────────────────────────────────────────────────────
interface CameraCardProps {
  camera: Camera; onEdit: () => void; onDelete: () => void; onTest: () => void;
  isTesting: boolean; testResult: { success: boolean; error?: string } | null;
}

const CameraCard: React.FC<CameraCardProps> = ({ camera, onEdit, onDelete, onTest, isTesting, testResult }) => {
  const statusDot: Record<string, string> = {
    online: 'bg-emerald-400', offline: 'bg-white/20',
    connecting: 'bg-yellow-400 animate-pulse', error: 'bg-red-500',
  };

  return (
    <div className={`bg-white/3 rounded-2xl border overflow-hidden transition-all ${
      camera.status === 'online' ? 'border-emerald-500/20' :
      camera.status === 'error'  ? 'border-red-500/20' : 'border-white/8'
    }`}>
      <div className="aspect-video bg-black relative flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff15" strokeWidth="1.5">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
          <rect x="2" y="7" width="13" height="10" rx="2"/>
        </svg>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot[camera.status] || 'bg-white/20'}`} />
          <span className="text-[10px] text-white/50 capitalize">{camera.status}</span>
        </div>
        <div className="absolute top-3 right-3 bg-black/60 px-2 py-0.5 rounded text-[9px] text-white/25 font-mono">
          {camera.id.slice(0, 8)}
        </div>
        {testResult && (
          <div className={`absolute inset-0 flex items-center justify-center ${testResult.success ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}>
            <div className="text-center text-white">
              <p className="text-3xl mb-1">{testResult.success ? '✓' : '✗'}</p>
              <p className="text-xs">{testResult.success ? 'Connected' : testResult.error || 'Failed'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{camera.name}</p>
            {camera.location && <p className="text-white/30 text-xs mt-0.5 truncate">{camera.location}</p>}
          </div>
          <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            camera.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/25'
          }`}>
            {camera.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        {camera.streamUrl && (
          <p className="text-[10px] text-white/20 font-mono truncate mb-3">
            {camera.streamUrl.replace(/\/\/.*:.*@/, '//●●●:●●●@')}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onTest} disabled={isTesting}
            className="flex-1 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-xs text-white/60 hover:text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {isTesting
              ? <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            }
            {isTesting ? 'Testing' : 'Test'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-white/40 hover:text-white transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={onDelete}
            className="px-3 py-2 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 rounded-xl text-red-400/60 hover:text-red-400 transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ADD / EDIT CAMERA MODAL ───────────────────────────────────────────────────
interface AddCameraModalProps {
  camera: Camera | null;
  onClose: () => void;
  onSave: (c: Partial<Camera>) => Promise<void>;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ camera, onClose, onSave }) => {
  const [step,           setStep]           = useState(1);
  const [cameraType,     setCameraType]     = useState<CameraType>(camera?.type || 'webcam');
  const [selectedPreset, setSelectedPreset] = useState<typeof CAMERA_PRESETS[0] | null>(null);
  const [isSaving,       setIsSaving]       = useState(false);
  const [webcamDevices,  setWebcamDevices]  = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState(camera?.deviceId || '');
  const [formData,       setFormData]       = useState({
    name: camera?.name || '', location: camera?.location || '',
    streamUrl: camera?.streamUrl || '', username: camera?.username || '',
    password: camera?.password || '', ip: '', port: '554',
    enabled: camera?.enabled !== false,
  });

  useEffect(() => {
    if (cameraType === 'webcam') {
      navigator.mediaDevices.enumerateDevices().then(d => {
        const v = d.filter(x => x.kind === 'videoinput');
        setWebcamDevices(v);
        if (v.length > 0 && !selectedDevice) setSelectedDevice(v[0].deviceId);
      }).catch(() => {});
    }
  }, [cameraType]);

  const buildRtspUrl = () => {
    if (!selectedPreset || !formData.ip) return '';
    return selectedPreset.rtspTemplate
      .replace('{ip}',       formData.ip)
      .replace('{port}',     formData.port || String(selectedPreset.defaultPort))
      .replace('{username}', formData.username || 'admin')
      .replace('{password}', formData.password || 'password');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name:      formData.name || `Camera ${Date.now()}`,
        type:      cameraType,
        streamUrl: cameraType === 'rtsp'
          ? (selectedPreset?.brand === 'Custom' ? formData.streamUrl : buildRtspUrl())
          : cameraType === 'http' ? formData.streamUrl : undefined,
        username:  formData.username || undefined,
        password:  formData.password || undefined,
        deviceId:  cameraType === 'webcam' ? selectedDevice : undefined,
        location:  formData.location || undefined,
        enabled:   formData.enabled,
      });
    } finally { setIsSaving(false); }
  };

  const update = (k: string, v: any) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f1420] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-white font-semibold">{camera ? 'Edit Camera' : 'Add Camera'}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Step 1 — type selection */}
          {step === 1 && (
            <>
              <p className="text-white/40 text-sm">What type of camera are you adding?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'webcam' as CameraType, label: 'USB / Webcam',   sub: 'Built-in or USB' },
                  { type: 'rtsp'   as CameraType, label: 'IP Camera',      sub: 'Hikvision, Dahua…' },
                  { type: 'http'   as CameraType, label: 'HTTP Stream',    sub: 'MJPEG / HLS' },
                  { type: 'file'   as CameraType, label: 'Video File',     sub: 'For testing' },
                ].map(o => (
                  <button key={o.type} onClick={() => setCameraType(o.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      cameraType === o.type ? 'border-red-500/60 bg-red-500/8' : 'border-white/8 hover:border-white/15'
                    }`}>
                    <p className="text-white text-sm font-medium">{o.label}</p>
                    <p className="text-white/30 text-xs mt-0.5">{o.sub}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)}
                className="w-full py-3 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-xl transition-all">
                Continue
              </button>
            </>
          )}

          {/* Step 2 — configuration */}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="text-white/30 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-white/40 text-xs mb-1.5 block">Camera name *</label>
                  <input value={formData.name} onChange={e => update('name', e.target.value)}
                    placeholder="Front Entrance"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-white/40 text-xs mb-1.5 block">Location</label>
                  <input value={formData.location} onChange={e => update('location', e.target.value)}
                    placeholder="Building A"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
              </div>

              {cameraType === 'webcam' && (
                <div>
                  <label className="text-white/40 text-xs mb-1.5 block">Select webcam</label>
                  {webcamDevices.length === 0 ? (
                    <p className="text-yellow-400/60 text-xs p-3 bg-yellow-500/8 rounded-xl border border-yellow-500/15">No webcams detected</p>
                  ) : (
                    <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-all">
                      {webcamDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {cameraType === 'rtsp' && (
                <>
                  <div>
                    <label className="text-white/40 text-xs mb-1.5 block">Camera brand</label>
                    <select
                      value={selectedPreset?.brand || ''}
                      onChange={e => {
                        const p = CAMERA_PRESETS.find(x => x.brand === e.target.value);
                        setSelectedPreset(p || null);
                        if (p) update('port', String(p.defaultPort));
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-all">
                      <option value="">Select brand…</option>
                      {CAMERA_PRESETS.map(p => <option key={p.brand} value={p.brand}>{p.brand}</option>)}
                    </select>
                    {selectedPreset && <p className="text-white/25 text-xs mt-1.5">{selectedPreset.instructions}</p>}
                  </div>

                  {selectedPreset && selectedPreset.brand !== 'Custom' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-white/40 text-xs mb-1.5 block">IP address *</label>
                        <input value={formData.ip} onChange={e => update('ip', e.target.value)} placeholder="192.168.1.100"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1.5 block">Port</label>
                        <input value={formData.port} onChange={e => update('port', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-white/25 transition-all" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">Username</label>
                      <input value={formData.username} onChange={e => update('username', e.target.value)} placeholder="admin"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">Password</label>
                      <input type="password" value={formData.password} onChange={e => update('password', e.target.value)} placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                  </div>

                  {(!selectedPreset || selectedPreset.brand === 'Custom') && (
                    <div>
                      <label className="text-white/40 text-xs mb-1.5 block">RTSP URL *</label>
                      <input value={formData.streamUrl} onChange={e => update('streamUrl', e.target.value)}
                        placeholder="rtsp://user:pass@192.168.1.100:554/stream"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                    </div>
                  )}
                </>
              )}

              {(cameraType === 'http' || cameraType === 'file') && (
                <div>
                  <label className="text-white/40 text-xs mb-1.5 block">
                    {cameraType === 'http' ? 'Stream URL *' : 'File URL *'}
                  </label>
                  <input value={formData.streamUrl} onChange={e => update('streamUrl', e.target.value)}
                    placeholder={cameraType === 'http' ? 'http://192.168.1.100/video.mjpg' : '/videos/sample.mp4'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-white/25 transition-all" />
                </div>
              )}

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Enable camera</p>
                  <p className="text-white/25 text-xs mt-0.5">Active for monitoring immediately</p>
                </div>
                <button onClick={() => update('enabled', !formData.enabled)}
                  className={`w-11 h-6 rounded-full relative transition-all ${formData.enabled ? 'bg-emerald-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/8 border border-white/8 text-white/50 text-sm rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={!formData.name || isSaving}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isSaving ? 'Saving…' : camera ? 'Save Changes' : 'Add Camera'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraManagement;