import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface LockScreenProps {
  onUnlock: (adminName: string, token: string) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [gymName, setGymName] = useState('Iron Temple Gym');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Gym Name
    api.get<{ gym_name: string }>('/settings')
      .then((settings) => {
        if (settings) {
          setGymName(settings.gym_name);
        }
      })
      .catch(() => {
        // Fallback to default name if settings fetch fails
      });
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleLogin = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post<{ status: string; name: string; token: string }>('/auth/login', { pin });
      if (response.status === 'unlocked') {
        onUnlock(response.name, response.token);
      }
    } catch (err: any) {
      setPin('');
      setError(err.detail || err.message || 'Incorrect PIN entered.');
    } finally {
      setLoading(false);
    }
  };


  // Trigger login automatically if PIN reaches 6 digits
  useEffect(() => {
    if (pin.length === 6) {
      handleLogin();
    }
  }, [pin]);

  return (
    <div className="modal-overlay" style={{ background: '#070A12' }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '380px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--accent-primary)',
            boxShadow: 'var(--glow-primary)'
          }}>
            {/* Padlock Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '0.25rem' }}>{gymName}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Front-Desk Access Terminal</p>
        </div>

        {/* PIN Display */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: error ? '1px solid rgba(239, 68, 68, 0.4)' : 'var(--border-glass)',
            borderRadius: 'var(--radius-sm)',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            letterSpacing: '0.75rem',
            color: '#fff',
            fontFamily: 'monospace'
          }}>
            {/* Show bullets or dashes */}
            {'•'.repeat(pin.length) + '-'.repeat(Math.max(0, 4 - pin.length))}
          </div>
          {error && (
            <p style={{
              color: 'var(--accent-danger)',
              fontSize: '0.75rem',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Numpad Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="btn btn-flat"
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                padding: '0.9rem',
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                margin: '0 auto'
              }}
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="btn btn-flat"
            style={{
              fontSize: '0.8rem',
              fontWeight: '600',
              padding: '0.9rem',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              margin: '0 auto',
              color: 'var(--text-muted)'
            }}
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="btn btn-flat"
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              padding: '0.9rem',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              margin: '0 auto'
            }}
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="btn btn-flat"
            style={{
              fontSize: '1rem',
              padding: '0.9rem',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              margin: '0 auto',
              color: 'var(--text-muted)'
            }}
          >
            {/* Backspace SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
              <line x1="18" y1="9" x2="12" y2="15"></line>
              <line x1="12" y1="9" x2="18" y2="15"></line>
            </svg>
          </button>
        </div>

        <button
          onClick={handleLogin}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem' }}
          disabled={loading || pin.length < 4}
        >
          {loading ? 'Verifying PIN...' : 'Verify & Unlock'}
        </button>
      </div>
    </div>
  );
};
