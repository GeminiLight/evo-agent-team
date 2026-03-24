import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import type { PermissionRequest } from '../../types';
import ApprovalModal from '../shared/ApprovalModal';

interface ApprovalPanelProps {
  requests: PermissionRequest[];
  resolvingId: string | null;
  onResolve: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
}

export default function ApprovalPanel({ requests, resolvingId, onResolve }: ApprovalPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PermissionRequest | null>(null);
  const [expiryTimes, setExpiryTimes] = useState<Record<string, string>>({});

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
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('dashboard.pending_requests', { count: requests.length })}
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: 'var(--surface-0)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  borderLeft: '2px solid var(--crimson)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {req.agentName || 'Agent'} → {req.toolName || 'Tool'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                    {req.reason ? `${req.reason.substring(0, 50)}…` : 'No reason'}
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
                    fontSize: '9px',
                  }}
                >
                  <Clock size={12} />
                  {expiryTimes[req.id] || '—'}
                </div>

                {/* Quick buttons */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={async () => {
                      const success = await onResolve(req.id, 'approve');
                      if (success) setSelectedRequest(null);
                    }}
                    disabled={resolvingId === req.id}
                    style={{
                      padding: '4px 8px',
                      fontSize: '9px',
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
                    {resolvingId === req.id ? '...' : 'OK'}
                  </button>
                  <button
                    onClick={async () => {
                      const success = await onResolve(req.id, 'deny');
                      if (success) setSelectedRequest(null);
                    }}
                    disabled={resolvingId === req.id}
                    style={{
                      padding: '4px 8px',
                      fontSize: '9px',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      cursor: resolvingId === req.id ? 'default' : 'pointer',
                      opacity: resolvingId === req.id ? 0.6 : 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => setSelectedRequest(req)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '9px',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for detailed view */}
      {selectedRequest && (
        <ApprovalModal
          request={selectedRequest}
          resolving={resolvingId === selectedRequest.id}
          onDecision={async (decision) => {
            const success = await onResolve(selectedRequest.id, decision);
            if (success) {
              setSelectedRequest(null);
            }
          }}
        />
      )}
    </>
  );
}
