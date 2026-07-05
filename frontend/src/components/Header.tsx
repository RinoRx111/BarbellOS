import React, { useState } from 'react';
import { Radio, Sparkles, Unlock, Lock, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  title: string;
  readerConnected: boolean;
  doorUnlocked: boolean;
  onManualOverride: () => Promise<void>;
  isAiOpen: boolean;
  onToggleAi: () => void;
  adminName: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  readerConnected,
  doorUnlocked,
  onManualOverride,
  isAiOpen,
  onToggleAi,
  adminName,
  theme,
  onToggleTheme
}) => {
  const [overrideLoading, setOverrideLoading] = useState(false);


  const handleOverrideClick = async () => {
    setOverrideLoading(true);
    try {
      await onManualOverride();
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <header className="glass-panel" style={{
      height: '70px',
      borderRadius: '0',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      borderBottom: 'var(--border-glass)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      background: 'var(--surface-dark)'
    }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {title}
        </h2>
      </div>

      {/* Connectivity & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        
        {/* Theme Switcher Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn btn-flat"
          style={{
            padding: '0.45rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            borderColor: 'var(--border-color)'
          }}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <Sun size={14} style={{ color: 'var(--accent-primary)' }} />
          ) : (
            <Moon size={14} style={{ color: 'var(--accent-primary)' }} />
          )}
        </button>

        {/* Biometric Reader Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '0.4rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          border: 'var(--border-glass)',
          fontSize: '0.8rem'
        }}>
          <Radio size={14} style={{ color: readerConnected ? 'var(--accent-success)' : 'var(--accent-danger)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Reader:</span>
          {readerConnected ? (
            <span style={{ color: 'var(--accent-success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="status-dot status-online" style={{ width: '6px', height: '6px' }}></span>
              ONLINE
            </span>
          ) : (
            <span style={{ color: 'var(--accent-danger)', fontWeight: '600' }}>OFFLINE</span>
          )}
        </div>

        {/* Physical Lock Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '0.4rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          border: 'var(--border-glass)',
          fontSize: '0.8rem'
        }}>
          {doorUnlocked ? (
            <Unlock size={14} style={{ color: 'var(--accent-success)' }} />
          ) : (
            <Lock size={14} style={{ color: 'var(--text-muted)' }} />
          )}
          <span style={{ color: 'var(--text-secondary)' }}>Gate:</span>
          {doorUnlocked ? (
            <span style={{ color: 'var(--accent-success)', fontWeight: '600' }}>UNLOCKED</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>SECURED</span>
          )}
        </div>

        {/* Manual Gate Override Button */}
        <button
          onClick={handleOverrideClick}
          className="btn btn-success"
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.8rem',
            background: doorUnlocked ? 'var(--accent-success-hover)' : 'var(--accent-success)',
            boxShadow: doorUnlocked ? 'var(--glow-success)' : 'none'
          }}
          disabled={overrideLoading || doorUnlocked}
        >
          {overrideLoading ? 'Opening...' : doorUnlocked ? 'Door Open' : 'Manual Override'}
        </button>

        {/* AI Assistant Toggle Button */}
        <button
          onClick={onToggleAi}
          className={`btn ${isAiOpen ? 'btn-primary' : 'btn-flat'}`}
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.8rem',
            boxShadow: isAiOpen ? 'var(--glow-primary)' : 'none'
          }}
        >
          <Sparkles size={14} />
          AI Assistant
        </button>

        {/* User Info */}
        <div style={{
          borderLeft: 'var(--border-glass)',
          paddingLeft: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0.1rem'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>{adminName}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Administrator</span>
        </div>
      </div>
    </header>
  );

};
