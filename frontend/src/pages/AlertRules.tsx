import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../components/ui';
import RuleBuilder from '../components/RuleBuilder';

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
      const response = await axios.get('http://localhost:5000/api/alerts/rules');
      setRules(response.data.rules);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await axios.put(`http://localhost:5000/api/alerts/rules/${ruleId}`, { enabled });
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/alerts/rules/${ruleId}`);
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
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              ⚙️ Alert Rules
            </h1>
            <p className="text-gray-400">Configure when and how to receive alerts</p>
          </div>
          
          <Button 
            onClick={() => {
              setEditingRule(null);
              setShowBuilder(true);
            }}
            variant="primary"
            size="lg"
          >
            ➕ Create Rule
          </Button>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <Card 
              key={rule._id} 
              className={`border-l-4 ${getPriorityColor(rule.priority)} ${!rule.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{rule.name}</h3>
                  <p className="text-sm text-gray-400">{rule.description}</p>
                </div>
                
                <Badge variant={rule.priority === 'critical' ? 'error' : rule.priority === 'warning' ? 'warning' : 'info'}>
                  {rule.priority}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Objects:</span>
                  <div className="flex flex-wrap gap-1">
                    {rule.conditions.objectClasses.map((obj, idx) => (
                      <Badge key={idx} variant="info">{obj}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Min Confidence:</span>
                  <span className="text-white">{(rule.conditions.minConfidence * 100).toFixed(0)}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Triggered:</span>
                  <span className="text-white">{rule.triggerCount} times</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => toggleRule(rule._id, !rule.enabled)}
                  variant={rule.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  className="flex-1"
                >
                  {rule.enabled ? '⏸️ Disable' : '▶️ Enable'}
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
                >
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {rules.length === 0 && (
          <Card className="text-center py-12">
            <div className="text-6xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold text-white mb-2">No Alert Rules Yet</h3>
            <p className="text-gray-400 mb-6">Create your first rule to start receiving alerts</p>
            <Button 
              onClick={() => {
                setEditingRule(null);
                setShowBuilder(true);
              }}
              variant="primary"
            >
              ➕ Create First Rule
            </Button>
          </Card>
        )}

        {/* Rule Builder Modal */}
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