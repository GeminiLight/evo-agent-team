import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamDetail } from '../../types';

interface StatusBarProps {
  teamDetail: TeamDetail | null;
  wsConnected?: boolean;
  pendingApprovalCount?: number;
}

export default function StatusBar({ teamDetail, wsConnected, pendingApprovalCount = 0 }: StatusBarProps) {
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString(i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US', { hour12: false });

  const stats = teamDetail?.stats;
  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const members = teamDetail?.config?.members ?? [];
  const tasks = teamDetail?.tasks ?? [];
  const activeCount = members.filter(m => tasks.some(t => t.owner === m.name && t.status === 'in_progress')).length;
  const idleCount = members.length - activeCount;

  const createdAt = teamDetail?.config?.createdAt;
  const runtimeStr = createdAt ? formatRuntime(Date.now() - createdAt) : null;

  return (
    <div role="status" style={{
      height: '34px',
      minHeight: '34px',
      background: 'var(--surface-0)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      flexShrink: 0,
    }}>
      {/* ─── Left: Progress ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {total > 0 && (
          <>
            <div style={{
              width: '52px', height: '3px',
              background: 'var(--surface-2, var(--border))',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: 'var(--status-ok)',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 3px var(--status-ok)',
              }} />
            </div>
            <span style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
              {completed}/{total} ({pct}%)
            </span>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* ─── Center: Agent counts ─── */}
      {members.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--status-ok)',
              boxShadow: '0 0 3px var(--status-ok)',
              display: 'inline-block',
              animation: activeCount > 0 ? 'status-pulse 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {activeCount} {t('status.active')}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--text-muted)',
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {idleCount} {t('status.idle')}
            </span>
          </span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* ─── Right: Runtime + WS + Clock ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {runtimeStr && (
          <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }} title="Runtime">
            {runtimeStr}
          </span>
        )}

        <div style={{ width: '1px', height: '12px', background: 'var(--border)', flexShrink: 0 }} />

        {/* WS status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            display: 'inline-block',
            background: wsConnected ? 'var(--status-ok)' : 'var(--status-warn)',
            boxShadow: `0 0 4px ${wsConnected ? 'var(--status-ok)' : 'var(--status-warn)'}`,
            animation: wsConnected ? 'status-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 'var(--text-xs)',
            color: wsConnected ? 'var(--status-ok)' : 'var(--status-warn)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {wsConnected ? t('status.live') : t('status.poll')}
          </span>
        </div>

        {pendingApprovalCount > 0 && (
          <span style={{
            color: 'var(--crimson)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pendingApprovalCount} {t('status.approval', 'APPROVAL')}
          </span>
        )}

        {/* Clock */}
        <span style={{
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}

function formatRuntime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h${rm > 0 ? rm + 'm' : ''}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24}h`;
}
