import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, Check, X, ShieldAlert, Sparkles, Plus, Trash2, Edit3 } from 'lucide-react';
import api from '../services/api';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
}

interface AiChatDrawerProps {
  onClose: () => void;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({ onClose }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async (selectFirst = false) => {
    try {
      const res = await api.get<ChatSession[]>('/ai/sessions');
      setSessions(res);
      if (res.length > 0 && (selectFirst || currentSessionId === null)) {
        setCurrentSessionId(res[0].id);
        fetchHistory(res[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  };

  const fetchHistory = async (sessionId: number) => {
    try {
      const history = await api.get<Message[]>(`/ai/history?session_id=${sessionId}`);
      setMessages(history);
      setPendingAction(null);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  useEffect(() => {
    fetchSessions(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  const handleSelectSession = (id: number) => {
    if (loading) return;
    setCurrentSessionId(id);
    fetchHistory(id);
  };

  const handleCreateSession = async () => {
    if (loading) return;
    try {
      const newSess = await api.post<ChatSession>('/ai/sessions', { title: 'New Chat' });
      setSessions(prev => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setMessages([]);
      setPendingAction(null);
    } catch (e) {
      console.error("Failed to create new session", e);
    }
  };

  const handleStartRename = (sess: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditTitle(sess.title);
  };

  const handleSaveRename = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    try {
      await api.put(`/ai/sessions/${id}`, { title: editTitle.trim() });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s));
      setEditingSessionId(null);
    } catch (e) {
      console.error("Failed to rename session", e);
    }
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat session? All its messages will be permanently deleted.")) {
      return;
    }
    try {
      await api.delete(`/ai/sessions/${id}`);
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      if (currentSessionId === id) {
        if (updated.length > 0) {
          setCurrentSessionId(updated[0].id);
          fetchHistory(updated[0].id);
        } else {
          handleCreateSession();
        }
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || currentSessionId === null) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const currentSess = sessions.find(s => s.id === currentSessionId);
      const isNewChat = currentSess?.title === 'New Chat';

      const res = await api.post<any>('/ai/chat', { 
        message: userText,
        session_id: currentSessionId
      });
      
      if (res.status === 'text') {
        setMessages(prev => [...prev, { role: 'assistant', content: res.content }]);
      } else if (res.status === 'requires_confirmation') {
        setPendingAction({
          action: res.action,
          params: res.params,
          confirm_id: res.confirm_id
        });
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: res.message || 'An error occurred.' }]);
      }

      if (isNewChat) {
        fetchSessions();
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
        confirm_id: pendingAction.confirm_id
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
      width: '560px',
      height: '100%',
      borderRadius: '0',
      borderLeft: 'var(--border-glass)',
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: 'none',
      background: '#0B0F19',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      display: 'flex',
      zIndex: 100
    }}>
      {/* Sessions Sidebar */}
      <div style={{
        width: '190px',
        background: '#07090F',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem 0.65rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', paddingLeft: '0.25rem' }}>
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>Past Chats</span>
        </div>

        <button 
          onClick={handleCreateSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px dashed rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-primary)',
            padding: '0.5rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '1rem',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>

        {/* Scrollable session list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sessions.map(s => {
            const isActive = s.id === currentSessionId;
            const isEditing = s.id === editingSessionId;

            return (
              <div
                key={s.id}
                onClick={() => !isEditing && handleSelectSession(s.id)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.2s'
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(s.id, e as any);
                        if (e.key === 'Escape') handleCancelRename(e as any);
                      }}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.3rem',
                        height: 'auto',
                        background: '#0B0F19',
                        color: '#fff',
                        border: '1px solid var(--accent-primary)',
                        width: '75%',
                        outline: 'none'
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Check 
                      size={12} 
                      onClick={(e) => handleSaveRename(s.id, e)} 
                      style={{ color: 'var(--accent-success)', flexShrink: 0 }} 
                    />
                    <X 
                      size={12} 
                      onClick={handleCancelRename} 
                      style={{ color: 'var(--accent-danger)', flexShrink: 0 }} 
                    />
                  </div>
                ) : (
                  <>
                    <span style={{
                      fontSize: '0.75rem',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginRight: '8px',
                      flex: 1
                    }}>
                      {s.title}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <Edit3 
                        size={11} 
                        onClick={(e) => handleStartRename(s, e)}
                        style={{ color: 'var(--text-muted)', opacity: isActive ? 0.7 : 0.3 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = isActive ? '0.7' : '0.3'}
                      />
                      <Trash2 
                        size={11} 
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        style={{ color: 'var(--text-muted)', opacity: isActive ? 0.7 : 0.3 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = isActive ? '0.7' : '0.3'}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
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
            <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
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
              <Sparkles size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
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
            disabled={loading || pendingAction !== null || currentSessionId === null}
            style={{ flex: 1, fontSize: '0.85rem' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim() || pendingAction !== null || currentSessionId === null}
            style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
