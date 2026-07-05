import React, { useState } from 'react';
import api from '../services/api';

interface OnboardingProps {
  onSuccess: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onSuccess }) => {
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [policy, setPolicy] = useState('fail_open');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('You must acknowledge the DPDP Act consent policy to proceed.');
      return;
    }
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be a numeric value of 4 to 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Setup Admin Account
      const response = await api.post<{ token?: string }>('/auth/setup', { name: ownerName, pin });
      if (response && response.token) {
        api.setToken(response.token);
      }

      
      // 2. Setup Gym Settings
      await api.post('/settings', {
        gym_name: gymName,
        owner_name: ownerName,
        phone,
        access_policy: policy
      });

      onSuccess();
    } catch (err: any) {
      setError(err.detail || err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: '550px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.25rem' }}>Gym Setup Wizard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Initialize your offline gym parameters and owner credentials.
          </p>
        </div>

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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Gym Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Iron Temple Gym"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Rahul Sharma"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Owner Phone</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g., 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin Entry PIN (4-6 digits)</label>
              <input
                type="password"
                maxLength={6}
                className="form-control"
                placeholder="Numeric PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Default Access Control Failure Policy</label>
            <select
              className="form-control"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <option value="fail_open">Fail-Open (Recommended - Door unlocks if server is offline)</option>
              <option value="fail_closed">Fail-Closed (Stricter security - Door remains locked)</option>
            </select>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: 'var(--border-glass)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            fontSize: '0.8rem',
            lineHeight: '1.4',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              DPDP Act Compliance (Sensitive Personal Data)
            </p>
            <p>
              Under India's Digital Personal Data Protection (DPDP) Act, biometric templates (fingerprint maps) constitute sensitive personal data. Gym owner must secure explicit consent from members before recording/processing biometric credentials. Raw fingerprint images must never be stored.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                I acknowledge that I am responsible as the Data Controller, and will obtain signed consent from all members before registering biometric templates.
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Initializing System...' : 'Initialize & Unlock Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
