import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

interface EnvironmentEditorProps {
  environmentId: string;
  onClose: () => void;
}

interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export default function EnvironmentEditor({ environmentId, onClose }: EnvironmentEditorProps) {
  const [envName, setEnvName] = useState('');
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadEnvironment();
  }, [environmentId]);

  const loadEnvironment = useCallback(async () => {
    try {
      const data = await api.fetchEnvironment(environmentId);
      setEnvName(data.name);
      setVariables(
        data.environment.values.map((v: any) => ({
          key: v.key,
          value: v.value,
          enabled: v.enabled !== false,
        }))
      );
      setDirty(false);
    } catch (err) {
      console.error('Failed to load environment:', err);
    }
  }, [environmentId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateEnvironmentVariables(environmentId, variables);
      setDirty(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [environmentId, variables]);

  const updateVariable = (index: number, field: keyof EnvVariable, value: any) => {
    setVariables(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const addVariable = () => {
    setVariables(prev => [...prev, { key: '', value: '', enabled: true }]);
    setDirty(true);
  };

  const removeVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🌍</span>
          <strong>{envName}</strong>
          <span className="text-muted text-sm">— Environment Variables</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary btn-sm" onClick={addVariable}>
            + Add Variable
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Variable grid header */}
      <div className="env-row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Key</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Value</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>On</span>
        <span></span>
      </div>

      {/* Variables */}
      <div className="env-editor">
        {variables.map((v, i) => (
          <div key={i} className="env-row" style={{ padding: '0 16px' }}>
            <input
              type="text"
              value={v.key}
              onChange={e => updateVariable(i, 'key', e.target.value)}
              placeholder="Variable name"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="text"
              value={v.value}
              onChange={e => updateVariable(i, 'value', e.target.value)}
              placeholder="Value"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="checkbox"
              checked={v.enabled}
              onChange={e => updateVariable(i, 'enabled', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <button
              className="btn-icon btn-sm"
              onClick={() => removeVariable(i)}
              title="Remove variable"
            >
              ✕
            </button>
          </div>
        ))}

        {variables.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: 16 }}>
            No variables. Click "+ Add Variable" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
