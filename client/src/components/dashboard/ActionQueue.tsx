import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Zap, X, MessageSquare } from 'lucide-react';
import type { Alert, TaskChangeEvent } from '../../types';
import type { BlockingDetail } from '../../hooks/usePendingHumanRequests';
import type { ViewType } from '../Layout';
import { STATUS_COLORS } from '../../utils/statusColors';
import RespondModal from '../shared/RespondModal';

interface ActionQueueProps {
  alerts: Alert[];
  pendingHumanDetails: BlockingDetail[];
  recentEvents: TaskChangeEvent[];
  teamId?: string;
  onDismissAlert: (id: string) => void;
  onViewChange: (view: ViewType) => void;
}

export default function ActionQueue({
  alerts, pendingHumanDetails, recentEvents, teamId, onDismissAlert, onViewChange,
}: ActionQueueProps) {
  const { t } = useTranslation();
  const isDemo = teamId === 'demo-team' || !teamId;
  const [respondAgent, setRespondAgent] = useState<BlockingDetail | null>(null);

  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings = alerts.filter(a => a.severity === 'warning');
  const infos = alerts.filter(a => a.severity === 'info');
  const nonCritical = [...warnings, ...infos];

  const needsAction = [...pendingHumanDetails.map(d => ({ type: 'human' as const, data: d })), ...criticals.map(a => ({ type: 'alert' as const, data: a }))];
  const hasContent = needsAction.length > 0 || nonCritical.length > 0 || recentEvents.length > 0;

  // Hide completely when nothing to show
  if (!hasContent) return null;

  return (
    <>
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        {/* Horizontal layout: sections flow left-to-right */}
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 0,
        }}>
          {/* Left: badge + label */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--surface-1)',
            display: 'flex', alignItems: 'center', gap: '6px',
            borderRight: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <Zap size={10} style={{ color: needsAction.length > 0 ? 'var(--amber)' : 'var(--phosphor)' }} />
            <span style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {t('action_queue.title')}
            </span>
            {needsAction.length > 0 && (
              <span style={{
                fontSize: 'var(--text-xs)', color: 'var(--amber)',
                background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)',
                borderRadius: '2px', padding: '1px 6px',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
              }}>
                {needsAction.length}
              </span>
            )}
          </div>

          {/* Scrollable content — horizontal flow */}
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 14px',
            overflowX: 'auto',
          }}>
            {/* Needs Action items */}
            {needsAction.map((item, i) => {
              if (item.type === 'human') {
                const d = item.data as BlockingDetail;
                return (
                  <HumanInputChip
                    key={`human-${d.name}`}
                    detail={d}
                    isDemo={isDemo}
                    onRespond={() => setRespondAgent(d)}
                  />
                );
              }
              const a = item.data as Alert;
              return <AlertChip key={a.id} alert={a} onDismiss={() => onDismissAlert(a.id)} />;
            })}

            {/* Non-critical alerts — inline */}
            {nonCritical.slice(0, 3).map(a => (
              <AlertChip key={a.id} alert={a} onDismiss={() => onDismissAlert(a.id)} />
            ))}
            {nonCritical.length > 3 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                +{nonCritical.length - 3} more
              </span>
            )}

            {/* Separator if both actions + events */}
            {(needsAction.length > 0 || nonCritical.length > 0) && recentEvents.length > 0 && (
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />
            )}

            {/* Recent events — compact inline */}
            {recentEvents.slice(0, 5).map(evt => (
              <EventChip key={evt.id} event={evt} />
            ))}
            {recentEvents.length > 5 && (
              <button
                onClick={() => onViewChange('timeline')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--text-xs)', color: 'var(--phosphor)', letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  opacity: 0.7, whiteSpace: 'nowrap', flexShrink: 0, padding: '2px 4px',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
              >
                +{recentEvents.length - 5} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Respond modal */}
      {respondAgent && teamId && (
        <RespondModal
          agentName={respondAgent.name}
          toolName={respondAgent.blocking.toolName}
          detail={respondAgent.blocking.detail}
          teamId={teamId}
          onClose={() => setRespondAgent(null)}
        />
      )}
    </>
  );
}

// ─── Horizontal chip components ──────────────────────────────────────────────

function HumanInputChip({ detail, isDemo, onRespond }: { detail: BlockingDetail; isDemo: boolean; onRespond: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px',
      background: 'var(--amber-glow)',
      border: '1px solid var(--amber-dim)',
      borderRadius: '3px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <MessageSquare size={10} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.03em' }}>
        {detail.name}
      </span>
      {detail.blocking.toolName && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {detail.blocking.toolName}
        </span>
      )}
      <button
        onClick={e => { e.stopPropagation(); if (!isDemo) onRespond(); }}
        style={{
          padding: '2px 8px', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          background: isDemo ? 'transparent' : 'var(--amber-bg-subtle)',
          color: isDemo ? 'var(--text-muted)' : 'var(--amber)',
          border: `1px solid ${isDemo ? 'var(--border)' : 'var(--amber-dim)'}`,
          borderRadius: '2px', cursor: isDemo ? 'default' : 'pointer',
          textTransform: 'uppercase',
        }}
      >
        {t('action_queue.respond')}
      </button>
    </div>
  );
}

function AlertChip({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const sevColor = alert.severity === 'critical' ? 'var(--crimson)' : alert.severity === 'warning' ? 'var(--amber)' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '3px 8px',
      borderRadius: '3px',
      border: '1px solid var(--border)',
      background: 'var(--surface-1)',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      maxWidth: '260px',
    }}>
      <AlertTriangle size={9} style={{ color: sevColor, flexShrink: 0 }} />
      <span style={{
        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', letterSpacing: '0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {alert.title}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: '1px', display: 'flex', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <X size={9} />
      </button>
    </div>
  );
}

function EventChip({ event }: { event: TaskChangeEvent }) {
  const { t } = useTranslation();
  const status = event.newStatus;
  const statusStyle = STATUS_COLORS[status === 'pending' ? 'pending' : status === 'in_progress' ? 'in_progress' : 'completed'];
  const statusLabel = status === 'completed' ? t('action_queue.event_completed')
    : status === 'in_progress' ? t('action_queue.event_started')
    : t('action_queue.event_created');
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
        {time}
      </span>
      <span style={{
        fontSize: 'var(--text-xs)', letterSpacing: '0.06em', fontWeight: 600,
        padding: '1px 4px', borderRadius: '2px',
        background: statusStyle.bg, color: statusStyle.text,
        border: `1px solid ${statusStyle.border}`,
        textTransform: 'uppercase',
      }}>
        {statusLabel}
      </span>
      <span style={{
        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', letterSpacing: '0.02em',
        maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {event.taskSubject}
      </span>
    </div>
  );
}
