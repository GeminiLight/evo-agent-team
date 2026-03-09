import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Network, MessageSquare, Clock, Download, Activity, ScrollText, DollarSign, Star, Settings, MoreVertical } from 'lucide-react';
import type { TeamSummary, TeamDetail } from '../types';

export type ViewType = 'dashboard' | 'graph' | 'commlog' | 'timeline' | 'history' | 'cost' | 'review' | 'settings';

interface LayoutProps {
  teams: TeamSummary[];
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => void;
  isDemoMode: boolean;
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  teamDetail: TeamDetail | null;
  children: React.ReactNode;
  onExportPng?: () => void;
  onExportJson?: () => void;
  onExportCsv?: () => void;
  canExportPng?: boolean;
  wsConnected?: boolean;
  pendingHumanCount?: number;
  pendingHumanAgents?: string[];
  alertCount?: number;
  criticalAlertCount?: number;
}

export default function Layout({
  teams,
  selectedTeamId,
  onSelectTeam,
  isDemoMode,
  view,
  onViewChange,
  teamDetail,
  children,
  onExportPng,
  onExportJson,
  onExportCsv,
  canExportPng,
  wsConnected,
  pendingHumanCount = 0,
  pendingHumanAgents = [],
  alertCount = 0,
  criticalAlertCount = 0,
}: LayoutProps) {
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString(i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US', { hour12: false });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--void)', fontFamily: 'var(--font-mono)' }}>

      {/* ═══════ HEADER — Two-tier command bar ═══════ */}
      <header style={{
        background: 'var(--surface-0)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>

        {/* ─── ROW 1: Identity + Global Status ─── */}
        <div style={{
          padding: '0 16px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Activity size={13} style={{ color: 'var(--phosphor)' }} />
              <div style={{
                position: 'absolute', inset: '-4px',
                background: 'var(--phosphor-glow)',
                borderRadius: '50%', filter: 'blur(4px)',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800, fontSize: '12px',
              letterSpacing: '0.18em',
              color: 'var(--phosphor)',
              textTransform: 'uppercase',
              textShadow: '0 0 20px var(--phosphor-glow-strong)',
              whiteSpace: 'nowrap',
            }}>
              AGENT//CTRL
            </span>
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />

          {/* Team selector */}
          {teams.length > 1 ? (
            <select
              value={selectedTeamId ?? ''}
              onChange={e => onSelectTeam(e.target.value)}
              style={{
                appearance: 'none',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '10px', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '3px 8px',
                cursor: 'pointer', outline: 'none', flexShrink: 0,
              }}
            >
              {teams.map(tm => (
                <option key={tm.id} value={tm.id}>{tm.name.toUpperCase()}</option>
              ))}
            </select>
          ) : selectedTeamId ? (
            <span style={{ fontSize: '10px', color: 'var(--active-text)', letterSpacing: '0.08em', flexShrink: 0 }}>
              {(teams[0]?.name ?? selectedTeamId).toUpperCase()}
            </span>
          ) : null}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right cluster: compact global indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

            {/* WS status + clock — merged into one compact block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StatusDot
                live={wsConnected ?? false}
                label={wsConnected ? t('status.live') : t('status.poll')}
                color={wsConnected ? 'var(--status-ok)' : 'var(--status-warn)'}
              />
              <span style={{
                fontSize: '10px', color: 'var(--text-muted)',
                letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums',
              }}>
                {timeStr}
              </span>
            </div>

            {isDemoMode && (
              <span style={{
                fontSize: '8px', letterSpacing: '0.12em',
                color: 'var(--status-warn)', background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)',
                padding: '1px 6px', borderRadius: '2px', lineHeight: '14px',
                textTransform: 'uppercase',
              }}>
                {t('status.demo')}
              </span>
            )}

            {/* Human-input alert — compact pill */}
            {pendingHumanCount > 0 && (
              <button
                onClick={() => onViewChange('commlog')}
                title={t('alert.agents_awaiting', { names: pendingHumanAgents.join(', ') })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '2px 7px',
                  background: 'var(--amber-glow)',
                  border: '1px solid var(--amber)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px', letterSpacing: '0.1em', lineHeight: '14px',
                  color: 'var(--amber)',
                  animation: 'status-pulse 2s ease-in-out infinite',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: '8px' }}>!</span>
                {t('alert.input', { count: pendingHumanCount })}
              </button>
            )}

            {/* Alert count — compact */}
            {alertCount > 0 && (
              <button
                onClick={() => onViewChange('dashboard')}
                title={t('alert.alert_detail', { count: alertCount }) + (criticalAlertCount > 0 ? ` ${t('alert.alert_detail_critical', { count: criticalAlertCount })}` : '')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '2px 7px',
                  background: criticalAlertCount > 0 ? 'rgba(255,68,102,0.12)' : 'rgba(245,166,35,0.1)',
                  border: `1px solid ${criticalAlertCount > 0 ? 'var(--crimson, #ff4466)' : 'var(--amber)'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px', letterSpacing: '0.1em', lineHeight: '14px',
                  color: criticalAlertCount > 0 ? 'var(--crimson, #ff4466)' : 'var(--amber)',
                  animation: criticalAlertCount > 0 ? 'status-pulse 2s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: '7px' }}>●</span>
                {t('alert.alert', { count: alertCount })}
              </button>
            )}

            <div style={{ width: '1px', height: '14px', background: 'var(--border)', flexShrink: 0 }} />

            {/* Utilities: Config + Export in compact cluster */}
            <button
              onClick={() => onViewChange('settings')}
              title={t('nav.settings_tooltip')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px',
                background: view === 'settings' ? 'var(--active-bg-med)' : 'transparent',
                color: view === 'settings' ? 'var(--phosphor)' : 'var(--text-muted)',
                border: `1px solid ${view === 'settings' ? 'var(--phosphor)' : 'var(--border)'}`,
                borderRadius: '3px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (view !== 'settings') { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              onMouseLeave={e => { if (view !== 'settings') { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
            >
              <Settings size={11} />
            </button>

            {(onExportPng || onExportJson || onExportCsv) && (
              <ExportMenu
                onExportPng={onExportPng}
                onExportJson={onExportJson}
                onExportCsv={onExportCsv}
                canExportPng={canExportPng}
                view={view}
              />
            )}
          </div>
        </div>

        {/* ─── ROW 2: Navigation + Task Stats ─── */}
        <div style={{
          padding: '0 16px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          background: 'var(--surface-0)',
        }}>
          {/* View navigation — full-width tabs with room to breathe */}
          <nav style={{
            display: 'flex',
            alignItems: 'stretch',
            height: '100%',
            gap: '0',
            flexShrink: 0,
          }}>
            <ViewBtn active={view === 'dashboard'} onClick={() => onViewChange('dashboard')} icon={<LayoutDashboard size={11} />} label={t('nav.matrix')} tooltip={t('nav.matrix_tooltip')} />
            <ViewBtn active={view === 'graph'}     onClick={() => onViewChange('graph')}     icon={<Network size={11} />}          label={t('nav.graph')} tooltip={t('nav.graph_tooltip')} />
            <ViewBtn active={view === 'commlog'}   onClick={() => onViewChange('commlog')}   icon={<MessageSquare size={11} />}    label={t('nav.comms')} tooltip={t('nav.comms_tooltip')} badge={pendingHumanCount > 0} />
            <ViewBtn active={view === 'timeline'}  onClick={() => onViewChange('timeline')}  icon={<Clock size={11} />}            label={t('nav.log')} tooltip={t('nav.log_tooltip')} />
            <ViewBtn active={view === 'history'}   onClick={() => onViewChange('history')}   icon={<ScrollText size={11} />}       label={t('nav.hist')} tooltip={t('nav.hist_tooltip')} />
            <ViewBtn active={view === 'cost'}      onClick={() => onViewChange('cost')}      icon={<DollarSign size={11} />}       label={t('nav.cost')} tooltip={t('nav.cost_tooltip')} />
            <ViewBtn active={view === 'review'}    onClick={() => onViewChange('review')}    icon={<Star size={11} />}             label={t('nav.review')} tooltip={t('nav.review_tooltip')} />
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Task stat counters — compact inline readout */}
          {teamDetail && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              flexShrink: 0,
            }}>
              <StatChip value={teamDetail.stats.completed} label={t('stat.done')} color="var(--status-ok)" tooltip={t('stat.done_tooltip')} />
              <StatChip value={teamDetail.stats.inProgress} label={t('stat.run')} color="var(--status-warn)" pulse={teamDetail.stats.inProgress > 0} tooltip={t('stat.run_tooltip')} />
              <StatChip value={teamDetail.stats.pending} label={t('stat.wait')} color="var(--status-neutral)" tooltip={t('stat.wait_tooltip')} />
              <span style={{
                fontSize: '9px', color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}>
                /{teamDetail.stats.total}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main style={{
        flex: 1, overflow: 'auto',
        padding: '20px 24px',
      }}>
        {children}
      </main>
    </div>
  );
}

// ─── Status dot — compact traffic-light indicator ───────────────────────────
function StatusDot({ live, label, color }: { live: boolean; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        display: 'inline-block', flexShrink: 0,
        background: color,
        boxShadow: `0 0 4px ${color}`,
        animation: live ? 'status-pulse 2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: '8px', color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ─── Stat chip — ultra-compact inline counter ────────────────────────────────
function StatChip({ value, label, color, pulse, tooltip }: { value: number; label: string; color: string; pulse?: boolean; tooltip?: string }) {
  return (
    <div
      title={tooltip ?? label}
      style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}
    >
      <span style={{
        fontSize: '12px', fontWeight: 700, color,
        fontFamily: 'var(--font-mono)', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        animation: pulse ? 'status-pulse 2s ease-in-out infinite' : 'none',
      }}>
        {value}
      </span>
      <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

// ─── View button — tab style with bottom accent ─────────────────────────────
function ViewBtn({ active, onClick, icon, label, tooltip, badge = false }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tooltip?: string; badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip ?? label}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '0 12px',
        height: '100%',
        fontSize: '9px', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: 'none',
        borderBottom: active ? '2px solid var(--phosphor)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        textShadow: active ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
        position: 'relative',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
      {icon}{label}
      {badge && (
        <span style={{
          position: 'absolute', top: '5px', right: '4px',
          width: '5px', height: '5px', borderRadius: '50%',
          background: 'var(--amber)',
          boxShadow: '0 0 4px var(--amber)',
          animation: 'status-pulse 2s ease-in-out infinite',
        }} />
      )}
    </button>
  );
}

// ─── Export menu — context-aware per view ────────────────────────────────────
function ExportMenu({ onExportPng, onExportJson, onExportCsv, canExportPng, view }: {
  onExportPng?: () => void;
  onExportJson?: () => void;
  onExportCsv?: () => void;
  canExportPng?: boolean;
  view: ViewType;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  }

  const csvLabel = view === 'commlog' ? t('export.comms_csv')
    : view === 'timeline' ? t('export.timeline_csv')
    : t('export.tasks_csv');

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title={t('export.title')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '26px', height: '26px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          background: open ? 'var(--active-bg-med)' : 'transparent',
          color: open ? 'var(--text-primary)' : 'var(--text-muted)',
          border: `1px solid ${open ? 'var(--border-bright)' : 'var(--border)'}`,
          borderRadius: '3px', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
      >
        <Download size={11} />
      </button>
      {open && (
        <div style={{
          position: 'fixed',
          top: dropPos.top,
          right: dropPos.right,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px', overflow: 'hidden', zIndex: 9999,
          minWidth: '160px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-up 0.12s ease-out',
        }}>
          {onExportCsv && (
            <ExportItem
              label={csvLabel}
              sublabel={t('export.spreadsheet')}
              onClick={() => { onExportCsv(); setOpen(false); }}
            />
          )}
          {canExportPng && onExportPng && (
            <ExportItem
              label={t('export.graph_png')}
              sublabel={t('export.screenshot')}
              onClick={() => { onExportPng(); setOpen(false); }}
              divided={!!onExportCsv}
            />
          )}
          {onExportJson && (
            <ExportItem
              label={t('export.team_json')}
              sublabel={t('export.full_dump')}
              onClick={() => { onExportJson(); setOpen(false); }}
              divided={!!(onExportCsv || canExportPng)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ExportItem({ label, sublabel, onClick, divided }: {
  label: string; sublabel?: string; onClick: () => void; divided?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: '1px',
        width: '100%', padding: '9px 14px',
        fontFamily: 'var(--font-mono)',
        background: 'transparent', color: 'var(--text-secondary)',
        border: 'none',
        borderTop: divided ? '1px solid var(--border)' : 'none',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--active-bg-med)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: '10px', letterSpacing: '0.06em' }}>{label}</span>
      {sublabel && <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{sublabel}</span>}
    </button>
  );
}
