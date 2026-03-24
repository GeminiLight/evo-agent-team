import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PermissionRequest } from '../../types';

interface ApprovalModalProps {
  request: PermissionRequest;
  resolving: boolean;
  onDecision: (decision: 'approve' | 'deny') => void;
}

export default function ApprovalModal({ request, resolving, onDecision }: ApprovalModalProps) {
  const { t } = useTranslation();
  const [expiryTime, setExpiryTime] = useState<string>('');
  const [payloadExpanded, setPayloadExpanded] = useState(false);

  useEffect(() => {
    function updateExpiry() {
      const now = Date.now();
      const expiresAt = new Date(request.expiresAt).getTime();
      const remaining = Math.max(0, expiresAt - now);

      if (remaining <= 0) {
        setExpiryTime('Expired');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setExpiryTime(`Expires in ${minutes}m ${seconds}s`);
    }

    updateExpiry();
    const interval = setInterval(updateExpiry, 1000);
    return () => clearInterval(interval);
  }, [request.expiresAt]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (resolving) return;
      if (e.key === 'Escape') onDecision('deny');
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDecision, resolving]);

  const payloadEntries = request.requestPayload ? Object.entries(request.requestPayload).filter(([key]) => {
    return !['teamId', 'agentName', 'toolName', 'cwd', 'reason', 'command'].includes(key);
  }) : [];

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay-backdrop)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Permission request approval"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--crimson)',
          borderRadius: '4px',
          padding: '24px',
          minWidth: 'min(520px, 92vw)',
          maxWidth: '720px',
          width: '92vw',
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--crimson)', textTransform: 'uppercase', marginBottom: '8px' }}>
            {t('approval.title')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {request.agentName || 'Agent'} wants permission to run {request.toolName || 'a tool'}.
          </div>
        </div>

        <div style={{ fontSize: '9px', color: 'var(--amber)', marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {expiryTime}
        </div>

        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px', padding: '12px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '3px' }}>
          {request.teamId && <InfoRow label={t('approval.team')} value={request.teamId} />}
          {request.agentName && <InfoRow label={t('approval.agent')} value={request.agentName} />}
          {request.toolName && <InfoRow label={t('approval.tool')} value={request.toolName} />}
          {request.cwd && <InfoRow label={t('approval.cwd')} value={request.cwd} />}
          {request.reason && <InfoRow label={t('approval.reason')} value={request.reason} />}
        </div>

        {request.command && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              {t('approval.command')}
            </div>
            <pre style={{ margin: 0, padding: '12px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--amber)', fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {request.command}
            </pre>
          </div>
        )}

        {payloadEntries.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setPayloadExpanded(!payloadExpanded)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '9px',
                letterSpacing: '0.12em',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              {payloadExpanded ? '▼' : '▶'} Additional Data
            </button>
            {payloadExpanded && (
              <div style={{ padding: '12px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '3px', display: 'grid', gap: '6px' }}>
                {payloadEntries.map(([key, value]) => (
                  <InfoRow key={key} label={key} value={String(value)} />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => onDecision('deny')}
            disabled={resolving}
            style={{
              padding: '6px 14px',
              fontSize: '9px',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono)',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              cursor: resolving ? 'default' : 'pointer',
            }}
          >
            <span style={{ textTransform: 'uppercase' }}>{t('approval.deny')}</span>
          </button>
          <button
            onClick={() => onDecision('approve')}
            disabled={resolving}
            style={{
              padding: '6px 18px',
              fontSize: '9px',
              letterSpacing: '0.12em',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: 'var(--active-bg-med)',
              color: 'var(--phosphor)',
              border: '1px solid var(--phosphor)',
              borderRadius: '3px',
              cursor: resolving ? 'default' : 'pointer',
              opacity: resolving ? 0.6 : 1,
            }}
          >
            <span style={{ textTransform: 'uppercase' }}>{resolving ? '...' : t('approval.approve')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ minWidth: '64px', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.04em', lineHeight: 1.5, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
