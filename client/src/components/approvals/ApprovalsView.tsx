import { useTranslation } from 'react-i18next';
import { Shield, Clock, Terminal, User, AlertTriangle } from 'lucide-react';
import type { PermissionRequest } from '../../types';
import { agentColor } from '../../utils/agentColors';

interface ApprovalsViewProps {
  permissionRequests: PermissionRequest[];
  resolvingId: string | null;
  onResolve: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
  onOpenDetails: (request: PermissionRequest) => void;
}

export default function ApprovalsView({
  permissionRequests,
  resolvingId,
  onResolve,
  onOpenDetails,
}: ApprovalsViewProps) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Shield size={14} style={{ color: 'var(--phosphor)' }} />
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--phosphor)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '0 0 10px var(--phosphor-glow)',
        }}>
          {t('approvals.title', 'Permission Requests')}
        </span>
        {permissionRequests.length > 0 && (
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--amber)',
            background: 'rgba(255, 191, 0, 0.1)',
            border: '1px solid rgba(255, 191, 0, 0.25)',
            borderRadius: '8px',
            padding: '1px 8px',
            letterSpacing: '0.08em',
          }}>
            {permissionRequests.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {permissionRequests.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)',
        }}>
          <Shield size={32} style={{ opacity: 0.2 }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
            {t('approvals.empty', 'No pending permission requests')}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
            {t('approvals.empty_sub', 'Requests will appear here when agents need your approval')}
          </span>
        </div>
      )}

      {/* Request list */}
      {permissionRequests.length > 0 && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {permissionRequests.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              resolving={resolvingId === req.id}
              onResolve={onResolve}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  resolving,
  onResolve,
  onOpenDetails,
}: {
  request: PermissionRequest;
  resolving: boolean;
  onResolve: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
  onOpenDetails: (request: PermissionRequest) => void;
}) {
  const { t } = useTranslation();
  const color = request.agentName ? agentColor(request.agentName) : 'var(--text-secondary)';

  const now = Date.now();
  const expiresAt = new Date(request.expiresAt).getTime();
  const remaining = Math.max(0, expiresAt - now);
  const isExpired = remaining <= 0;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div
      id={`approval-req-${request.id}`}
      style={{
        background: 'var(--surface-0)',
        border: `1px solid ${isExpired ? 'var(--text-muted)' : 'var(--amber)'}`,
        borderRadius: '4px',
        padding: '14px 16px',
        opacity: isExpired ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Top row: agent + tool + expiry */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '10px',
        flexWrap: 'wrap',
      }}>
        {request.agentName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <User size={12} style={{ color }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color, letterSpacing: '0.04em' }}>
              {request.agentName}
            </span>
          </div>
        )}
        {request.toolName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
          }}>
            <Terminal size={10} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {request.toolName}
            </span>
          </div>
        )}
        <span style={{ flex: 1 }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: 'var(--text-xs)',
          color: isExpired ? 'var(--crimson, #ff4466)' : 'var(--amber)',
          letterSpacing: '0.08em',
        }}>
          <Clock size={10} />
          <span>
            {isExpired
              ? t('approval.expired')
              : t('approval.expires_in', { minutes, seconds })
            }
          </span>
        </div>
      </div>

      {/* Reason */}
      {request.reason && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '10px',
          padding: '6px 8px',
          background: 'var(--surface-1)',
          borderRadius: '3px',
          borderLeft: '2px solid var(--border)',
        }}>
          {request.reason}
        </div>
      )}

      {/* Command preview */}
      {request.command && (
        <pre style={{
          margin: '0 0 10px',
          padding: '8px 10px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          color: 'var(--amber)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          maxHeight: '80px',
        }}>
          {request.command}
        </pre>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => onOpenDetails(request)}
          style={{
            padding: '4px 10px',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {t('approval.details')}
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => onResolve(request.id, 'deny')}
          disabled={resolving || isExpired}
          style={{
            padding: '4px 12px',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            background: 'transparent',
            color: 'var(--crimson, #ff4466)',
            border: '1px solid var(--crimson, #ff4466)',
            borderRadius: '3px',
            cursor: resolving || isExpired ? 'default' : 'pointer',
            opacity: resolving || isExpired ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {t('approval.deny')}
        </button>
        <button
          onClick={() => onResolve(request.id, 'approve')}
          disabled={resolving || isExpired}
          style={{
            padding: '4px 16px',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.1em',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            background: 'var(--active-bg-med)',
            color: 'var(--phosphor)',
            border: '1px solid var(--phosphor)',
            borderRadius: '3px',
            cursor: resolving || isExpired ? 'default' : 'pointer',
            opacity: resolving || isExpired ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {resolving ? '...' : t('approval.approve')}
        </button>
      </div>
    </div>
  );
}
