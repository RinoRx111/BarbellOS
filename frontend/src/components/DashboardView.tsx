import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, DollarSign, AlertCircle, Clock } from 'lucide-react';
import api from '../services/api';

interface AttendanceFeedItem {
  id: number;
  member_id: number | null;
  member_name: string;
  check_in_time: string;
  check_in_method: string;
  access_granted: boolean;
  member_status: string;
  duplicate: boolean;
}

interface ExpiringMember {
  id: number;
  name: string;
  phone: string;
  expiry_date: string;
}

interface DashboardData {
  active_members: number;
  revenue_this_month: number;
  expenses_this_month: number;
  net_profit: number;
  expiring_members: ExpiringMember[];
  attendance_summary: {
    total: number;
    granted: number;
    denied: number;
  };
  recent_attendance: AttendanceFeedItem[];
}

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      const res = await api.get<DashboardData>('/dashboard');
      setData(res);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard analytics.');
    }
  };

  useEffect(() => {
    fetchDashboardData().then(() => setLoading(false));

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/attendance');
        
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'attendance') {
              fetchDashboardData();
            }
          } catch (e) {
            // silent parse error
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    // Fallback: keep polling at a longer interval (e.g. 10s) in case WebSocket fails entirely
    const pollInterval = setInterval(fetchDashboardData, 10000);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-danger)' }}>{error}</p>
      </div>
    );
  }

  const metrics = [
    {
      title: 'Active Members',
      value: data?.active_members || 0,
      subtext: 'Currently active plans',
      icon: Users,
      color: 'var(--accent-primary)',
      glow: 'var(--glow-primary)'
    },
    {
      title: 'Monthly Revenue',
      value: `₹${(data?.revenue_this_month || 0).toLocaleString()}`,
      subtext: 'Payments logged this month',
      icon: TrendingUp,
      color: 'var(--accent-success)',
      glow: 'var(--glow-success)'
    },
    {
      title: 'Monthly Expenses',
      value: `₹${(data?.expenses_this_month || 0).toLocaleString()}`,
      subtext: 'Operational costs tracked',
      icon: TrendingDown,
      color: 'var(--accent-danger)',
      glow: 'var(--glow-danger)'
    },
    {
      title: 'Net Profit',
      value: `₹${(data?.net_profit || 0).toLocaleString()}`,
      subtext: 'Net business revenue',
      icon: DollarSign,
      color: (data?.net_profit || 0) >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
      glow: (data?.net_profit || 0) >= 0 ? 'var(--glow-success)' : 'var(--glow-danger)'
    }
  ];

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', height: '100%' }}>
      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.5rem'
      }}>
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: '1.5rem',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
                cursor: 'default'
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase' }}>
                  {metric.title}
                </span>
                <h3 style={{ fontSize: '1.8rem', color: '#fff', margin: '0.25rem 0' }}>
                  {metric.value}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {metric.subtext}
                </span>
              </div>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: metric.color,
                boxShadow: metric.glow
              }}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Board split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left Side: Live Attendance Feed */}
        <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.1rem' }}>Today's Entry Stream</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Live updates from biometric & card scanners</p>
            </div>
            {/* Short Stats Summary */}
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Total: <strong style={{ color: '#fff' }}>{data?.attendance_summary.total}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Granted: <strong style={{ color: 'var(--accent-success)' }}>{data?.attendance_summary.granted}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Denied: <strong style={{ color: 'var(--accent-danger)' }}>{data?.attendance_summary.denied}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(!data?.recent_attendance || data.recent_attendance.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No entry scans registered today yet.
              </div>
            ) : (
              data.recent_attendance.map((log) => (
                <div
                  key={log.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    borderLeft: `3px solid ${log.access_granted ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                    boxShadow: log.access_granted ? 'none' : 'rgba(239, 68, 68, 0.05) 0 0 10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.03)',
                      border: 'var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: 'var(--text-secondary)'
                    }}>
                      {log.member_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{log.member_name}</span>
                        {log.duplicate && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: 'var(--accent-warning)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            fontWeight: '600'
                          }}>
                            DUPLICATE SCAN
                          </span>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                        {log.check_in_method} check-in • {new Date(log.check_in_time).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {log.access_granted ? (
                      <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Granted</span>
                    ) : (
                      <span className="badge badge-expired" style={{ fontSize: '0.7rem' }}>Denied</span>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {log.member_status === 'frozen' ? 'Member Frozen' : log.member_status === 'expired' ? 'Plan Expired' : log.member_status === 'unrecognized' ? 'Unrecognized Template' : 'Active'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Alerts & Expirations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Expiring Soon Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '300px' }}>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.25rem' }}>Expiring Soon (7 Days)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>Members needing payment renewal</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(!data?.expiring_members || data.expiring_members.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No memberships expiring in the next 7 days.
                </div>
              ) : (
                data.expiring_members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: 'var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.85rem' }}>{member.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{member.phone}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--accent-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: '500'
                      }}>
                        <Clock size={12} />
                        Expires {new Date(member.expiry_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Action Hints */}
          <div className="glass-panel" style={{ padding: '1.5rem', fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
            <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={14} style={{ color: 'var(--accent-primary)' }} />
              Operator Notice
            </h4>
            <p>
              Access control operates locally. In case of scanner issues, click the <strong>Manual Override</strong> button at the top header to manually pulse the gate relay for any arriving member.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
