import { useEffect } from 'react';
import { X, CheckCircle2, Loader2, Clock } from 'lucide-react';
import type { SessionTodo, TodoItem } from '../types';

interface SessionTodoPanelProps {
  sessions: SessionTodo[];
  onClose: () => void;
}

export default function SessionTodoPanel({ sessions, onClose }: SessionTodoPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const totalItems = sessions.reduce((sum, s) => sum + s.items.length, 0);
  const totalActive = sessions.reduce(
    (sum, s) => sum + s.items.filter(i => i.status === 'in_progress').length, 0
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(4,6,8,0.6)',
          zIndex: 99,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        right: 0, top: 0, bottom: 0,
        width: '400px',
        zIndex: 100,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--border-bright)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-in-right 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--surface-1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '9px', color: 'var(--text-muted)',
              letterSpacing: '0.15em', fontFamily: 'var(--font-mono)',
            }}>
              SESSION TODOS
            </span>
            <span style={{
              fontSize: '9px',
              color: totalActive > 0 ? 'var(--amber)' : 'var(--text-muted)',
              background: totalActive > 0 ? 'var(--amber-glow)' : 'var(--surface-2)',
              border: `1px solid ${totalActive > 0 ? 'var(--amber-dim)' : 'var(--border)'}`,
              borderRadius: '2px', padding: '1px 6px',
              fontFamily: 'var(--font-mono)',
            }}>
              {totalActive} active / {totalItems} total
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <div style={{
              padding: '40px', textAlign: 'center',
              fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em',
            }}>
              — NO ACTIVE TODO SESSIONS —
            </div>
          ) : (
            sessions.map(session => (
              <SessionBlock key={session.sessionId} session={session} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function SessionBlock({ session }: { session: SessionTodo }) {
  const activeCount = session.items.filter(i => i.status === 'in_progress').length;
  const doneCount   = session.items.filter(i => i.status === 'completed').length;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Session header */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)', letterSpacing: '0.1em',
        }}>
          SESSION // {session.shortId}
        </span>
        <span style={{
          fontSize: '9px', color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
        }}>
          {doneCount}/{session.items.length} done
          {activeCount > 0 && (
            <span style={{ color: 'var(--amber)', marginLeft: '6px' }}>
              · {activeCount} active
            </span>
          )}
        </span>
      </div>

      {/* Todo items */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {session.items.map((item, idx) => (
          <TodoRow key={idx} item={item} />
        ))}
      </div>
    </div>
  );
}

function TodoRow({ item }: { item: TodoItem }) {
  const isActive  = item.status === 'in_progress';
  const isDone    = item.status === 'completed';
  const textColor = isDone ? 'var(--text-muted)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {isDone    && <CheckCircle2 size={12} style={{ color: 'var(--phosphor)' }} />}
        {isActive  && <Loader2 size={12} style={{ color: 'var(--amber)', animation: 'spin-slow 2.5s linear infinite' }} />}
        {!isDone && !isActive && <Clock size={12} style={{ color: '#4a6070' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '11px', color: textColor,
          lineHeight: 1.5, letterSpacing: '0.02em',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {item.content}
        </div>
        {isActive && item.activeForm && item.activeForm !== item.content && (
          <div style={{
            fontSize: '9px', color: 'var(--amber)',
            letterSpacing: '0.06em', marginTop: '2px', fontStyle: 'italic',
          }}>
            ▸ {item.activeForm}
          </div>
        )}
      </div>
    </div>
  );
}
