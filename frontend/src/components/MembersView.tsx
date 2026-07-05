import React, { useState, useEffect } from 'react';
import { Search, Plus, CreditCard, Snowflake, Flame, Trash, Edit, ArrowLeft, Check, AlertTriangle, Filter, Clock, Cpu } from 'lucide-react';

import api from '../services/api';
import { StatusTabs } from './SharedComponents';


interface Plan {
  id: number;
  name: string;
  duration_days: number;
  price: number;
}

interface Member {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  photo_path: string | null;
  plan_id: number;
  join_date: string;
  expiry_date: string;
  frozen_from: string | null;
  frozen_until: string | null;
  biometric_template_id: string | null;
  card_id: string | null;
  status: 'active' | 'expired' | 'frozen';
}

interface Payment {
  id: number;
  member_id: number;
  amount: number;
  payment_date: string;
  method: 'cash' | 'upi' | 'card';
  plan_id: number;
}

interface Attendance {
  id: number;
  check_in_time: string;
  check_in_method: string;
  access_granted: boolean;
}

export const MembersView: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  
  // Lists
  const [memberPayments, setMemberPayments] = useState<Payment[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<Attendance[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');

  const getAvatarBg = (name: string) => {
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const colors = [
      'rgba(59, 130, 246, 0.15)',
      'rgba(16, 185, 129, 0.15)',
      'rgba(245, 158, 11, 0.15)',
      'rgba(239, 68, 68, 0.15)',
      'rgba(167, 139, 250, 0.15)'
    ];
    return colors[hash % colors.length];
  };

  const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const colors = [
      'var(--accent-primary)',
      'var(--accent-success)',
      'var(--accent-warning)',
      'var(--accent-danger)',
      '#a78bfa'
    ];
    return colors[hash % colors.length];
  };

  const getInitials = (name: string) => {
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelativeStatusTime = (member: Member) => {
    if (member.status === 'frozen') {
      if (member.frozen_until) {
        return `frozen until ${new Date(member.frozen_until).toLocaleDateString()}`;
      }
      return 'frozen';
    }
    const days = Math.round((new Date(member.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) {
      return `expired ${Math.abs(days)} days ago`;
    }
    if (days === 0) {
      return 'expires today';
    }
    return `expires in ${days} days`;
  };

  const statusCounts = {
    all: members.length,
    active: members.filter(m => m.status === 'active').length,
    expired: members.filter(m => m.status === 'expired').length,
    frozen: members.filter(m => m.status === 'frozen').length,
  };


  
  // Form Modals State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isFreezeOpen, setIsFreezeOpen] = useState(false);
  
  // Loading & Errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Member Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState<number>(0);
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [cardId, setCardId] = useState('');
  const [biometricTemplateId, setBiometricTemplateId] = useState('');
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  // Log Payment Fields
  const [payPlanId, setPayPlanId] = useState<number>(0);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  // Freeze Fields
  const [freezeFrom, setFreezeFrom] = useState(new Date().toISOString().split('T')[0]);
  const [freezeUntil, setFreezeUntil] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Load initial data
  const loadData = async () => {
    try {
      const membersData = await api.get<Member[]>('/members');
      const plansData = await api.get<Plan[]>('/plans');
      setMembers(membersData);
      setPlans(plansData);
      if (plansData.length > 0) {
        setPlanId(plansData[0].id);
        setPayPlanId(plansData[0].id);
        setPayAmount(plansData[0].price);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load member registry.');
    }
  };

  useEffect(() => {
    loadData().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    const pendingId = localStorage.getItem('barbellos_open_member_file');
    if (pendingId && members.length > 0) {
      const mem = members.find(m => m.id === Number(pendingId));
      if (mem) {
        loadMemberDetails(mem);
        localStorage.removeItem('barbellos_open_member_file');
      }
    }
  }, [members]);

  useEffect(() => {
    const handleOpenMember = (e: Event) => {
      const customEvent = e as CustomEvent;
      const memberId = Number(customEvent.detail);
      if (memberId && members.length > 0) {
        const mem = members.find(m => m.id === memberId);
        if (mem) {
          loadMemberDetails(mem);
        }
      }
    };
    window.addEventListener('open-member-file', handleOpenMember);
    return () => window.removeEventListener('open-member-file', handleOpenMember);
  }, [members]);


  // Update payment amount when plan selection changes
  useEffect(() => {
    const selectedPlan = plans.find(p => p.id === payPlanId);
    if (selectedPlan) {
      setPayAmount(selectedPlan.price);
    }
  }, [payPlanId, plans]);

  // Load details (payments & attendance) for selected member
  const loadMemberDetails = async (member: Member) => {
    try {
      const paymentsData = await api.get<Payment[]>(`/payments/member/${member.id}`);
      // Filter attendance logs locally for this member
      const attendanceData = await api.get<Attendance[]>('/attendance');
      const filteredAttendance = attendanceData.filter(a => (a as any).member_id === member.id);
      
      setMemberPayments(paymentsData);
      setMemberAttendance(filteredAttendance);
      setSelectedMember(member);
    } catch (err: any) {
      setError('Failed to load member records.');
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name,
        phone,
        plan_id: planId,
        join_date: joinDate,
        email: email || undefined,
        card_id: cardId || undefined,
        biometric_template_id: biometricTemplateId || undefined
      };
      
      const newMember = await api.post<Member>('/members', payload);
      
      // Auto create an initial payment log
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        await api.post('/payments', {
          member_id: newMember.id,
          plan_id: planId,
          amount: plan.price,
          method: 'cash'
        });
      }

      setIsAddOpen(false);
      resetAddForm();
      await loadData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create member.');
    }
  };

  // Edit Member
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setError('');
    try {
      const payload = {
        name,
        phone,
        plan_id: planId,
        email: email || undefined,
        card_id: cardId || undefined,
        biometric_template_id: biometricTemplateId || undefined
      };
      
      const updated = await api.put<Member>(`/members/${selectedMember.id}`, payload);
      setIsEditOpen(false);
      await loadData();
      await loadMemberDetails(updated);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update member profile.');
    }
  };

  // Delete Member
  const handleDeleteMember = async (memberId: number) => {
    if (!window.confirm('Are you absolutely sure you want to delete this member? All attendance and payment history will be permanently deleted.')) {
      return;
    }
    try {
      await api.delete(`/members/${memberId}`);
      setSelectedMember(null);
      await loadData();
    } catch (err: any) {
      setError('Failed to delete member.');
    }
  };

  // Log Payment
  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    try {
      await api.post<Payment>('/payments', {
        member_id: selectedMember.id,
        plan_id: payPlanId,
        amount: payAmount,
        method: payMethod
      });
      setIsPaymentOpen(false);
      // Reload member data & details
      const refreshed = await api.get<Member>(`/members/${selectedMember.id}`);
      await loadData();
      await loadMemberDetails(refreshed);
    } catch (err: any) {
      setError(err.detail || 'Failed to log renewal payment.');
    }
  };

  // Freeze Membership
  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    try {
      const refreshed = await api.post<Member>(`/members/${selectedMember.id}/freeze`, {
        frozen_from: freezeFrom,
        frozen_until: freezeUntil
      });
      setIsFreezeOpen(false);
      await loadData();
      await loadMemberDetails(refreshed);
    } catch (err: any) {
      setError(err.detail || 'Failed to freeze membership.');
    }
  };

  // Unfreeze Membership
  const handleUnfreeze = async () => {
    if (!selectedMember) return;
    try {
      const refreshed = await api.post<Member>(`/members/${selectedMember.id}/unfreeze`);
      await loadData();
      await loadMemberDetails(refreshed);
    } catch (err: any) {
      setError('Failed to resume membership.');
    }
  };

  // Mock Biometric Enrollment Scanner Wizard
  const triggerBiometricScan = () => {
    if (!biometricConsent) return;
    setIsScanning(true);
    setScanStep(1);
    
    // Simulate steps
    setTimeout(() => {
      setScanStep(2);
      setTimeout(() => {
        setScanStep(3);
        setTimeout(() => {
          const mockTemplateId = `zk_temp_${Math.floor(1000 + Math.random() * 9000)}`;
          setBiometricTemplateId(mockTemplateId);
          setIsScanning(false);
        }, 1500);
      }, 1500);
    }, 1500);
  };

  const resetAddForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCardId('');
    setBiometricTemplateId('');
    setBiometricConsent(false);
    if (plans.length > 0) {
      setPlanId(plans[0].id);
    }
  };

  const openEditForm = () => {
    if (!selectedMember) return;
    setName(selectedMember.name);
    setPhone(selectedMember.phone);
    setEmail(selectedMember.email || '');
    setPlanId(selectedMember.plan_id);
    setCardId(selectedMember.card_id || '');
    setBiometricTemplateId(selectedMember.biometric_template_id || '');
    setBiometricConsent(selectedMember.biometric_template_id ? true : false);
    setIsEditOpen(true);
  };

  // Filtering list
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
    const matchesStatus = filterStatus === 'all' ? true : m.status === filterStatus;
    const matchesPlan = filterPlan === 'all' ? true : m.plan_id === Number(filterPlan);
    return matchesSearch && matchesStatus && matchesPlan;
  });


  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Member Register...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* List Window */}
      <div style={{
        flex: 1,
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        overflowY: 'auto',
        height: '100%'
      }}>
        {error && !selectedMember && (
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

        {/* Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Status tabs switcher */}
            <StatusTabs
              activeTab={filterStatus}
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'frozen', label: 'Frozen' },
                { value: 'expired', label: 'Expired' }
              ]}
              counts={statusCounts}
              onChange={(val) => setFilterStatus(val)}
            />

            {/* Results counter */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> results
            </div>

            <div style={{ flex: 1 }} />

            {/* Prominent Add Member Button */}
            <button
              onClick={() => { resetAddForm(); setIsAddOpen(true); }}
              className="btn btn-primary"
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                background: 'var(--accent-primary)',
                borderColor: 'transparent',
                boxShadow: 'var(--glow-primary)'
              }}
            >
              <Plus size={16} />
              Register Member
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              border: 'var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 1rem',
              width: '300px'
            }}>
              <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
              <input
                type="text"
                placeholder="Search member name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '0.6rem 0',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Dropdown Filter Affordance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', border: 'var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '0 0.75rem' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '0.6rem 0',
                  outline: 'none',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all" style={{ background: '#0B0F19' }}>All Plans</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#0B0F19' }}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Members Grid/Table */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Contact</th>
                <th>Plan Assigned</th>
                <th>Status & Duration</th>
                <th>Enrollment & Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    No members matching filters found.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const avatarBg = getAvatarBg(member.name);
                  const avatarCol = getAvatarColor(member.name);
                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: avatarBg,
                            border: `1px solid ${avatarCol}25`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: avatarCol
                          }}>
                            {getInitials(member.name)}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '500' }}>{member.name}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {member.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{member.phone}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.email || 'No email'}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: '500' }}>
                          {plans.find(p => p.id === member.plan_id)?.name || 'Custom Plan'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className={`badge badge-${member.status}`} style={{ width: 'fit-content' }}>{member.status}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={10} />
                            {getRelativeStatusTime(member)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {member.biometric_template_id && (
                            <span className="badge badge-active" style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
                              Biometric
                            </span>
                          )}
                          {member.card_id && (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                              Card Enrolled
                            </span>
                          )}
                          {!member.biometric_template_id && !member.card_id && (
                            <span className="badge badge-expired" style={{ fontSize: '0.65rem' }}>
                              Unenrolled
                            </span>
                          )}
                          {member.status === 'frozen' && (
                            <span className="badge badge-expired" style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
                              AI Freeze Action
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => loadMemberDetails(member)}
                          className="btn btn-flat"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                        >
                          Manage File
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Details Side Drawer (Slides in on file click) */}
      {selectedMember && (
        <div className="glass-panel" style={{
          width: '450px',
          height: '100%',
          borderRadius: '0',
          borderLeft: 'var(--border-glass)',
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          overflowY: 'auto',
          background: '#0B0F19',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          {/* Header Panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: 'var(--border-glass)', paddingBottom: '1.25rem' }}>
            <button
              onClick={() => setSelectedMember(null)}
              className="btn btn-flat"
              style={{ padding: '0.4rem', borderRadius: '50%' }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#fff', fontSize: '1.2rem' }}>Member Profile</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>File Records</span>
            </div>
            <span className={`badge badge-${selectedMember.status}`}>{selectedMember.status}</span>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)',
                border: 'var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-secondary)'
              }}>
                {selectedMember.name.charAt(0)}
              </div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '1.1rem' }}>{selectedMember.name}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedMember.phone}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{selectedMember.email || 'No email listed'}</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: 'var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Expiry Date:</span>
                <span style={{ color: '#fff', fontWeight: '500' }}>{new Date(selectedMember.expiry_date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Join Date:</span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(selectedMember.join_date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>RFID Card:</span>
                <span style={{ color: selectedMember.card_id ? '#fff' : 'var(--text-muted)' }}>{selectedMember.card_id || 'Not assigned'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Biometric Key:</span>
                <span style={{ color: selectedMember.biometric_template_id ? '#fff' : 'var(--text-muted)' }}>
                  {selectedMember.biometric_template_id ? 'TEMPLATE LOADED' : 'Not registered'}
                </span>
              </div>
              {selectedMember.status === 'frozen' && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '4px',
                  color: 'var(--accent-warning)',
                  fontSize: '0.75rem'
                }}>
                  Membership Frozen: {new Date(selectedMember.frozen_from!).toLocaleDateString()} to {new Date(selectedMember.frozen_until!).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              onClick={() => setIsPaymentOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flex: '1 1 45%' }}
            >
              <CreditCard size={14} />
              Log Payment
            </button>

            <button
              onClick={() => {
                localStorage.setItem('barbellos_active_chat_context', JSON.stringify({
                  memberId: selectedMember.id,
                  name: selectedMember.name
                }));
                window.dispatchEvent(new CustomEvent('change-tab-context', {
                  detail: { memberId: selectedMember.id, name: selectedMember.name }
                }));
              }}
              className="btn btn-flat"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                flex: '1 1 45%',
                color: 'var(--accent-primary)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.05)'
              }}
            >
              <Cpu size={14} />
              Ask AI about Member
            </button>


            {selectedMember.status === 'frozen' ? (
              <button
                onClick={handleUnfreeze}
                className="btn btn-success"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flex: '1 1 45%' }}
              >
                <Flame size={14} />
                Unfreeze (Resume)
              </button>
            ) : (
              <button
                onClick={() => setIsFreezeOpen(true)}
                className="btn btn-flat"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flex: '1 1 45%', color: 'var(--accent-warning)', borderColor: 'rgba(245,158,11,0.2)' }}
              >
                <Snowflake size={14} />
                Freeze Plan
              </button>
            )}

            <button
              onClick={openEditForm}
              className="btn btn-flat"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flex: '1 1 45%' }}
            >
              <Edit size={14} />
              Edit Profile
            </button>

            <button
              onClick={() => handleDeleteMember(selectedMember.id)}
              className="btn btn-flat"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flex: '1 1 45%', color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.2)' }}
            >
              <Trash size={14} />
              Delete Member
            </button>
          </div>

          {/* Payments & Attendance tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {/* Payments List */}
            <div style={{ borderTop: 'var(--border-glass)', paddingTop: '1.25rem' }}>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Billing Records</h4>
              {memberPayments.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No billing logs found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {memberPayments.map(pay => (
                    <div
                      key={pay.id}
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        border: 'var(--border-glass)',
                        fontSize: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ color: '#fff', fontWeight: '500' }}>
                          {plans.find(p => p.id === pay.plan_id)?.name || 'Subscription'}
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(pay.payment_date).toLocaleDateString()} • {pay.method.toUpperCase()}
                        </span>
                      </div>
                      <strong style={{ color: 'var(--accent-success)' }}>₹{pay.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance Logs */}
            <div style={{ borderTop: 'var(--border-glass)', paddingTop: '1.25rem' }}>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Access History</h4>
              {memberAttendance.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No check-in entries found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {memberAttendance.map(log => (
                    <div
                      key={log.id}
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        border: 'var(--border-glass)',
                        fontSize: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.check_in_time).toLocaleString()}</span>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Method: {log.check_in_method}</div>
                      </div>
                      {log.access_granted ? (
                        <span style={{ color: 'var(--accent-success)', fontWeight: '600' }}>PASSED</span>
                      ) : (
                        <span style={{ color: 'var(--accent-danger)', fontWeight: '600' }}>DENIED</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT MEMBER MODAL --- */}
      {(isAddOpen || isEditOpen) && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>{isAddOpen ? 'Register New Member' : 'Edit Member Profile'}</h3>
              <button
                onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleAddMember : handleEditMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="10-digit phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="email@address.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {isAddOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Initial Membership Plan</label>
                    <select
                      className="form-control"
                      value={planId}
                      onChange={(e) => setPlanId(Number(e.target.value))}
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Join Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={joinDate}
                      onChange={(e) => setJoinDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* RFID Card Assign */}
              <div className="form-group">
                <label className="form-label">RFID Card ID (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Scan card or input unique card ID"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                />
              </div>

              {/* Biometrics Setup */}
              <div style={{
                border: 'var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>Biometric Register (India DPDP Compliant)</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={biometricConsent}
                      onChange={(e) => setBiometricConsent(e.target.checked)}
                    />
                    Consent Given
                  </label>
                </div>

                {biometricConsent ? (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={triggerBiometricScan}
                      className="btn btn-flat"
                      style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                      disabled={isScanning}
                    >
                      {isScanning ? 'Scanner Active...' : biometricTemplateId ? 'Re-enroll fingerprint' : 'Enroll Fingerprint'}
                    </button>
                    {isScanning && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="status-dot status-online" style={{ background: 'var(--accent-warning)', width: '6px', height: '6px' }}></span>
                        Scan Step {scanStep}/3... Place finger
                      </span>
                    )}
                    {biometricTemplateId && !isScanning && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} />
                        Template Assigned: {biometricTemplateId}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Biometric enrollment is locked until the consent checkbox is explicitly verified.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              >
                {isAddOpen ? 'Add Member & Log Initial Payment' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG PAYMENT MODAL --- */}
      {isPaymentOpen && selectedMember && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>Log Renewal Payment</h3>
              <button onClick={() => setIsPaymentOpen(false)} className="modal-close">✕</button>
            </div>
            
            <form onSubmit={handleLogPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Renew Plan Tier</label>
                <select
                  className="form-control"
                  value={payPlanId}
                  onChange={(e) => setPayPlanId(Number(e.target.value))}
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - {p.duration_days} Days</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-control"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                >
                  <option value="cash">Cash Payment</option>
                  <option value="upi">UPI / QR Scan</option>
                  <option value="card">Credit/Debit Card</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount Collected (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{
                padding: '0.75rem',
                borderRadius: '4px',
                background: 'rgba(59,130,246,0.05)',
                border: '1px solid rgba(59,130,246,0.15)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)'
              }}>
                Logging this payment will stack plan duration and push the expiry date forward from: <strong>{new Date(selectedMember.expiry_date).toLocaleDateString()}</strong>.
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Confirm Payment & Renew
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- FREEZE MODAL --- */}
      {isFreezeOpen && selectedMember && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>Freeze Membership Plan</h3>
              <button onClick={() => setIsFreezeOpen(false)} className="modal-close">✕</button>
            </div>

            <form onSubmit={handleFreeze} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Freeze Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={freezeFrom}
                  onChange={(e) => setFreezeFrom(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Freeze Return Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={freezeUntil}
                  onChange={(e) => setFreezeUntil(e.target.value)}
                  required
                />
              </div>

              <div style={{
                padding: '0.75rem',
                borderRadius: '4px',
                background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.15)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ color: 'var(--accent-warning)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <AlertTriangle size={12} />
                  Expiry Date Shift Shift Notice
                </div>
                <span>
                  This freeze spans <strong>{(new Date(freezeUntil).getTime() - new Date(freezeFrom).getTime()) / (24*60*60*1000) + 1}</strong> days.
                </span>
                <span>
                  The physical check-in gate will reject entry during this freeze. The expiry date is shifted forward to credit paused days.
                </span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'var(--accent-warning)', color: '#000' }}>
                Confirm Freeze
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
