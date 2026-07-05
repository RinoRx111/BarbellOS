import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, Check, X, ShieldAlert, Sparkles, Plus, Trash2, Edit3 } from 'lucide-react';
import api from '../services/api';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  executed_tools?: string[];
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

  // Entities lists for pill matching
  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [activeContext, setActiveContext] = useState<{ memberId: number; name: string } | null>(null);

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
    api.get<any[]>('/members').then(setMembers).catch(() => {});
    api.get<any[]>('/plans').then(setPlans).catch(() => {});

    // Check saved context
    const saved = localStorage.getItem('barbellos_active_chat_context');
    if (saved) {
      try {
        setActiveContext(JSON.parse(saved));
      } catch {}
    }

    const handleContextUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveContext(customEvent.detail);
      }
    };
    window.addEventListener('change-tab-context', handleContextUpdate);

    return () => {
      window.removeEventListener('change-tab-context', handleContextUpdate);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction, loading]);

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

      // Append context details if active
      const queryPayload = activeContext 
        ? `[Context Member: ${activeContext.name}] ${userText}`
        : userText;

      const res = await api.post<any>('/ai/chat', { 
        message: queryPayload,
        session_id: currentSessionId
      });
      
      if (res.status === 'text') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: res.content,
          executed_tools: res.executed_tools
        }]);
      } else if (res.status === 'requires_confirmation') {
        setPendingAction({
          action: res.action,
          params: res.params,
          confirm_id: res.confirm_id,
          executed_tools: res.executed_tools
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

  const getToolCallLabel = (toolName: string) => {
    switch (toolName) {
      case 'get_revenue_summary': return 'Calculating revenue for the selected period';
      case 'get_expenses_summary': return 'Analyzing expense logs and summaries';
      case 'get_active_members': return 'Retrieving active membership count';
      case 'get_expiring_members': return 'Checking which memberships are expiring';
      case 'get_attendance_trend': return 'Analyzing scanner attendance check-ins';
      case 'freeze_member': return 'Preparing a freeze request for review';
      case 'log_payment': return 'Preparing subscription payment registration';
      case 'add_member': return 'Preparing new member registration details';
      default: return `Running tool execution (${toolName})`;
    }
  };

  const clearContext = () => {
    setActiveContext(null);
    localStorage.removeItem('barbellos_active_chat_context');
  };

  // Timeline Renderer
  const renderTimeline = (tools?: string[]) => {
    if (!tools || tools.length === 0) return null;
    return (
      <div style={{
        marginTop: '6px',
        marginBottom: '8px',
        padding: '0.5rem 0.75rem',
        background: 'rgba(0,0,0,0.18)',
        border: 'var(--border-glass)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: 'fit-content',
        maxWidth: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          <Cpu size={12} style={{ color: 'var(--accent-primary)' }} />
          <strong>Reasoning steps resolved:</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '8px', marginLeft: '5px' }}>
          {tools.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-success)' }} />
              <span>{getToolCallLabel(t)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBoldText = (text: string) => {
    const regex = /(\*\*.*?\*\*|₹\d+(?:,\d+)*(?:\.\d+)?|\d+\s*(?:days|min|hours|results|members)?)/gi;
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
      }
      if (/^(?:₹\d|\d+)/i.test(part)) {
        return <strong key={idx} style={{ color: '#fff' }}>{part}</strong>;
      }
      return part;
    });
  };

  const formatAssistantResponse = (text: string) => {
    const entities: { name: string; type: 'member' | 'plan'; id?: number }[] = [];
    
    plans.forEach(p => {
      if (p.name && text.toLowerCase().includes(p.name.toLowerCase())) {
        entities.push({ name: p.name, type: 'plan' });
      }
    });

    members.forEach(m => {
      if (m.name && text.toLowerCase().includes(m.name.toLowerCase())) {
        entities.push({ name: m.name, type: 'member', id: m.id });
      }
    });

    entities.sort((a, b) => b.name.length - a.name.length);

    if (entities.length === 0) {
      return renderBoldText(text);
    }

    let processedText = text;
    const replacementMap: Record<string, typeof entities[0]> = {};
    entities.forEach((ent, index) => {
      const escapedName = ent.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      const key = `__ENTITY_${index}__`;
      processedText = processedText.replace(regex, (match) => {
        replacementMap[key] = { ...ent, name: match };
        return key;
      });
    });

    const tokens = processedText.split(/(__ENTITY_\d+__)/);
    return tokens.map((tok, i) => {
      if (tok.startsWith('__ENTITY_') && tok.endsWith('__') && replacementMap[tok]) {
        const ent = replacementMap[tok];
        const isMember = ent.type === 'member';
        return (
          <span
            key={i}
            onClick={() => {
              if (isMember) {
                window.dispatchEvent(new CustomEvent('change-tab', { detail: 'members' }));
                if (ent.id) {
                  localStorage.setItem('barbellos_open_member_file', String(ent.id));
                  window.dispatchEvent(new CustomEvent('open-member-file', { detail: ent.id }));
                }
              } else {
                window.dispatchEvent(new CustomEvent('change-tab', { detail: 'plans' }));
              }
            }}
            className="badge"
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              margin: '0 2px',
              padding: '0.15rem 0.4rem',
              fontSize: '0.75rem',
              background: isMember ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: isMember ? 'var(--accent-primary)' : 'var(--accent-success)',
              border: isMember ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(16,185,129,0.3)',
              borderRadius: '10px',
              fontWeight: '600'
            }}
          >
            {ent.name}
          </span>
        );
      }
      return renderBoldText(tok);
    });
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
                lineHeight: '1.4'
              }}
            >
              {m.role === 'assistant' && renderTimeline(m.executed_tools)}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {m.role === 'assistant' ? formatAssistantResponse(m.content) : m.content}
              </div>
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
              {renderTimeline(pendingAction.executed_tools)}
              
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

        {/* Input Form with Scope Context Selector */}
        <form onSubmit={handleSend} style={{
          padding: '1rem',
          borderTop: 'var(--border-glass)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {/* Scope Indicator Chip */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              background: activeContext ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
              color: activeContext ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: activeContext ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255,255,255,0.05)',
              fontWeight: '500'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeContext ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <span>Scope: {activeContext ? activeContext.name : 'General Context'}</span>
              {activeContext && (
                <button
                  type="button"
                  onClick={clearContext}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.75rem',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  ✕
                </button>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder={activeContext ? `Ask about member ${activeContext.name}...` : "Ask a question or request action..."}
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
          </div>
        </form>
      </div>
    </div>
  );
};
