import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../components/ui';
import RuleBuilder from '../components/RuleBuilder';
import { MAIN_BACKEND_URL } from '../config';

function AlertRules() {
  const [rules, setRules]           = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/rules`);
      // GET /api/rules returns a plain array
      setRules(Array.isArray(response.data) ? response.data : response.data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await axios.delete(`${MAIN_BACKEND_URL}/api/rules/${ruleId}`);
      fetchRules();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await axios.patch(`${MAIN_BACKEND_URL}/api/rules/${ruleId}`, { enabled });
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'critical') return 'bg-red-600';
    if (priority === 'warning')  return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">⚙️ Alert Rules</h1>
            <p className="text-slate-400 text-sm mt-1">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Button onClick={() => { setEditingRule(null); setShowBuilder(true); }} variant="primary">
            ➕ Create Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-lg">No rules yet — create one to start detecting</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rules.map((rule: any) => (
              <Card key={rule._id} className="bg-slate-900 border-slate-800 p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{rule.name}</h3>
                    <p className="text-slate-400 text-sm mt-1">{rule.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${getPriorityColor(rule.priority)}`}>
                      {rule.priority}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                      {rule.enabled ? '● Active' : '○ Disabled'}
                    </span>
                  </div>
                </div>

                {/* Objects being watched */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1">WATCHING</p>
                  <div className="flex flex-wrap gap-1">
                    {rule.conditions?.objectClasses?.map((cls: string) => (
                      <span key={cls} className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-200">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs text-slate-500 mb-4">
                  <span>Confidence: {Math.round((rule.conditions?.minConfidence || 0.5) * 100)}%</span>
                  <span>Cooldown: {rule.cooldownMinutes}m</span>
                  <span>Triggered: {rule.triggerCount || 0}×</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => toggleRule(rule._id, !rule.enabled)}
                    variant={rule.enabled ? 'secondary' : 'primary'}
                    size="sm"
                  >
                    {rule.enabled ? '⏸ Disable' : '▶ Enable'}
                  </Button>
                  <Button
                    onClick={() => { setEditingRule(rule); setShowBuilder(true); }}
                    variant="secondary"
                    size="sm"
                  >
                    ✏️ Edit
                  </Button>
                  <Button onClick={() => deleteRule(rule._id)} variant="danger" size="sm">
                    🗑️ Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showBuilder && (
          <RuleBuilder
            rule={editingRule}
            onClose={() => {
              setShowBuilder(false);
              setEditingRule(null);
              fetchRules();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AlertRules;