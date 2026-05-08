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

  return (
    <div className="min-h-screen bg-dark-bg p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Alert Rules</h1>
              <p className="text-sm text-white/40">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
            </div>
          </div>
          <Button onClick={() => { setEditingRule(null); setShowBuilder(true); }} variant="primary" size="md" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          }>
            Create Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <Card className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <p className="text-white/50 text-sm font-medium">No rules configured</p>
            <p className="text-white/25 text-xs mt-1">Create a rule to start automated detection alerts</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule: any) => (
              <div key={rule._id} className={`
                rounded-xl border p-5 transition-all duration-200 hover:shadow-card
                ${rule.enabled 
                  ? 'bg-dark-card/80 border-dark-border hover:border-dark-border-hover' 
                  : 'bg-dark-card/40 border-dark-border/50 opacity-70'}
              `}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white truncate">{rule.name}</h3>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <Badge 
                      variant={rule.priority === 'critical' ? 'error' : rule.priority === 'warning' ? 'warning' : 'info'} 
                      size="sm"
                      dot
                    >
                      {rule.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Watching */}
                <div className="mb-4">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Watching</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.conditions?.objectClasses?.map((cls: string) => (
                      <span key={cls} className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-white/70 font-medium">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex gap-4 mb-4 p-3 rounded-lg bg-surface/30 border border-dark-border/50">
                  <div className="flex-1">
                    <p className="text-[10px] text-white/25 uppercase mb-0.5">Confidence</p>
                    <p className="text-xs text-white/70 font-medium">{Math.round((rule.conditions?.minConfidence || 0.5) * 100)}%</p>
                  </div>
                  <div className="flex-1 border-l border-dark-border/50 pl-4">
                    <p className="text-[10px] text-white/25 uppercase mb-0.5">Cooldown</p>
                    <p className="text-xs text-white/70 font-medium">{rule.cooldownMinutes}m</p>
                  </div>
                  <div className="flex-1 border-l border-dark-border/50 pl-4">
                    <p className="text-[10px] text-white/25 uppercase mb-0.5">Triggered</p>
                    <p className="text-xs text-white/70 font-medium">{rule.triggerCount || 0}x</p>
                  </div>
                  <div className="flex-1 border-l border-dark-border/50 pl-4">
                    <p className="text-[10px] text-white/25 uppercase mb-0.5">Status</p>
                    <p className={`text-xs font-medium ${rule.enabled ? 'text-emerald-400' : 'text-white/30'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => toggleRule(rule._id, !rule.enabled)}
                    variant={rule.enabled ? 'ghost' : 'primary'}
                    size="sm"
                    icon={rule.enabled ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    )}
                  >
                    {rule.enabled ? 'Pause' : 'Enable'}
                  </Button>
                  <Button
                    onClick={() => { setEditingRule(rule); setShowBuilder(true); }}
                    variant="ghost"
                    size="sm"
                    icon={
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    }
                  >
                    Edit
                  </Button>
                  <Button onClick={() => deleteRule(rule._id)} variant="danger" size="sm" icon={
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  }>
                    Delete
                  </Button>
                </div>
              </div>
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
