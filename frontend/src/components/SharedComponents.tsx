import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface StatusTabsProps {
  activeTab: string;
  tabs: { value: string; label: string }[];
  counts?: Record<string, number>;
  onChange: (value: string) => void;
}

export const StatusTabs: React.FC<StatusTabsProps> = ({ activeTab, tabs, counts, onChange }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '0.25rem',
      background: 'rgba(0, 0, 0, 0.25)',
      padding: '4px',
      borderRadius: 'var(--radius-sm)',
      border: 'var(--border-glass)',
      alignItems: 'center'
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className="btn btn-flat"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.75rem',
              background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              borderColor: 'transparent',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              borderRadius: 'calc(var(--radius-sm) - 2px)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>{tab.label}</span>
            {count !== undefined && (
              <span style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px',
                background: isActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: '600'
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

interface BannerProps {
  message: string;
  type?: 'warning' | 'error' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  actionButton?: React.ReactNode;
}

export const Banner: React.FC<BannerProps> = ({
  message,
  type = 'warning',
  dismissible = true,
  onDismiss,
  actionButton
}) => {
  const getBannerStyles = () => {
    switch (type) {
      case 'error':
        return {
          border: '1px solid rgba(239, 68, 68, 0.25)',
          background: 'rgba(239, 68, 68, 0.04)',
          color: 'var(--accent-danger)'
        };
      case 'info':
        return {
          border: '1px solid rgba(59, 130, 246, 0.25)',
          background: 'rgba(59, 130, 246, 0.04)',
          color: 'var(--accent-primary)'
        };
      default: // warning
        return {
          border: '1px solid rgba(245, 158, 11, 0.25)',
          background: 'rgba(245, 158, 11, 0.04)',
          color: 'var(--accent-warning)'
        };
    }
  };

  const styles = getBannerStyles();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.85rem 1.25rem',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.85rem',
      gap: '1rem',
      ...styles
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <AlertCircle size={16} style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-primary)' }}>{message}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {actionButton}
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
