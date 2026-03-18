import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentRespond } from '../../hooks/useAgentRespond';

interface RespondModalProps {
  agentName: string;
  toolName?: string;
  detail?: string;
  teamId: string;
  onClose: () => void;
}

export default function RespondModal({ agentName, toolName, detail, teamId, onClose }: RespondModalProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const { respond, sending, error, clearError } = useAgentRespond(teamId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDemo = teamId === 'demo-team';

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSend = async () => {
    if (!text.trim() || sending || sent) return;
    const ok = await respond(agentName, text);
    if (ok) {
      setSent(true);
      setTimeout(onClose, 800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay-backdrop)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Respond to agent"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '24px',
          minWidth: 'min(420px, 90vw)',
          maxWidth: '560px',
          width: '90vw',
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          animation: 'fade-up 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('respond.title')}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1, padding: '2px 4px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>

        {/* Agent info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px', padding: '10px 12px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '3px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', minWidth: '52px', textTransform: 'uppercase' }}>{t('respond.agent')}</span>
            <span style={{ fontSize: '9px', color: 'var(--phosphor)', letterSpacing: '0.06em' }}>{agentName}</span>
          </div>
          {toolName && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', minWidth: '52px', textTransform: 'uppercase' }}>{t('respond.tool')}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{toolName}</span>
            </div>
          )}
          {detail && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', minWidth: '52px', textTransform: 'uppercase' }}>{t('respond.context')}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.04em', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {detail.slice(0, 200)}
              </span>
            </div>
          )}
        </div>

        {/* Demo warning */}
        {isDemo && (
          <div style={{ marginBottom: '12px', padding: '7px 10px', background: 'var(--amber-bg-subtle)', border: '1px solid var(--amber-dim)', borderRadius: '3px', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.06em' }}>
            {t('respond.demo_unavailable')}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); clearError(); }}
          onKeyDown={handleKeyDown}
          disabled={sending || sent || isDemo}
          placeholder={sent ? '✓ Response sent' : 'Type your response...  (Ctrl+Enter to send)'}
          rows={4}
          style={{
            width: '100%',
            background: 'var(--surface-2)',
            border: `1px solid ${error ? 'var(--crimson)' : 'var(--border)'}`,
            borderRadius: '3px',
            color: sent ? 'var(--phosphor)' : 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.02em',
            padding: '8px 10px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            opacity: (sending || isDemo) ? 0.6 : 1,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { if (!error) e.target.style.borderColor = 'var(--phosphor)'; }}
          onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)'; }}
        />

        {/* Error */}
        {error && (
          <div style={{ marginTop: '6px', fontSize: '9px', color: 'var(--crimson)', letterSpacing: '0.06em' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '5px 14px', fontSize: '9px', letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono)',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '3px', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span style={{ textTransform: 'uppercase' }}>{t('respond.cancel')}</span>
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || sent || isDemo}
            style={{
              padding: '5px 18px', fontSize: '9px', letterSpacing: '0.12em', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: sent ? 'var(--phosphor-bg-subtle)' : 'var(--active-bg-med)',
              color: sent ? 'var(--phosphor)' : 'var(--phosphor)',
              border: '1px solid var(--phosphor)',
              borderRadius: '3px',
              cursor: (!text.trim() || sending || sent || isDemo) ? 'default' : 'pointer',
              opacity: (!text.trim() || sending || isDemo) && !sent ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <span style={{ textTransform: 'uppercase' }}>{sent ? t('respond.sent') : sending ? '...' : t('respond.send')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
