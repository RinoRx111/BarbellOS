import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Clock, CheckCircle, AlertCircle, ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';

import api from '../services/api';
import { Banner } from './SharedComponents';

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

interface Member {
  id: number;
  name: string;
  join_date: string;
  plan_id: number;
  status: string;
}

interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  member_id: number;
}

interface Expense {
  id: number;
  amount: number;
  date: string;
}

interface AIConfig {
  provider: string;
  api_key?: string;
  openai_key?: string;
  ollama_url?: string;
}

interface AttendanceLog {
  id: number;
  check_in_time: string;
  access_granted: boolean;
  member_name: string;
}

export const DashboardView: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [gymName, setGymName] = useState('Iron Temple Gym');

  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  
  // Dashboard UI States
  const [metricType, setMetricType] = useState<'revenue' | 'attendance'>('revenue');
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  // Dismissible settings
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('barbellos_dismissed_alerts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [dismissedChecklist, setDismissedChecklist] = useState<boolean>(() => {
    return localStorage.getItem('barbellos_dismissed_checklist') === 'true';
  });

  const saveDismissedAlerts = (updated: Record<string, boolean>) => {
    setDismissedAlerts(updated);
    localStorage.setItem('barbellos_dismissed_alerts', JSON.stringify(updated));
  };

  const loadAllData = async () => {
    try {
      const [dash, mems, pays, plns, aicfg, exps, atts, setts] = await Promise.all([
        api.get<DashboardData>('/dashboard'),
        api.get<Member[]>('/members'),
        api.get<Payment[]>('/payments'),
        api.get<any[]>('/plans'),
        api.get<AIConfig>('/ai/config'),
        api.get<Expense[]>('/expenses'),
        api.get<AttendanceLog[]>('/attendance'),
        api.get<any>('/settings').catch(() => null)
      ]);

      setDashboardData(dash);
      setMembers(mems);
      setPayments(pays);
      setPlans(plns);
      setAiConfig(aicfg);
      setExpenses(exps);
      setAttendance(atts);
      if (setts) {
        setGymName(setts.gym_name);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard intelligence.');
    }
  };


  useEffect(() => {
    loadAllData().then(() => setLoading(false));

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/attendance');
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'attendance') {
              loadAllData();
            }
          } catch {
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

    const pollInterval = setInterval(loadAllData, 10000);

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

  // --- STAT CALCULATIONS ---
  const todayStr = new Date().toDateString();
  
  // Today stats
  const todayRevenue = payments
    .filter(p => new Date(p.payment_date).toDateString() === todayStr)
    .reduce((sum, p) => sum + p.amount, 0);

  const todaySignups = members
    .filter(m => m.join_date && new Date(m.join_date).toDateString() === todayStr)
    .length;

  const todayAttendance = dashboardData?.attendance_summary.total || 0;

  // Monthly stats (Comparison calculation)
  const now = new Date();
  const thisMonthIdx = now.getMonth();
  const thisYear = now.getFullYear();

  const prevMonthIdx = thisMonthIdx === 0 ? 11 : thisMonthIdx - 1;
  const prevYear = thisMonthIdx === 0 ? thisYear - 1 : thisYear;

  // New Signups comparison
  const thisMonthSignups = members.filter(m => {
    const d = new Date(m.join_date);
    return d.getMonth() === thisMonthIdx && d.getFullYear() === thisYear;
  }).length;

  const lastMonthSignups = members.filter(m => {
    const d = new Date(m.join_date);
    return d.getMonth() === prevMonthIdx && d.getFullYear() === prevYear;
  }).length;

  const signupDelta = lastMonthSignups === 0 
    ? (thisMonthSignups > 0 ? 100 : 0) 
    : Math.round(((thisMonthSignups - lastMonthSignups) / lastMonthSignups) * 100);

  // Revenue comparison
  const thisMonthRevenue = payments.filter(p => {
    const d = new Date(p.payment_date);
    return d.getMonth() === thisMonthIdx && d.getFullYear() === thisYear;
  }).reduce((sum, p) => sum + p.amount, 0);

  const lastMonthRevenue = payments.filter(p => {
    const d = new Date(p.payment_date);
    return d.getMonth() === prevMonthIdx && d.getFullYear() === prevYear;
  }).reduce((sum, p) => sum + p.amount, 0);

  const revenueDelta = lastMonthRevenue === 0
    ? (thisMonthRevenue > 0 ? 100 : 0)
    : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);

  // Net Profit comparison
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === thisMonthIdx && d.getFullYear() === thisYear;
  }).reduce((sum, e) => sum + e.amount, 0);

  const lastMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === prevMonthIdx && d.getFullYear() === prevYear;
  }).reduce((sum, e) => sum + e.amount, 0);

  const thisMonthNet = thisMonthRevenue - thisMonthExpenses;
  const lastMonthNet = lastMonthRevenue - lastMonthExpenses;
  const profitDelta = lastMonthNet === 0
    ? (thisMonthNet > 0 ? 100 : 0)
    : Math.round(((thisMonthNet - lastMonthNet) / Math.abs(lastMonthNet)) * 100);

  // --- CHART DATA GENERATION ---
  const getTrendData = () => {
    const dataPoints: { dateLabel: string; value: number }[] = [];
    const count = rangeDays;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toDateString();

      let value = 0;
      if (metricType === 'revenue') {
        value = payments
          .filter(p => new Date(p.payment_date).toDateString() === dateString)
          .reduce((sum, p) => sum + p.amount, 0);
      } else {
        value = attendance
          .filter(a => new Date(a.check_in_time).toDateString() === dateString)
          .length;
      }

      dataPoints.push({
        dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value
      });
    }

    if (granularity === 'weekly') {
      const weeklyPoints: { dateLabel: string; value: number }[] = [];
      for (let i = 0; i < dataPoints.length; i += 7) {
        const slice = dataPoints.slice(i, i + 7);
        const sum = slice.reduce((acc, curr) => acc + curr.value, 0);
        weeklyPoints.push({
          dateLabel: `W${Math.floor(i / 7) + 1} (${slice[0]?.dateLabel || ''})`,
          value: sum
        });
      }
      return weeklyPoints;
    } else if (granularity === 'monthly') {
      // Group by calendar month if 30 days, or just sum entire
      const sum = dataPoints.reduce((acc, curr) => acc + curr.value, 0);
      return [{ dateLabel: 'Past 30 Days Total', value: sum }];
    }

    return dataPoints;
  };

  const trendData = getTrendData();
  const maxValue = Math.max(...trendData.map(t => t.value), 10);

  // Trigger tab change using domestic custom events
  const jumpToTab = (tabName: string) => {
    window.dispatchEvent(new CustomEvent('change-tab', { detail: tabName }));
  };

  // Onboarding Checklist Flags
  const hasPlans = plans.length > 0;
  const hasMembers = members.length > 0;
  const hasProfile = gymName !== 'Iron Temple Gym';
  const hasAi = !!(aiConfig?.api_key || aiConfig?.openai_key || aiConfig?.ollama_url);
  const checklistDismissed = dismissedChecklist;

  const showChecklist = !(hasPlans && hasMembers && hasProfile && hasAi) && !checklistDismissed;

  // Missing Configuration alerts
  const showAiAlert = !hasAi && !dismissedAlerts['ai'];
  const showPlansAlert = !hasPlans && !dismissedAlerts['plans'];

  // WebSocket Entry / Activity Stream (Combined Stream)
  const getEventFeed = () => {
    const events: { id: string; text: string; time: Date; status: 'success' | 'danger' | 'warning' }[] = [];

    // Map recent checkins
    (dashboardData?.recent_attendance || []).forEach(log => {
      events.push({
        id: `att-${log.id}`,
        text: `${log.member_name} checked in via ${log.check_in_method}${log.duplicate ? ' (Duplicate Scan)' : ''}`,
        time: new Date(log.check_in_time),
        status: log.access_granted ? 'success' : 'danger'
      });
    });

    // Map recent payments
    payments.slice(0, 5).forEach(pay => {
      const memName = members.find(m => m.id === pay.member_id)?.name || 'Member';
      events.push({
        id: `pay-${pay.id}`,
        text: `New payment logged: ₹${pay.amount} for subscription from ${memName}`,
        time: new Date(pay.payment_date),
        status: 'success'
      });
    });

    // Sort descending
    return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
  };

  const feedEvents = getEventFeed();

  const getRelativeTime = (time: Date) => {
    const diffMs = Date.now() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', height: '100%' }}>
      
      {/* 1. SaaS Banner Alerts */}
      {showAiAlert && (
        <Banner
          message="AI Assistant is not configured — Set up a provider in Settings to unlock Copilot natural language queries."
          type="warning"
          onDismiss={() => saveDismissedAlerts({ ...dismissedAlerts, ai: true })}
          actionButton={
            <button onClick={() => jumpToTab('settings')} className="btn btn-flat" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
              Set up now
            </button>
          }
        />
      )}

      {showPlansAlert && (
        <Banner
          message="No pricing plans created yet — Add subscription package tiers before registering members."
          type="error"
          onDismiss={() => saveDismissedAlerts({ ...dismissedAlerts, plans: true })}
          actionButton={
            <button onClick={() => jumpToTab('plans')} className="btn btn-flat" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-danger)' }}>
              Create Tier
            </button>
          }
        />
      )}

      {/* Main Grid: Stat columns & Live feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Stats & Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Side-by-side columns: Today vs This Month */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Today's Stats Column */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
                <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>TODAY'S ACTIVITY</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Metric 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Today's Revenue</span>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>₹{todayRevenue.toLocaleString()}</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UPI/Cash</span>
                </div>
                {/* Metric 2 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Today's Check-ins</span>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>{todayAttendance}</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Entries</span>
                </div>
                {/* Metric 3 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>New Signups</span>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>{todaySignups}</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registrations</span>
                </div>
              </div>
            </div>

            {/* This Month's Stats Column */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent-success)' }} />
                <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>THIS MONTH</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Metric 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Revenue</span>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>₹{(dashboardData?.revenue_this_month || 0).toLocaleString()}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: revenueDelta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)', fontSize: '0.75rem', fontWeight: '500' }}>
                    {revenueDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(revenueDelta)}%
                  </div>
                </div>
                {/* Metric 2 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Net Profit</span>
                    <h3 style={{ fontSize: '1.25rem', color: (dashboardData?.net_profit || 0) >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>
                      ₹{(dashboardData?.net_profit || 0).toLocaleString()}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: profitDelta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)', fontSize: '0.75rem', fontWeight: '500' }}>
                    {profitDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(profitDelta)}%
                  </div>
                </div>
                {/* Metric 3 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Month Signups</span>
                    <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>{thisMonthSignups}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: signupDelta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)', fontSize: '0.75rem', fontWeight: '500' }}>
                    {signupDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(signupDelta)}%
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Trends Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>Business Intelligence Trends</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Analyze scanner logs and logged earnings</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                
                {/* Toggle Metric Type */}
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}>
                  <button onClick={() => setMetricType('revenue')} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: metricType === 'revenue' ? 'rgba(255,255,255,0.06)' : 'transparent', color: metricType === 'revenue' ? '#fff' : 'var(--text-secondary)' }}>
                    Revenue
                  </button>
                  <button onClick={() => setMetricType('attendance')} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: metricType === 'attendance' ? 'rgba(255,255,255,0.06)' : 'transparent', color: metricType === 'attendance' ? '#fff' : 'var(--text-secondary)' }}>
                    Check-ins
                  </button>
                </div>

                {/* Toggle Days Range */}
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}>
                  <button onClick={() => { setRangeDays(7); setGranularity('daily'); }} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: rangeDays === 7 ? 'rgba(255,255,255,0.06)' : 'transparent', color: rangeDays === 7 ? '#fff' : 'var(--text-secondary)' }}>
                    7D
                  </button>
                  <button onClick={() => { setRangeDays(30); setGranularity('daily'); }} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: rangeDays === 30 ? 'rgba(255,255,255,0.06)' : 'transparent', color: rangeDays === 30 ? '#fff' : 'var(--text-secondary)' }}>
                    30D
                  </button>
                </div>

                {/* Toggle Granularity */}
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}>
                  <button onClick={() => setGranularity('daily')} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: granularity === 'daily' ? 'rgba(255,255,255,0.06)' : 'transparent', color: granularity === 'daily' ? '#fff' : 'var(--text-secondary)' }} disabled={granularity === 'monthly'}>
                    Daily
                  </button>
                  <button onClick={() => setGranularity('weekly')} className="btn btn-flat" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: granularity === 'weekly' ? 'rgba(255,255,255,0.06)' : 'transparent', color: granularity === 'weekly' ? '#fff' : 'var(--text-secondary)' }}>
                    Weekly
                  </button>
                </div>

              </div>
            </div>

            {/* Custom Interactive SVG Line/Bar Chart */}
            <div style={{ height: '200px', width: '100%', position: 'relative' }}>
              {trendData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No trend data available for the range.
                </div>
              ) : (
                <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                    const yPos = 170 - ratio * 150;
                    return (
                      <g key={index}>
                        <line x1="40" y1={yPos} x2="95%" y2={yPos} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                        <text x="30" y={yPos + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">
                          {metricType === 'revenue' ? `₹${Math.round(ratio * maxValue)}` : Math.round(ratio * maxValue)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw Chart Nodes */}
                  {metricType === 'revenue' ? (
                    // Draw Line Path
                    <g>
                      <path
                        d={trendData.map((t, idx) => {
                          const x = 50 + (idx / (trendData.length - 1 || 1)) * (window.innerWidth * 0.45);
                          const y = 170 - (t.value / maxValue) * 150;
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="var(--accent-primary)"
                        strokeWidth="2"
                        style={{ filter: 'drop-shadow(0px 4px 8px rgba(59,130,246,0.3))' }}
                      />
                      {/* Dots and interactive hover hotspots */}
                      {trendData.map((t, idx) => {
                        const x = 50 + (idx / (trendData.length - 1 || 1)) * (window.innerWidth * 0.45);
                        const y = 170 - (t.value / maxValue) * 150;
                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="3" fill="var(--accent-primary)" />
                            <circle
                              cx={x}
                              cy={y}
                              r="15"
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => {
                                setHoveredPoint({
                                  x: x - 40,
                                  y: y - 45,
                                  label: t.dateLabel,
                                  value: `₹${t.value.toLocaleString()}`
                                });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          </g>
                        );
                      })}
                    </g>
                  ) : (
                    // Draw Bar Chart
                    <g>
                      {trendData.map((t, idx) => {
                        const widthPct = (window.innerWidth * 0.45);
                        const barWidth = Math.max(10, (widthPct / trendData.length) * 0.6);
                        const x = 50 + (idx / (trendData.length || 1)) * widthPct + barWidth / 2;
                        const height = (t.value / maxValue) * 150;
                        const y = 170 - height;
                        return (
                          <g key={idx}>
                            <rect
                              x={x - barWidth / 2}
                              y={y}
                              width={barWidth}
                              height={height}
                              fill="rgba(16, 185, 129, 0.4)"
                              stroke="var(--accent-success)"
                              strokeWidth="1"
                              rx="2"
                            />
                            <rect
                              x={x - barWidth / 2}
                              y={20}
                              width={barWidth}
                              height={150}
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => {
                                setHoveredPoint({
                                  x: x - 40,
                                  y: y - 45,
                                  label: t.dateLabel,
                                  value: `${t.value} entries`
                                });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Horizontal Labels */}
                  {trendData.map((t, idx) => {
                    if (trendData.length > 10 && idx % 3 !== 0) return null;
                    const x = 50 + (idx / (trendData.length - 1 || 1)) * (window.innerWidth * 0.45);
                    return (
                      <text key={idx} x={x} y="190" fill="var(--text-muted)" fontSize="8" textAnchor="middle">
                        {t.dateLabel}
                      </text>
                    );
                  })}
                </svg>
              )}

              {/* Tooltip display */}
              {hoveredPoint && (
                <div style={{
                  position: 'absolute',
                  left: `${hoveredPoint.x}px`,
                  top: `${hoveredPoint.y}px`,
                  background: '#07090F',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  padding: '0.4rem 0.6rem',
                  pointerEvents: 'none',
                  zIndex: 10
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{hoveredPoint.label}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>{hoveredPoint.value}</div>
                </div>
              )}
            </div>

            {/* Note about backend support for longer trend queries */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              Note: Longer query ranges are compiled client-side. Backend trend query optimization recommended for data sets &gt; 90 days.
            </div>


          </div>

          {/* Getting Started Checklist Card */}
          {showChecklist && (
            <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(59, 130, 246, 0.2)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>Getting Started Checklist</h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Finish setting up your gym operations</span>
                </div>
                <button
                  onClick={() => { setDismissedChecklist(true); localStorage.setItem('barbellos_dismissed_checklist', 'true'); }}
                  className="modal-close"
                  style={{ position: 'relative', top: 0, right: 0 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => jumpToTab('plans')}>
                  <CheckCircle size={14} style={{ color: hasPlans ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                  <span style={{ textDecoration: hasPlans ? 'line-through' : 'none', color: hasPlans ? 'var(--text-muted)' : '#fff' }}>
                    Add your first plan template
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => jumpToTab('members')}>
                  <CheckCircle size={14} style={{ color: hasMembers ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                  <span style={{ textDecoration: hasMembers ? 'line-through' : 'none', color: hasMembers ? 'var(--text-muted)' : '#fff' }}>
                    Enroll your first member
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => jumpToTab('settings')}>
                  <CheckCircle size={14} style={{ color: hasProfile ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                  <span style={{ textDecoration: hasProfile ? 'line-through' : 'none', color: hasProfile ? 'var(--text-muted)' : '#fff' }}>
                    Configure your gym profile parameters
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => jumpToTab('settings')}>
                  <CheckCircle size={14} style={{ color: hasAi ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                  <span style={{ textDecoration: hasAi ? 'line-through' : 'none', color: hasAi ? 'var(--text-muted)' : '#fff' }}>
                    Provide API keys for the AI Assistant
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Feed & Expiring Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Live Feed Event Feed */}
          <div className="glass-panel" style={{ padding: '1.25rem', minHeight: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>Live Stream Activity</h4>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Real-time updates from entry scanners and ledger logs</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {feedEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No recent activities recorded.
                </div>
              ) : (
                feedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: 'var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderLeft: `3px solid ${
                        evt.status === 'success' ? 'var(--accent-success)' :
                        evt.status === 'danger' ? 'var(--accent-danger)' :
                        'var(--accent-warning)'
                      }`
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                      {evt.text}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {getRelativeTime(evt.time)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expiring Soon Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', minHeight: '260px' }}>
            <h4 style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>Expiring Soon (7 Days)</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '1rem' }}>Members needing payment renewal</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(!dashboardData?.expiring_members || dashboardData.expiring_members.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No memberships expiring in the next 7 days.
                </div>
              ) : (
                dashboardData.expiring_members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: 'var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.8rem' }}>{member.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{member.phone}</div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      color: 'var(--accent-warning)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: '500'
                    }}>
                      <Clock size={10} />
                      Expires {new Date(member.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operator Notice */}
          <div className="glass-panel" style={{ padding: '1.25rem', fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
            <h4 style={{ color: '#fff', fontSize: '0.8rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={12} style={{ color: 'var(--accent-primary)' }} />
              Operator Notice
            </h4>
            <p style={{ margin: 0 }}>
              Access control operates locally. In case of scanner issues, click the <strong>Manual Override</strong> button at the top header to manually pulse the gate relay for any arriving member.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
