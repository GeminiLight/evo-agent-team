import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import type { PermissionRequest } from '../../types';

const STORAGE_KEY = 'approval-panel-collapsed';

interface ApprovalPanelProps {
  requests: PermissionRequest[];
  resolvingId: string | null;
  onResolve: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
  onOpenDetails?: (request: PermissionRequest) => void;
}

export default function ApprovalPanel({ requests, resolvingId, onResolve, onOpenDetails }: ApprovalPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [expiryTimes, setExpiryTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* noop */ }
  }, [collapsed]);

  // Update expiry countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newTimes: Record<string, string> = {};

      for (const req of requests) {
        const expiresAt = new Date(req.expiresAt).getTime();
        const remaining = Math.max(0, expiresAt - now);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        newTimes[req.id] = `${minutes}m ${seconds}s`;
      }

      setExpiryTimes(newTimes);
    }, 1000);

    return () => clearInterval(interval);
  }, [requests]);

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          marginBottom: '12px',
        }}
        data-tour="approvals"
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('approval.pending_requests', { count: requests.length })}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: collapsed ? 700 : 400 }}>
            {collapsed ? '▶' : '▼'}
          </span>
        </button>

        {/* List */}
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {requests.map(req => (
              <div
                key={req.id}
                id={`approval-req-${req.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: 'var(--surface-0)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  borderLeft: '2px solid var(--crimson)',
                  scrollMarginTop: '80px',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-0)'; }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {req.agentName || 'Agent'} → {req.toolName || 'Tool'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                    {req.reason ? `${req.reason.substring(0, 50)}…` : t('approval.no_reason')}
                  </div>
                </div>

                {/* Expiry countdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--amber)',
                    marginRight: '12px',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <Clock size={12} />
                  {expiryTimes[req.id] || '—'}
                </div>

                {/* Quick buttons */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={async () => {
                      await onResolve(req.id, 'approve');
                    }}
                    disabled={resolvingId === req.id}
                    style={{
                      padding: '4px 8px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      background: 'var(--active-bg-med)',
                      color: 'var(--phosphor)',
                      border: '1px solid var(--phosphor)',
                      borderRadius: '2px',
                      cursor: resolvingId === req.id ? 'default' : 'pointer',
                      opacity: resolvingId === req.id ? 0.6 : 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {resolvingId === req.id ? '...' : t('approval.ok')}
                  </button>
                  <button
                    onClick={async () => {
                      await onResolve(req.id, 'deny');
                    }}
                    disabled={resolvingId === req.id}
                    style={{
                      padding: '4px 8px',
                      fontSize: 'var(--text-xs)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      cursor: resolvingId === req.id ? 'default' : 'pointer',
                      opacity: resolvingId === req.id ? 0.6 : 1,
                      textTransform: 'uppercase',
                      transition: 'color 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (resolvingId !== req.id) {
                        e.currentTarget.style.color = 'var(--crimson)';
                        e.currentTarget.style.borderColor = 'var(--crimson)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (resolvingId !== req.id) {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                  >
                    {t('approval.deny')}
                  </button>
                  <button
                    onClick={() => onOpenDetails?.(req)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 'var(--text-xs)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {t('approval.details')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
