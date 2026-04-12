import { useState, useEffect } from 'react';
import axios from 'axios';
// 1. IMPORT API_BASE_URL
import { API_BASE_URL } from '../config'; 

interface RuleBuilderProps {
  rule?: any;
  onClose: () => void;
}

const OBJECT_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

function RuleBuilder({ rule, onClose }: RuleBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'info' | 'warning' | 'critical'>('warning');
  const [objectClasses, setObjectClasses] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [timeRangeEnabled, setTimeRangeEnabled] = useState(false);
  const [timeStart, setTimeStart] = useState('22:00');
  const [timeEnd, setTimeEnd] = useState('06:00');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [saveSnapshot, setSaveSnapshot] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setName(rule.name || '');
      setDescription(rule.description || '');
      setPriority(rule.priority || 'warning');
      setObjectClasses(rule.conditions?.objectClasses || []);
      setMinConfidence(rule.conditions?.minConfidence || 0.5);
      setTimeRangeEnabled(!!rule.conditions?.timeRange);
      setTimeStart(rule.conditions?.timeRange?.start || '22:00');
      setTimeEnd(rule.conditions?.timeRange?.end || '06:00');
      setNotificationEnabled(rule.actions?.notification !== false);
      setAudioEnabled(rule.actions?.audioAlert || false);
      setDiscordEnabled(rule.actions?.discord || false);
      setSaveSnapshot(rule.actions?.saveSnapshot !== false);
      setCooldownMinutes(rule.cooldownMinutes || 5);
    }
  }, [rule]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('❌ Please enter a rule name');
      return;
    }

    if (objectClasses.length === 0) {
      alert('❌ Please select at least one object to detect');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || `Alert when ${objectClasses.join(', ')} detected`,
        priority: priority,
        enabled: true,
        conditions: {
          objectClasses: objectClasses,
          minConfidence: minConfidence,
          ...(timeRangeEnabled && {
            timeRange: { start: timeStart, end: timeEnd }
          })
        },
        actions: {
          notification: notificationEnabled,
          audioAlert: audioEnabled,
          discord: discordEnabled,
          saveSnapshot: saveSnapshot,
          email: false
        },
        cooldownMinutes: cooldownMinutes
      };

      // 2. USE API_BASE_URL FOR POST/PUT
      if (rule) {
        await axios.put(`${API_BASE_URL}/api/alerts/rules/${rule._id}`, payload);
        alert('✅ Rule updated successfully!');
      } else {
        await axios.post(`${API_BASE_URL}/api/alerts/rules`, payload);
        alert('✅ Rule created successfully!');
      }

      onClose();

    } catch (error: any) {
      console.error('❌ Failed to save rule:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`❌ Failed to save rule: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleObject = (obj: string) => {
    setObjectClasses(prev => 
      prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
            <h2 className="text-3xl font-bold text-white">
              {rule ? '✏️ Edit Alert Rule' : '➕ Create New Alert Rule'}
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl font-bold leading-none transition"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            
            {/* Rule Name */}
            <div>
              <label className="block text-white text-sm font-bold mb-2">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Person Detection Alert"
                className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-white text-sm font-bold mb-3">
                Priority Level <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['info', 'warning', 'critical'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-4 rounded-lg font-bold text-lg transition-all ${
                      priority === p 
                        ? `${p === 'info' ? 'bg-blue-600' : p === 'warning' ? 'bg-yellow-600' : 'bg-red-600'} text-white shadow-lg transform scale-105` 
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Detect Objects */}
            <div>
              <label className="block text-white text-sm font-bold mb-2">
                Detect Objects <span className="text-red-500">*</span>
                <span className="ml-2 text-blue-400">({objectClasses.length} selected)</span>
              </label>
              <div className="bg-slate-700 border-2 border-slate-600 rounded-lg p-4 max-h-64 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OBJECT_CLASSES.map(obj => (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => toggleObject(obj)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        objectClasses.includes(obj) 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                      }`}
                    >
                      {obj}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Minimum Confidence */}
            <div>
              <label className="block text-white text-sm font-bold mb-2">
                Minimum Confidence: <span className="text-blue-400">{(minConfidence * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Alert Actions */}
            <div>
              <label className="block text-white text-sm font-bold mb-3">Alert Actions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-700 p-4 rounded-lg border-2 border-slate-600">
                <Checkbox label="🔔 Browser Notification" checked={notificationEnabled} onChange={setNotificationEnabled} />
                <Checkbox label="🔊 Audio Alert" checked={audioEnabled} onChange={setAudioEnabled} />
                <Checkbox label="💬 Discord Notification" checked={discordEnabled} onChange={setDiscordEnabled} />
                <Checkbox label="📸 Save Snapshot" checked={saveSnapshot} onChange={setSaveSnapshot} />
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-slate-700">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-lg font-bold text-lg transition-all ${
                isSaving 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {isSaving ? '⏳ Saving...' : rule ? '💾 Update Rule' : '➕ Create Rule'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small helper component for cleaner JSX
const Checkbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-slate-600 p-2 rounded transition">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-5 h-5 rounded accent-blue-500"
    />
    <span className="font-medium">{label}</span>
  </label>
);

export default RuleBuilder;