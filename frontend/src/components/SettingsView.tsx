import React, { useState, useEffect } from 'react';
import { Settings, Lock, Download, Database, Check, Cpu } from 'lucide-react';
import api from '../services/api';

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
    } catch (err) {
      setError('Failed to save AI keys.');
    }
  };

  // Simulate Member Scan
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

  // Simulate Unknown scan
  const handleSimulateUnknown = async () => {
    setSuccess('');
    setError('');
    try {
      const res = await api.post<any>('/attendance/scan', {
        card_id: simUnknownId,
        method: 'card'
      });
      setError(`Simulated unknown scan: Access DENIED (${res.reason}).`);
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

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', height: '100%' }}>
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem',
          color: 'var(--accent-danger)',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem',
          color: 'var(--accent-success)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Check size={16} />
          {success}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left Side: Gym Profile & Policies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Gym Settings Card */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
              Gym profile settings
            </h3>
            
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

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.5rem' }}>
                Save Profile Configuration
              </button>
            </form>
          </div>

          {/* Backup & Export Section */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--accent-success)' }} />
              Local Database Management
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.5rem' }}>
              Since this is a local offline application, your database sits inside a local SQLite file. Use these tools to back up and export data.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                onClick={() => triggerExport('json')}
                className="btn btn-flat"
                style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem' }}
              >
                <Download size={14} />
                Export Members (JSON)
              </button>
              
              <button
                onClick={() => triggerExport('csv')}
                className="btn btn-flat"
                style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem' }}
              >
                <Download size={14} />
                Export Members (CSV)
              </button>
            </div>

            <div style={{
              marginTop: '1.5rem',
              padding: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.01)',
              border: 'var(--border-glass)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              💡 <strong>Automatic Backups Enabled</strong>: The backend creates rolling database copies every 7 days, retaining the last 30 snapshots inside your local App Data folder.
            </div>
          </div>
        </div>

        {/* Right Side: Change PIN, AI Copilot settings, & Hardware Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Change PIN Panel */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} style={{ color: 'var(--accent-warning)' }} />
              Update Admin PIN code
            </h3>

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

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Verify & Update PIN
              </button>
            </form>
          </div>

          {/* AI COPILOT CONFIG */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
              AI Copilot configurations
            </h3>
            
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
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
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

              {aiProvider === 'anthropic' && (
                <div className="form-group">
                  <label className="form-label">Anthropic API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
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

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Save AI Configuration
              </button>
            </form>
          </div>

          {/* HARDWARE SIMULATOR */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
              Hardware scanner simulator
            </h3>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
              Simulate physical credential scans. Valid checks will instantly register and unlock the gate via WebSocket.
            </p>

            <div className="form-group">
              <label className="form-label">Select Registered Member</label>
              <select
                className="form-control"
                value={simMemberId}
                onChange={(e) => setSimMemberId(e.target.value)}
              >
                <option value="">-- Choose Member to Scan --</option>
                {simMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} (Status: {m.status.toUpperCase()})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                onClick={() => handleSimulateScan('card')}
                className="btn btn-flat"
                disabled={!simMemberId}
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}
              >
                Scan RFID Card
              </button>
              <button
                onClick={() => handleSimulateScan('biometric')}
                className="btn btn-flat"
                disabled={!simMemberId}
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}
              >
                Scan Fingerprint
              </button>
            </div>

            <div className="form-group" style={{ borderTop: 'var(--border-glass)', paddingTop: '1.25rem' }}>
              <label className="form-label">Simulate Unknown / Guest Scan</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Card or fingerprint ID"
                  value={simUnknownId}
                  onChange={(e) => setSimUnknownId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleSimulateUnknown}
                  className="btn btn-danger"
                  disabled={!simUnknownId}
                  style={{ fontSize: '0.8rem', padding: '0.6rem' }}
                >
                  Scan Guest
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
export default SettingsView;
