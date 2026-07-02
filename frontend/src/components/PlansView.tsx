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
      const res = await api.get<Plan[]>('/plans');
      setPlans(res);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem' }}>Membership Plan Templates</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Set pricing and durations for subscription packages</p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <Plus size={16} />
          Create Plan Tier
        </button>
      </div>

      {/* Plan Grid */}
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
