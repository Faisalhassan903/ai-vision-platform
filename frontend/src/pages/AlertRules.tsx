import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../components/ui';
import RuleBuilder from '../components/RuleBuilder';
// Ensure this is MAIN_BACKEND_URL
import { MAIN_BACKEND_URL } from '../config'; 

function AlertRules() {
  const [rules, setRules] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      // Must hit the MAIN backend for database items
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/alerts/rules`);
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await axios.delete(`${MAIN_BACKEND_URL}/api/alerts/rules/${ruleId}`);
      fetchRules();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">⚙️ Alert Rules</h1>
          <Button onClick={() => setShowBuilder(true)} variant="primary">➕ Create Rule</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule: any) => (
            <Card key={rule._id} className="bg-slate-900 border-slate-800">
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-bold">{rule.name}</h3>
                <Badge>{rule.priority}</Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => deleteRule(rule._id)} variant="danger" size="sm">🗑️ Delete</Button>
              </div>
            </Card>
          ))}
        </div>

        {showBuilder && (
          <RuleBuilder
            rule={editingRule}
            onClose={() => {
              setShowBuilder(false);
              fetchRules();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AlertRules;