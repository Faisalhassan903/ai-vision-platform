import { useState, useEffect } from 'react';
import axios from 'axios';
// 1. IMPORT MAIN_BACKEND_URL INSTEAD OF API_BASE_URL
import { MAIN_BACKEND_URL } from '../config'; 

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

      // 2. UPDATED TO USE MAIN_BACKEND_URL
      if (rule) {
        await axios.put(`${MAIN_BACKEND_URL}/api/alerts/rules/${rule._id}`, payload);
        alert('✅ Rule updated successfully!');
      } else {
        await axios.post(`${MAIN_BACKEND_URL}/api/alerts/rules`, payload);
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-700">
        <div className="p-8">
          
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
            <h2 className="text-3xl font-bold text-white">
              {rule ? '✏️ Modify Security Logic' : '➕ New Detection Rule'}
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <span className="text-3xl">✕</span>
            </button>
          </div>

          <div className="space-y-8">
            
            {/* Rule Name */}
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
              <label className="block text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
                Identifier Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Perimeter Intrusion"
                className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Severity Tier</label>
              <div className="grid grid-cols-3 gap-4">
                {(['info', 'warning', 'critical'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-3 rounded-lg font-bold transition-all border-2 ${
                      priority === p 
                        ? p === 'info' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 
                          p === 'warning' ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400' : 
                          'bg-red-600/20 border-red-500 text-red-400'
                        : 'bg-slate-950 border-slate-800 text-gray-500 hover:border-slate-600'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Detect Objects */}
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">
                Target Classes ({objectClasses.length} active)
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {OBJECT_CLASSES.map(obj => (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => toggleObject(obj)}
                      className={`px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                        objectClasses.includes(obj) 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-900 text-gray-500 hover:text-gray-300 border border-slate-800'
                      }`}
                    >
                      {obj}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Minimum Confidence */}
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
              <div className="flex justify-between mb-4">
                <label className="text-gray-400 text-xs font-bold uppercase tracking-widest">Model Sensitivity</label>
                <span className="text-blue-400 font-mono">{(minConfidence * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Alert Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Checkbox label="🔔 Push Notification" checked={notificationEnabled} onChange={setNotificationEnabled} />
              <Checkbox label="🔊 Audible Alarm" checked={audioEnabled} onChange={setAudioEnabled} />
              <Checkbox label="💬 Discord Webhook" checked={discordEnabled} onChange={setDiscordEnabled} />
              <Checkbox label="📸 Save Event Snapshot" checked={saveSnapshot} onChange={setSaveSnapshot} />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-12 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Synchronizing...' : rule ? 'Update Rule' : 'Deploy Rule'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Checkbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-4 rounded-xl cursor-pointer hover:border-slate-600 transition-all">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-5 h-5 rounded accent-blue-500"
    />
    <span className="text-sm font-semibold text-gray-300">{label}</span>
  </label>
);

export default RuleBuilder;