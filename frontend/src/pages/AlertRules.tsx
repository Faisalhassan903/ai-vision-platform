import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../components/ui';
import RuleBuilder from '../components/RuleBuilder';
// 1. IMPORT MAIN_BACKEND_URL INSTEAD OF API_BASE_URL
import { MAIN_BACKEND_URL } from '../config'; 

interface AlertRule {
  _id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'info' | 'warning' | 'critical';
  conditions: {
    objectClasses: string[];
    minConfidence: number;
  };
  triggerCount: number;
}

function AlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      // 2. UPDATED TO USE MAIN_BACKEND_URL
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/alerts/rules`);
      // Added safety check for response data structure
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // 3. UPDATED TO USE MAIN_BACKEND_URL
      await axios.put(`${MAIN_BACKEND_URL}/api/alerts/rules/${ruleId}`, { enabled });
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      // 4. UPDATED TO USE MAIN_BACKEND_URL
      await axios.delete(`${MAIN_BACKEND_URL}/api/alerts/rules/${ruleId}`);
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500';
      case 'warning': return 'border-yellow-500';
      case 'info': return 'border-blue-500';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">⚙️ Alert Rules</h1>
            <p className="text-gray-400">Manage logic for automated threat detection</p>
          </div>
          
          <Button 
            onClick={() => {
              setEditingRule(null);
              setShowBuilder(true);
            }}
            variant="primary"
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            ➕ Create Rule
          </Button>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <Card 
              key={rule._id} 
              className={`bg-slate-900 border-l-4 border-slate-800 ${getPriorityColor(rule.priority)} ${!rule.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{rule.name}</h3>
                  <p className="text-sm text-gray-400">{rule.description}</p>
                </div>
                
                <Badge className={
                  rule.priority === 'critical' ? 'bg-red-900 text-red-100' : 
                  rule.priority === 'warning' ? 'bg-yellow-900 text-yellow-100' : 
                  'bg-blue-900 text-blue-100'
                }>
                  {rule.priority.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-3 mb-6 bg-slate-950 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Target Objects:</span>
                  <div className="flex flex-wrap gap-1">
                    {rule.conditions.objectClasses.map((obj, idx) => (
                      <Badge key={idx} className="bg-slate-800 text-gray-300">{obj}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sensitivity:</span>
                  <span className="text-white">{(rule.conditions.minConfidence * 100).toFixed(0)}% Confidence</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">History:</span>
                  <span className="text-emerald-400 font-mono">{rule.triggerCount} Triggers Recorded</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => toggleRule(rule._id, !rule.enabled)}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  {rule.enabled ? 'Pause Rule' : 'Resume Rule'}
                </Button>

                <Button 
                  onClick={() => {
                    setEditingRule(rule);
                    setShowBuilder(true);
                  }}
                  variant="secondary"
                  size="sm"
                >
                  ✏️ Edit
                </Button>

                <Button 
                  onClick={() => deleteRule(rule._id)}
                  variant="danger"
                  size="sm"
                  className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white"
                >
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {rules.length === 0 && (
          <Card className="text-center py-20 bg-slate-900 border-dashed border-slate-700">
            <div className="text-6xl mb-4 opacity-20">🛡️</div>
            <h3 className="text-xl font-bold text-white mb-2">No active security rules</h3>
            <p className="text-gray-500 mb-8">Define rules to automatically flag specific objects detected by the AI.</p>
            <Button 
              onClick={() => {
                setEditingRule(null);
                setShowBuilder(true);
              }}
              variant="primary"
            >
              ➕ Setup First Rule
            </Button>
          </Card>
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