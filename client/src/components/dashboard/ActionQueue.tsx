import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, Zap, X, MessageSquare } from 'lucide-react';
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

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <Zap size={10} style={{ color: 'var(--phosphor)' }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', flex: 1 }}>
          {t('action_queue.title')}
        </span>
        {needsAction.length > 0 && (
          <span style={{
            fontSize: '9px', color: 'var(--amber)',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber-dim)',
            borderRadius: '2px', padding: '1px 6px',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
          }}>
            {needsAction.length}
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {!hasContent ? (
          <EmptyQueue />
        ) : (
          <>
            {/* Needs Action section */}
            {needsAction.length > 0 && (
              <Section label={t('action_queue.needs_action')} color="var(--amber)">
                {needsAction.map((item, i) => {
                  if (item.type === 'human') {
                    const d = item.data as BlockingDetail;
                    return (
                      <HumanInputRow
                        key={`human-${d.name}`}
                        detail={d}
                        isDemo={isDemo}
                        onRespond={() => setRespondAgent(d)}
                      />
                    );
                  }
                  const a = item.data as Alert;
                  return (
                    <AlertRow
                      key={a.id}
                      alert={a}
                      onDismiss={() => onDismissAlert(a.id)}
                    />
                  );
                })}
              </Section>
            )}

            {/* Alerts section */}
            {nonCritical.length > 0 && (
              <Section label={t('action_queue.alerts')} color="var(--text-muted)">
                {nonCritical.slice(0, 5).map(a => (
                  <AlertRow key={a.id} alert={a} onDismiss={() => onDismissAlert(a.id)} />
                ))}
              </Section>
            )}

            {/* Recent Events */}
            {recentEvents.length > 0 && (
              <Section label={t('action_queue.recent')} color="var(--text-muted)">
                {recentEvents.slice(0, 8).map(evt => (
                  <EventRow key={evt.id} event={evt} />
                ))}
                {recentEvents.length > 8 && (
                  <button
                    onClick={() => onViewChange('timeline')}
                    style={{
                      display: 'block', width: '100%', padding: '4px 0',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: '9px', color: 'var(--phosphor)', letterSpacing: '0.1em',
                      fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                      opacity: 0.7, textAlign: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
                  >
                    View All →
                  </button>
                )}
              </Section>
            )}
          </>
        )}
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
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        padding: '6px 14px',
        background: 'var(--surface-1)',
        fontSize: '9px', letterSpacing: '0.12em', color,
        textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </div>
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  );
}

function HumanInputRow({ detail, isDemo, onRespond }: { detail: BlockingDetail; isDemo: boolean; onRespond: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 8px',
      background: 'var(--amber-glow)',
      border: '1px solid var(--amber-dim)',
      borderRadius: '3px',
    }}>
      <MessageSquare size={10} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.03em' }}>
          {detail.name}
        </div>
        {detail.blocking.toolName && (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {detail.blocking.toolName}
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); if (!isDemo) onRespond(); }}
        style={{
          padding: '2px 8px', fontSize: '9px', letterSpacing: '0.08em', fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          background: isDemo ? 'transparent' : 'rgba(245,166,35,0.15)',
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

function AlertRow({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const sevColor = alert.severity === 'critical' ? 'var(--crimson)' : alert.severity === 'warning' ? 'var(--amber)' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 8px',
      borderRadius: '2px',
    }}>
      <AlertTriangle size={9} style={{ color: sevColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {alert.title}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: '2px', display: 'flex', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <X size={10} />
      </button>
    </div>
  );
}

function EventRow({ event }: { event: TaskChangeEvent }) {
  const { t } = useTranslation();
  const status = event.newStatus;
  const statusStyle = STATUS_COLORS[status === 'pending' ? 'pending' : status === 'in_progress' ? 'in_progress' : 'completed'];
  const statusLabel = status === 'completed' ? t('action_queue.event_completed')
    : status === 'in_progress' ? t('action_queue.event_started')
    : t('action_queue.event_created');
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px' }}>
      <span style={{
        fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em', flexShrink: 0, width: '36px',
      }}>
        {time}
      </span>
      <span style={{
        fontSize: '9px', letterSpacing: '0.08em', fontWeight: 600,
        padding: '1px 4px', borderRadius: '2px',
        background: statusStyle.bg, color: statusStyle.text,
        border: `1px solid ${statusStyle.border}`,
        textTransform: 'uppercase', flexShrink: 0,
      }}>
        {statusLabel}
      </span>
      <span style={{
        fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>
        {event.taskSubject}
      </span>
    </div>
  );
}

function EmptyQueue() {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(var(--accent-rgb, 57,255,106), 0.03) 2px, rgba(var(--accent-rgb, 57,255,106), 0.03) 4px)',
        animation: 'data-stream 8s linear infinite',
        pointerEvents: 'none', opacity: 0.5,
      }} />
      <Bell size={16} style={{ color: 'var(--phosphor)', opacity: 0.3, marginBottom: '12px' }} />
      <div style={{
        fontSize: '10px', fontWeight: 600, color: 'var(--phosphor)',
        letterSpacing: '0.15em', fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase', opacity: 0.7,
      }}>
        {t('action_queue.all_clear')}
      </div>
      <div style={{
        fontSize: '9px', color: 'var(--text-muted)',
        letterSpacing: '0.06em', marginTop: '4px', opacity: 0.5,
      }}>
        {t('action_queue.all_clear_sub')}
      </div>
    </div>
  );
}
