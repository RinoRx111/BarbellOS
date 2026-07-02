import React from 'react';
import { LayoutDashboard, Users, Award, Receipt, Settings, Lock } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLock: () => void;
  gymName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onLock, gymName }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'plans', label: 'Plans', icon: Award },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="glass-panel" style={{
      width: 'var(--sidebar-width)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '0',
      borderRight: 'var(--border-glass)',
      borderTop: 'none',
      borderBottom: 'none',
      borderLeft: 'none',
      background: 'rgba(15, 23, 42, 0.4)'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '1.75rem 1.5rem',
        borderBottom: 'var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem'
      }}>
        <h1 style={{
          fontSize: '1.25rem',
          color: '#fff',
          fontWeight: '700',
          letterSpacing: '-0.02em',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {gymName}
        </h1>
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Management Console
        </span>
      </div>

      {/* Nav Menu */}
      <nav style={{
        padding: '1.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        flex: 1
      }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="btn btn-flat"
              style={{
                justifyContent: 'flex-start',
                padding: '0.8rem 1rem',
                background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                borderColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '400',
                boxShadow: isActive ? 'var(--glow-primary)' : 'none',
                width: '100%'
              }}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'inherit' }} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Lock Action */}
      <div style={{
        padding: '1.5rem 1rem',
        borderTop: 'var(--border-glass)'
      }}>
        <button
          onClick={onLock}
          className="btn btn-flat"
          style={{
            width: '100%',
            justifyContent: 'center',
            color: 'var(--accent-danger)',
            borderColor: 'rgba(239, 68, 68, 0.15)'
          }}
        >
          <Lock size={16} />
          Lock Console
        </button>
      </div>
    </div>
  );
};
