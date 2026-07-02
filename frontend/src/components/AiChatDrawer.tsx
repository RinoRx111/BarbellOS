import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import api from '../services/api';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

interface AiChatDrawerProps {
  onClose: () => void;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const history = await api.get<Message[]>('/ai/history');
      setMessages(history);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const res = await api.post<any>('/ai/chat', { message: userText });
      
      if (res.status === 'text') {
        setMessages(prev => [...prev, { role: 'assistant', content: res.content }]);
      } else if (res.status === 'requires_confirmation') {
        // AI proposed a write transaction
        setPendingAction({
          action: res.action,
          params: res.params
        });
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: res.message || 'An error occurred.' }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network failure or LLM key configurations missing. Please check your AI API key under Settings.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      const res = await api.post<any>('/ai/confirm', {
        action: pendingAction.action,
        params: pendingAction.params
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }]);
      setPendingAction(null);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Execution failed: ${e.detail || 'System error'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineAction = () => {
    setMessages(prev => [...prev, { role: 'assistant', content: "Proposed action discarded by manager." }]);
    setPendingAction(null);
  };

  const getActionTitle = (action: string) => {
    switch (action) {
      case 'freeze_member': return 'Freeze Membership Account';
      case 'log_payment': return 'Record Renewal Payment';
      case 'add_member': return 'Register Member Account';
      default: return 'Proposed Action';
    }
  };

  return (
    <div className="glass-panel" style={{
      width: 'var(--chat-drawer-width)',
      height: '100%',
      borderRadius: '0',
      borderLeft: 'var(--border-glass)',
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: 'none',
      background: '#0B0F19',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: 'var(--border-glass)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>AI Copilot Terminal</h3>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Online | Natural Language Actions</span>
          </div>
        </div>
        <button onClick={onClose} className="modal-close">✕</button>
      </div>

      {/* Message Feed Container */}
      <div style={{
        flex: 1,
        padding: '1.25rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>
            <Cpu size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
            <p>Welcome to your AI Copilot! Ask analytical questions or request actions like:<br/>
              <em>"Who is expiring in the next 7 days?"</em> or <em>"Freeze Rahul's account for 30 days starting tomorrow"</em>.
            </p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              border: m.role === 'user' ? '1px solid rgba(59, 130, 246, 0.3)' : 'var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.85rem',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap'
            }}
          >
            {m.content}
          </div>
        ))}

        {/* PROPOSED TRANSACTION CONFIRMATION CARD */}
        {pendingAction && (
          <div className="glass-panel" style={{
            alignSelf: 'flex-start',
            maxWidth: '90%',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.05)',
            boxShadow: 'var(--glow-warning)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-warning)', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <ShieldAlert size={16} />
              <span>{getActionTitle(pendingAction.action)}</span>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {Object.entries(pendingAction.params).map(([key, val]: any) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{key.replace('_', ' ')}:</span>
                  <span style={{ color: '#fff', fontWeight: 'bold', marginLeft: 'auto' }}>{String(val)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                onClick={handleConfirmAction}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', gap: '4px', background: 'var(--accent-success)', borderColor: 'transparent' }}
              >
                <Check size={12} />
                Approve & Run
              </button>
              <button
                onClick={handleDeclineAction}
                className="btn btn-flat"
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', gap: '4px', color: 'var(--accent-danger)' }}
              >
                <X size={12} />
                Decline
              </button>
            </div>
          </div>
        )}

        {loading && !pendingAction && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'rgba(255,255,255,0.02)',
            border: 'var(--border-glass)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem'
          }}>
            Copilot is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{
        padding: '1rem',
        borderTop: 'var(--border-glass)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        gap: '0.5rem'
      }}>
        <input
          type="text"
          className="form-control"
          placeholder="Ask a question or request action..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || pendingAction !== null}
          style={{ flex: 1, fontSize: '0.85rem' }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !input.trim() || pendingAction !== null}
          style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
