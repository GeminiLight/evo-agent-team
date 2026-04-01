import type { TaskChangeEvent } from '../../types';
import { STATUS_COLORS } from '../../utils/statusColors';
import { agentColor, agentInitials, agentAvatarStyle } from '../../utils/agentColors';

const STATUS_LABELS: Record<string, string> = {
  pending:     'PENDING',
  in_progress: 'ACTIVE',
  completed:   'DONE',
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
  if (!colors) return null;
  return (
    <span style={{
      fontSize: 'var(--text-xs)',
      letterSpacing: '0.1em',
      color: colors.text,
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      padding: '1px 5px',
      borderRadius: '2px',
    }}>
      {STATUS_LABELS[status] ?? status.toUpperCase()}
    </span>
  );
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

interface TimelineEventProps {
  event: TaskChangeEvent;
}

export default function TimelineEvent({ event }: TimelineEventProps) {
  const dotColor = STATUS_COLORS[event.newStatus as keyof typeof STATUS_COLORS]?.border ?? 'var(--text-muted)';
  const ownerColor = event.owner ? agentColor(event.owner) : undefined;
  const avatarStyle = event.owner ? agentAvatarStyle(event.owner) : undefined;

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {/* Vertical line + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '12px' }}>
        <div style={{
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          flexShrink: 0,
          marginTop: '3px',
        }} />
        <div style={{
          width: '1px',
          flex: 1,
          background: 'var(--border)',
          minHeight: '20px',
          marginTop: '3px',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: '10px' }}>
        {/* Row 1: timestamp + task id + subject */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em', flexShrink: 0 }}>
            {formatTs(event.timestamp)}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>#{event.taskId}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            {event.taskSubject}
          </span>
        </div>

        {/* Row 2: status transition */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: event.owner ? '5px' : 0 }}>
          {event.oldStatus === null ? (
            <span style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.12em',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '1px 5px',
              borderRadius: '2px',
            }}>
              FIRST SEEN
            </span>
          ) : (
            <>
              <StatusBadge status={event.oldStatus} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>→</span>
            </>
          )}
          <StatusBadge status={event.newStatus} />
        </div>

        {/* Row 3: owner with colored avatar badge */}
        {event.owner && ownerColor && avatarStyle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '18px', height: '18px',
              borderRadius: '3px',
              fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
              ...avatarStyle,
            }}>
              {agentInitials(event.owner)}
            </div>
            <span style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.08em',
              color: ownerColor,
              fontFamily: 'var(--font-mono)',
            }}>
              {event.owner}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
