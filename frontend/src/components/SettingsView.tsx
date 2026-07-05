import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

import api from '../services/api';
import { Banner } from './SharedComponents';

interface GymSettings {
  gym_name: string;
  owner_name: string;
  phone: string;
  access_policy: string;
}

interface Member {
  id: number;
  name: string;
  phone: string;
  card_id: string | null;
  biometric_template_id: string | null;
  status: string;
}

export const SettingsView: React.FC = () => {
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [policy, setPolicy] = useState('fail_open');

  // Change PIN Fields
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // AI Configuration Fields
  const [aiProvider, setAiProvider] = useState('groq');
  const [groqKey, setGroqKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  // Simulator Fields
  const [simMembers, setSimMembers] = useState<Member[]>([]);
  const [simMemberId, setSimMemberId] = useState<string>('');
  const [simUnknownId, setSimUnknownId] = useState<string>('');

  // UI States
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'ai' | 'system'>('profile');
  const [showAiConfigForm, setShowAiConfigForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await api.get<GymSettings>('/settings');
      if (res) {
        setGymName(res.gym_name);
        setOwnerName(res.owner_name);
        setPhone(res.phone);
        setPolicy(res.access_policy);
      }
      
      const members = await api.get<Member[]>('/members');
      setSimMembers(members);
      
      // Load AI Configs
      const aiConfig = await api.get<any>('/ai/config');
      if (aiConfig) {
        setAiProvider(aiConfig.provider);
        setGroqKey(aiConfig.api_key || '');
        setOpenaiKey(aiConfig.openai_key || '');
        setAnthropicKey(aiConfig.anthropic_key || '');
        setOllamaUrl(aiConfig.ollama_url || 'http://localhost:11434');

        const hasKeys = !!(aiConfig.api_key || aiConfig.openai_key || aiConfig.ollama_url);
        setShowAiConfigForm(hasKeys);
      }

      setError('');
    } catch (err: any) {
      setError('Failed to fetch settings details.');
    }
  };

  useEffect(() => {
    fetchSettings().then(() => setLoading(false));
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.post('/settings', {
        gym_name: gymName,
        owner_name: ownerName,
        phone,
        access_policy: policy
      });
      setSuccess('Settings updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError('Failed to save settings.');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setError('New PIN must be a numeric value of 4 to 6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Confirm PIN does not match New PIN.');
      return;
    }

    try {
      await api.post('/auth/login', { pin: oldPin });
      await api.post('/auth/change-pin', { pin: newPin });
      setSuccess('Admin PIN changed successfully!');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.detail || 'PIN verification failed. Make sure your current PIN is correct.');
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.post('/ai/config', {
        provider: aiProvider,
        api_key: groqKey,
        openai_key: openaiKey,
        anthropic_key: anthropicKey,
        ollama_url: ollamaUrl
      });
      setSuccess('AI Copilot configurations updated!');
      setShowAiConfigForm(true);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Failed to save AI keys.');
    }
  };

  const handleSimulateScan = async (method: 'card' | 'biometric') => {
    setSuccess('');
    setError('');
    const member = simMembers.find(m => m.id === Number(simMemberId));
    if (!member) return;

    try {
      const payload: any = { method };
      if (method === 'card') {
        if (!member.card_id) {
          setError(`Selected member does not have an RFID Card assigned. Add one in Members tab first.`);
          return;
        }
        payload.card_id = member.card_id;
      } else {
        if (!member.biometric_template_id) {
          setError(`Selected member does not have a fingerprint template enrolled. Enroll one in Members tab first.`);
          return;
        }
        payload.biometric_template_id = member.biometric_template_id;
      }

      const res = await api.post<any>('/attendance/scan', payload);
      if (res.access_granted) {
        setSuccess(`Simulated scan: Access GRANTED to ${res.member_name} (${res.reason}).`);
      } else {
        setError(`Simulated scan: Access DENIED to ${res.member_name} (${res.reason}).`);
      }
    } catch (err: any) {
      setError('Simulation trigger failed.');
    }
  };

  const handleSimulateUnknown = async () => {
    setSuccess('');
    setError('');
    try {
      const res = await api.post<any>('/attendance/scan', {
        card_id: simUnknownId,
        method: 'card'
      });
      if (res.access_granted) {
        setSuccess(`Simulated scan: Access GRANTED to Guest (Fail-Open Policy).`);
      } else {
        setError(`Simulated scan: Access DENIED (${res.reason}).`);
      }
      setSimUnknownId('');
    } catch (err: any) {
      setError('Simulation trigger failed.');
    }
  };

  const triggerExport = (format: 'json' | 'csv') => {
    setSuccess('');
    setError('');
    
    api.get<any[]>('/members')
      .then((members) => {
        const dataStr = format === 'json' 
          ? JSON.stringify(members, null, 2)
          : 'id,name,phone,email,expiry_date,status\n' + members.map(m => `${m.id},"${m.name}",${m.phone},${m.email || ''},${m.expiry_date},${m.status}`).join('\n');
          
        const dataUri = 'data:application/' + format + ';charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'gym_members_export_' + new Date().toISOString().split('T')[0] + '.' + format;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        setSuccess(`Member database exported successfully as ${format.toUpperCase()}!`);
      })
      .catch(() => {
        setError('Database export failed.');
      });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Settings Panel...</p>
      </div>
    );
  }

  // --- SUB-CARDS RENDERERS ---

  const renderProfileCard = () => (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Gym Profile Settings</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manage facility credentials and access policies</span>
        </div>
        <button onClick={handleUpdateProfile} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          Save Changes
        </button>
      </div>

      <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Gym Facility Name</label>
            <input
              type="text"
              className="form-control"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Manager / Owner Name</label>
            <input
              type="text"
              className="form-control"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Contact Phone Number</label>
          <input
            type="tel"
            className="form-control"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ borderTop: 'var(--border-glass)', paddingTop: '1.25rem' }}>
          <label className="form-label">Hardware Access Policy</label>
          <select
            className="form-control"
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          >
            <option value="fail_open">Fail-Open (Recommended - defaults unlocked on system crash)</option>
            <option value="fail_closed">Fail-Closed (Stricter security - locks gate on crash)</option>
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3', marginTop: '0.25rem' }}>
            {policy === 'fail_open' 
              ? 'Fail-Open defaults to unlocked to prevent members from being locked out in case the local database backend or reader goes offline.'
              : 'Fail-Closed guarantees strict security, but leaves no way for members to enter or exit automatically if the local computer shuts down.'}
          </p>
        </div>
      </form>
    </div>
  );

  const renderSecurityCard = () => (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Update Security PIN</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Change the four-digit manager passcode forLockScreen unlock</span>
        </div>
        <button onClick={handleChangePin} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          Update PIN
        </button>
      </div>

      <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Current Admin PIN</label>
          <input
            type="password"
            maxLength={6}
            className="form-control"
            placeholder="Verify old PIN"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">New Admin PIN</label>
          <input
            type="password"
            maxLength={6}
            className="form-control"
            placeholder="Choose new PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Confirm New PIN</label>
          <input
            type="password"
            maxLength={6}
            className="form-control"
            placeholder="Retype new PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>
      </form>
    </div>
  );

  const renderAiCard = () => (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>AI Assistant Settings</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Configure API secret credentials to power the natural language Copilot</span>
        </div>
        {showAiConfigForm && (
          <button onClick={handleSaveAiConfig} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
            Save Configuration
          </button>
        )}
      </div>

      {!showAiConfigForm ? (
        /* Empty State with Banner and Button */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Banner
            message="No active AI provider configured. Natural language voice queries are disabled."
            type="warning"
            dismissible={false}
            actionButton={
              <button onClick={() => setShowAiConfigForm(true)} className="btn btn-flat" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                Set up now
              </button>
            }
          />
        </div>
      ) : (
        /* AI Provider form options */
        <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Active Model Provider</label>
            <select
              className="form-control"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="groq">Groq (Llama-3 70B - Ultra fast)</option>
              <option value="openai">OpenAI (GPT-4o Mini)</option>
              <option value="custom">Ollama (Local Llama-3 model)</option>
            </select>
          </div>

          {aiProvider === 'groq' && (
            <div className="form-group">
              <label className="form-label">Groq API Key</label>
              <input
                type="password"
                className="form-control"
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
              />
            </div>
          )}

          {aiProvider === 'openai' && (
            <div className="form-group">
              <label className="form-label">OpenAI API Key</label>
              <input
                type="password"
                className="form-control"
                placeholder="sk-proj-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>
          )}

          {aiProvider === 'custom' && (
            <div className="form-group">
              <label className="form-label">Local Ollama Base URL</label>
              <input
                type="text"
                className="form-control"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
              />
            </div>
          )}

          {/* Masked Key Display List */}
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>Active Configured Keys</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.01)', border: 'var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiProvider === 'groq' ? 'var(--accent-success)' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: '500' }}>Groq Cloud Credentials</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {groqKey ? groqKey : 'Not Set'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.01)', border: 'var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiProvider === 'openai' ? 'var(--accent-success)' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: '500' }}>OpenAI Developer Credentials</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {openaiKey ? openaiKey : 'Not Set'}
                </span>
              </div>

            </div>
          </div>
        </form>
      )}
    </div>
  );

  const renderSystemCard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Backups panel */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Local Database Management</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
          BarbellOS stores records locally on this terminal. Run manual JSON or CSV spreadsheet exports here.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={() => triggerExport('json')} className="btn btn-flat" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
            <Download size={12} style={{ marginRight: '4px' }} />
            Export Members (JSON)
          </button>
          <button onClick={() => triggerExport('csv')} className="btn btn-flat" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
            <Download size={12} style={{ marginRight: '4px' }} />
            Export Members (CSV)
          </button>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '4px', border: 'var(--border-glass)' }}>
          💡 <strong>Rolling Database Auto-Backups</strong>: Copies are generated automatically every 7 days inside your AppData directory. The last 30 snapshots are preserved.
        </div>
      </div>

      {/* Simulator Panel */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Scanner Diagnostic Tools</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
          Manually fire simulator scans to test scanner connections, access rules, and fail-open policies.
        </p>

        <div className="form-group">
          <label className="form-label">Select Active Member Profile</label>
          <select
            className="form-control"
            value={simMemberId}
            onChange={(e) => setSimMemberId(e.target.value)}
          >
            <option value="">-- Choose Member --</option>
            {simMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} (Status: {m.status.toUpperCase()})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button onClick={() => handleSimulateScan('card')} className="btn btn-flat" disabled={!simMemberId} style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}>
            RFID Card Scan
          </button>
          <button onClick={() => handleSimulateScan('biometric')} className="btn btn-flat" disabled={!simMemberId} style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}>
            Fingerprint Biometric Scan
          </button>
        </div>

        <div className="form-group" style={{ borderTop: 'var(--border-glass)', paddingTop: '1.25rem' }}>
          <label className="form-label">Trigger Guest / Unknown RFID Scan</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter card hash ID"
              value={simUnknownId}
              onChange={(e) => setSimUnknownId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={handleSimulateUnknown} className="btn btn-danger" disabled={!simUnknownId} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
              Simulate Scan
            </button>
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <div style={{ padding: '2rem', display: 'flex', gap: '2rem', height: '100%', overflow: 'hidden' }}>
      
      {/* Nested Left Sidebar menu */}
      <div style={{
        width: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        paddingRight: '1rem',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
          Settings
        </span>
        <button
          onClick={() => setActiveSection('profile')}
          className="btn btn-flat"
          style={{
            justifyContent: 'flex-start',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            background: activeSection === 'profile' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            color: activeSection === 'profile' ? '#fff' : 'var(--text-secondary)',
            borderLeft: activeSection === 'profile' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          Gym Profile
        </button>
        <button
          onClick={() => setActiveSection('security')}
          className="btn btn-flat"
          style={{
            justifyContent: 'flex-start',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            background: activeSection === 'security' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            color: activeSection === 'security' ? '#fff' : 'var(--text-secondary)',
            borderLeft: activeSection === 'security' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          Security PIN
        </button>
        <button
          onClick={() => setActiveSection('ai')}
          className="btn btn-flat"
          style={{
            justifyContent: 'flex-start',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            background: activeSection === 'ai' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            color: activeSection === 'ai' ? '#fff' : 'var(--text-secondary)',
            borderLeft: activeSection === 'ai' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          AI Assistant
        </button>
        <button
          onClick={() => setActiveSection('system')}
          className="btn btn-flat"
          style={{
            justifyContent: 'flex-start',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            background: activeSection === 'system' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            color: activeSection === 'system' ? '#fff' : 'var(--text-secondary)',
            borderLeft: activeSection === 'system' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          System Controls
        </button>
      </div>

      {/* Right Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
        {error && <Banner message={error} type="error" onDismiss={() => setError('')} />}
        {success && <Banner message={success} type="info" onDismiss={() => setSuccess('')} />}
        
        {activeSection === 'profile' && renderProfileCard()}
        {activeSection === 'security' && renderSecurityCard()}
        {activeSection === 'ai' && renderAiCard()}
        {activeSection === 'system' && renderSystemCard()}
      </div>

    </div>
  );
};
export default SettingsView;
