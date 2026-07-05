import React, { useState, useEffect } from 'react';
import { Plus, Trash, Edit, Tag, Clock, Award } from 'lucide-react';
import api from '../services/api';

interface Plan {
  id: number;
  name: string;
  duration_days: number;
  price: number;
}

export const PlansView: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'compare'>('cards');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [price, setPrice] = useState<number>(1000);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlans = async () => {
    try {
      const [resPlans, resMembers] = await Promise.all([
        api.get<Plan[]>('/plans'),
        api.get<any[]>('/members')
      ]);
      setPlans(resPlans);
      setMembers(resMembers);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch membership tiers.');
    }
  };

  useEffect(() => {
    fetchPlans().then(() => setLoading(false));
  }, []);


  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/plans', {
        name,
        duration_days: duration,
        price
      });
      setIsAddOpen(false);
      resetForm();
      await fetchPlans();
    } catch (err: any) {
      setError('Failed to create membership tier.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    try {
      await api.put(`/plans/${selectedPlan.id}`, {
        name,
        duration_days: duration,
        price
      });
      setIsEditOpen(false);
      resetForm();
      await fetchPlans();
    } catch (err: any) {
      setError('Failed to update membership tier.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this plan template? Existing members on this plan will not be deleted, but no new members can select it.')) {
      return;
    }
    try {
      await api.delete(`/plans/${id}`);
      await fetchPlans();
    } catch (err: any) {
      setError('Failed to delete plan.');
    }
  };

  const resetForm = () => {
    setName('');
    setDuration(30);
    setPrice(1000);
    setSelectedPlan(null);
  };

  const openEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setName(plan.name);
    setDuration(plan.duration_days);
    setPrice(plan.price);
    setIsEditOpen(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Membership Tiers...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', height: '100%' }}>
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

      {/* Title / Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Membership Plan Templates</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Set pricing and durations for subscription packages</p>
        </div>

        {/* View Mode Toggle switcher */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '4px', border: 'var(--border-glass)' }}>
          <button
            onClick={() => setViewMode('cards')}
            className="btn btn-flat"
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.75rem',
              background: viewMode === 'cards' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: viewMode === 'cards' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('compare')}
            className="btn btn-flat"
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.75rem',
              background: viewMode === 'compare' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: viewMode === 'compare' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Compare
          </button>
        </div>

        <button
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <Plus size={16} />
          Create Plan Tier
        </button>
      </div>

      {viewMode === 'compare' ? (
        /* Plan Comparison Table View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="table-container">
            <table className="custom-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '200px' }}>Plan Attributes</th>
                  {plans.map(plan => (
                    <th key={plan.id} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <span>{plan.name}</span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button onClick={() => openEdit(plan)} className="btn btn-flat" style={{ padding: '0.2rem', borderRadius: '50%' }}>
                            <Edit size={11} />
                          </button>
                          <button onClick={() => handleDelete(plan.id)} className="btn btn-flat" style={{ padding: '0.2rem', borderRadius: '50%', color: 'var(--accent-danger)' }}>
                            <Trash size={11} />
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={1} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      No plan tiers to compare.
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Price Tier</td>
                      {plans.map(plan => (
                        <td key={plan.id} style={{ textAlign: 'center', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                          ₹{plan.price.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Duration Limit</td>
                      {plans.map(plan => (
                        <td key={plan.id} style={{ textAlign: 'center', color: '#fff' }}>
                          {plan.duration_days} Days
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Active Enrollments</td>
                      {plans.map(plan => {
                        const enrolledCount = members.filter(m => m.plan_id === plan.id && m.status === 'active').length;
                        return (
                          <td key={plan.id}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80%', margin: '0 auto' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                <span><strong>{enrolledCount}</strong> active</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(100, (enrolledCount / Math.max(1, members.length)) * 100)}%`,
                                  background: 'var(--accent-primary)',
                                  boxShadow: 'var(--glow-primary)',
                                  borderRadius: '3px'
                                }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
            * Enrolled count reflects currently active members only; frozen/expired members on this plan aren't counted here.
          </div>
        </div>
      ) : (
        /* Existing Cards Grid View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {plans.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              No membership plans registered. Create your first plan to start registering members.
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)',
                      boxShadow: 'var(--glow-primary)'
                    }}>
                      <Award size={20} />
                    </div>
                    <div>
                      <h4 style={{ color: '#fff', fontSize: '1.05rem' }}>{plan.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {plan.id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => openEdit(plan)} className="btn btn-flat" style={{ padding: '0.4rem', borderRadius: '50%' }}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(plan.id)} className="btn btn-flat" style={{ padding: '0.4rem', borderRadius: '50%', color: 'var(--accent-danger)' }}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.01)',
                  border: 'var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Clock size={14} />
                    <span>Duration:</span>
                    <strong style={{ color: '#fff' }}>{plan.duration_days} days</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Tag size={14} />
                    <span>Price:</span>
                    <strong style={{ color: 'var(--accent-success)' }}>₹{plan.price.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}


      {/* --- ADD / EDIT PLAN MODAL --- */}
      {(isAddOpen || isEditOpen) && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>{isAddOpen ? 'Create Membership Plan' : 'Edit Plan Details'}</h3>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="modal-close">✕</button>
            </div>

            <form onSubmit={isAddOpen ? handleAdd : handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Plan Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Monthly Plan, Quarterly Tier"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g., 30, 90, 365"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pricing Rate (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Rate in rupees"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {isAddOpen ? 'Add Plan Template' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
