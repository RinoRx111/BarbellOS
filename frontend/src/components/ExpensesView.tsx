import React, { useState, useEffect } from 'react';
import { Plus, Trash, Calendar, FileText } from 'lucide-react';
import api from '../services/api';
import { StatusTabs } from './SharedComponents';

interface Expense {
  id: number;
  category: 'rent' | 'equipment' | 'salary' | 'utilities' | 'maintenance' | 'other';
  amount: number;
  date: string;
  note: string | null;
}

export const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Add Fields
  const [category, setCategory] = useState<'rent' | 'equipment' | 'salary' | 'utilities' | 'maintenance' | 'other'>('maintenance');
  const [amount, setAmount] = useState<number>(0);
  const [dateVal, setDateVal] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  const fetchExpenses = async () => {
    try {
      const res = await api.get<Expense[]>('/expenses');
      setExpenses(res);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve expenses logs.');
    }
  };

  useEffect(() => {
    fetchExpenses().then(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/expenses', {
        category,
        amount,
        date: dateVal,
        note: note || undefined
      });
      setIsAddOpen(false);
      resetForm();
      await fetchExpenses();
    } catch (err: any) {
      setError('Failed to log expense record.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this expense log?')) {
      return;
    }
    try {
      await api.delete(`/expenses/${id}`);
      await fetchExpenses();
    } catch (err: any) {
      setError('Failed to delete expense entry.');
    }
  };

  const resetForm = () => {
    setCategory('maintenance');
    setAmount(0);
    setDateVal(new Date().toISOString().split('T')[0]);
    setNote('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Expenses...</p>
      </div>
    );
  }

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'rent': return 'rgba(59, 130, 246, 0.15)'; // Blue
      case 'equipment': return 'rgba(16, 185, 129, 0.15)'; // Green
      case 'salary': return 'rgba(167, 139, 250, 0.15)'; // Purple
      case 'utilities': return 'rgba(245, 158, 11, 0.15)'; // Amber
      case 'maintenance': return 'rgba(239, 68, 68, 0.15)'; // Red
      default: return 'rgba(255, 255, 255, 0.05)';
    }
  };

  const filteredExpenses = expenses.filter(e => {
    return filterCategory === 'all' ? true : e.category === filterCategory;
  });

  const categoryCounts = {
    all: expenses.length,
    rent: expenses.filter(e => e.category === 'rent').length,
    equipment: expenses.filter(e => e.category === 'equipment').length,
    salary: expenses.filter(e => e.category === 'salary').length,
    utilities: expenses.filter(e => e.category === 'utilities').length,
    maintenance: expenses.filter(e => e.category === 'maintenance').length,
    other: expenses.filter(e => e.category === 'other').length,
  };

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

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Operating Expenses</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Record bills, maintenance, salaries and rent to calculate net profits</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Category Filter Tabs */}
          <StatusTabs
            activeTab={filterCategory}
            tabs={[
              { value: 'all', label: 'All' },
              { value: 'rent', label: 'Rent' },
              { value: 'equipment', label: 'Equipment' },
              { value: 'salary', label: 'Salary' },
              { value: 'utilities', label: 'Utilities' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'other', label: 'Other' }
            ]}
            counts={categoryCounts}
            onChange={(val) => setFilterCategory(val)}
          />

          {/* Results counter */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong>{filteredExpenses.length}</strong> of <strong>{expenses.length}</strong> results
          </div>

          <div style={{ flex: 1 }} />

          {/* Prominent Log Expense button */}
          <button
            onClick={() => { resetForm(); setIsAddOpen(true); }}
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
            Log Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Expense Category</th>
              <th>Details / Memo</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  No expense records logged for this category.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: getCategoryColor(expense.category),
                      color: '#fff',
                      fontSize: '0.7rem'
                    }}>
                      {expense.category}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ color: expense.note ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {expense.note || 'No memo added'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--accent-danger)' }}>
                      ₹{expense.amount.toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="btn btn-flat"
                      style={{ padding: '0.4rem', borderRadius: '50%', color: 'var(--accent-danger)', borderColor: 'transparent' }}
                    >
                      <Trash size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


      {/* --- RECORD EXPENSE MODAL --- */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>Record Expense Entry</h3>
              <button onClick={() => setIsAddOpen(false)} className="modal-close">✕</button>
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Expense Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="maintenance">Maintenance & Repairs (Cleaning, AC service, etc.)</option>
                  <option value="rent">Building Rent</option>
                  <option value="equipment">Purchase Equipment / Gear</option>
                  <option value="salary">Trainer / Staff Salaries</option>
                  <option value="utilities">Utilities (Electricity, Water, WiFi)</option>
                  <option value="other">Other Operations Cost</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Amount Spent (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 1500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expense Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateVal}
                    onChange={(e) => setDateVal(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Memo / Notes (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Serviced reception AC"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Save Expense Record
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
