import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Alert, AlertSeverity } from '../../types';
import type { BlockingDetail } from '../../hooks/usePendingHumanRequests';
import RespondModal from '../shared/RespondModal';

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss?: (id: string) => void;
  teamId?: string;
  pendingHumanDetails?: BlockingDetail[];
}

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function severityColor(severity: AlertSeverity): string {
  if (severity === 'critical') return 'var(--crimson, #ff4466)';
  if (severity === 'warning')  return 'var(--amber, #f5a623)';
  return 'var(--ice, #7eb8f7)';
}

function kindIcon(kind: Alert['kind']): string {
  if (kind === 'agent_stuck')             return '⏸';
  if (kind === 'human_input_escalated')   return '⚠';
  if (kind === 'critical_path_blocked')   return '⛔';
  if (kind === 'token_anomaly')           return '📈';
  return '●';
}

export default function AlertBanner({ alerts, onDismiss, teamId, pendingHumanDetails }: AlertBannerProps) {
  const { t } = useTranslation();
  const [respondingAgent, setRespondingAgent] = useState<string | null>(null);
  if (alerts.length === 0) return null;

  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings  = alerts.filter(a => a.severity !== 'critical');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      marginBottom: '16px',
    }}>
      {alerts.map(alert => {
        const color = severityColor(alert.severity);
        const isCrit = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 12px',
              background: `${color}10`,
              border: `1px solid ${color}40`,
              borderLeft: `3px solid ${color}`,
              borderRadius: '3px',
              fontFamily: 'var(--font-mono)',
              animation: isCrit ? 'status-pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            {/* Icon */}
            <span style={{
              fontSize: '12px',
              color,
              flexShrink: 0,
              marginTop: '1px',
            }}>
              {kindIcon(alert.kind)}
            </span>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  color, letterSpacing: '0.06em',
                }}>
                  {alert.title.toUpperCase()}
                </span>
                {alert.durationMs !== undefined && (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    {fmtDuration(alert.durationMs)}
                  </span>
                )}
                <span style={{
                  fontSize: '9px', letterSpacing: '0.12em', padding: '1px 5px',
                  background: `${color}20`, border: `1px solid ${color}40`,
                  borderRadius: '2px', color,
                }}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>
              <div style={{
                fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px',
                letterSpacing: '0.04em', lineHeight: 1.5,
              }}>
                {alert.detail}
              </div>
            </div>

            {/* RESPOND button for human_input_escalated */}
            {alert.kind === 'human_input_escalated' && teamId && alert.agentName && (
              <button
                onClick={() => setRespondingAgent(alert.agentName!)}
                style={{
                  flexShrink: 0,
                  padding: '3px 10px',
                  fontSize: '9px', letterSpacing: '0.12em', fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(245,166,35,0.12)',
                  color: 'var(--amber)',
                  border: '1px solid var(--amber-dim)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.12)')}
              >
                <span style={{ textTransform: 'uppercase' }}>{t('alert.respond')}</span>
              </button>
            )}

            {/* Dismiss */}
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                title={t('alert.dismiss')}
                style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '0 2px',
                  lineHeight: 1,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {/* Summary line if multiple */}
      {alerts.length > 1 && (
        <div style={{
          fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em',
          fontFamily: 'var(--font-mono)', paddingLeft: '4px',
        }}>
          <span style={{ textTransform: 'uppercase' }}>{t('alert.active_alert', { count: alerts.length })}</span>
          {criticals.length > 0 && ` — ${criticals.length} CRITICAL`}
        </div>
      )}

      {/* Respond modal */}
      {respondingAgent && teamId && (
        <RespondModal
          agentName={respondingAgent}
          toolName={pendingHumanDetails?.find(d => d.name === respondingAgent)?.blocking.toolName}
          detail={pendingHumanDetails?.find(d => d.name === respondingAgent)?.blocking.detail}
          teamId={teamId}
          onClose={() => setRespondingAgent(null)}
        />
      )}
    </div>
  );
}
