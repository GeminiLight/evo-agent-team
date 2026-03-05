import { useState, useEffect } from 'react';
import { LayoutDashboard, Network, MessageSquare, Clock, Download, Activity, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import type { TeamSummary, TeamDetail } from '../types';
import ThemeSwitcher from './ThemeSwitcher';

export type ViewType = 'dashboard' | 'graph' | 'commlog' | 'timeline' | 'history';

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
}: LayoutProps) {
  const [time, setTime] = useState(() => new Date());
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--void)', fontFamily: 'var(--font-mono)' }}>
      <header style={{
        background: 'var(--surface-0)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          padding: '0 16px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* Logo — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Activity size={14} style={{ color: 'var(--phosphor)' }} />
              <div style={{
                position: 'absolute', inset: '-4px',
                background: 'var(--phosphor-glow)',
                borderRadius: '50%', filter: 'blur(4px)',
              }} />
            </div>
            {!navCollapsed && (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800, fontSize: '13px',
                letterSpacing: '0.18em',
                color: 'var(--phosphor)',
                textTransform: 'uppercase',
                textShadow: '0 0 20px var(--phosphor-glow-strong)',
                whiteSpace: 'nowrap',
              }}>
                AGENT//CTRL
              </span>
            )}
          </div>

          {/* Collapsible left info panel */}
          {!navCollapsed && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

              {/* Team selector */}
              {teams.length > 1 ? (
                <select
                  value={selectedTeamId ?? ''}
                  onChange={e => onSelectTeam(e.target.value)}
                  style={{
                    appearance: 'none',
                    background: 'var(--surface-1)',
                    color: 'var(--text-primary)',
                    fontSize: '11px', fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    padding: '4px 10px',
                    cursor: 'pointer', outline: 'none', flexShrink: 0,
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
                  ))}
                </select>
              ) : selectedTeamId ? (
                <span style={{ fontSize: '11px', color: 'var(--active-text)', letterSpacing: '0.08em', flexShrink: 0 }}>
                  {(teams[0]?.name ?? selectedTeamId).toUpperCase()}
                </span>
              ) : null}

              {/* Task stat pills */}
              {teamDetail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  <StatPill label="TOTAL" value={teamDetail.stats.total} color="var(--text-secondary)" />
                  <StatPill label="DONE"  value={teamDetail.stats.completed} color="var(--status-ok)" />
                  <StatPill label="RUN"   value={teamDetail.stats.inProgress} color="var(--status-warn)" pulse={teamDetail.stats.inProgress > 0} />
                  <StatPill label="WAIT"  value={teamDetail.stats.pending} color="var(--status-neutral)" />
                </div>
              )}
            </>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setNavCollapsed(c => !c)}
            title={navCollapsed ? 'Expand nav' : 'Collapse nav — maximize canvas'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', flexShrink: 0,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {navCollapsed
              ? <ChevronRight size={11} />
              : <ChevronLeft size={11} />}
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right cluster: status + view nav + theme + export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

            {/* WS / connection indicator — standardized */}
            <StatusDot
              live={wsConnected ?? false}
              label={wsConnected ? 'LIVE' : 'POLL'}
              color={wsConnected ? 'var(--status-ok)' : 'var(--status-warn)'}
            />

            {/* Clock */}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </span>

            {isDemoMode && (
              <span style={{
                fontSize: '9px', letterSpacing: '0.12em',
                color: 'var(--status-warn)', background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)',
                padding: '2px 7px', borderRadius: '2px',
              }}>
                DEMO
              </span>
            )}

            {/* Human-input alert pill */}
            {pendingHumanCount > 0 && (
              <button
                onClick={() => onViewChange('commlog')}
                title={`Agents awaiting your input: ${pendingHumanAgents.join(', ')}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 9px',
                  background: 'var(--amber-glow)',
                  border: '1px solid var(--amber)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px', letterSpacing: '0.1em',
                  color: 'var(--amber)',
                  animation: 'status-pulse 2s ease-in-out infinite',
                  flexShrink: 0,
                }}
              >
                <span>⚠</span>
                {pendingHumanCount} AWAITING INPUT
              </button>
            )}

            <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

            {/* View toggle */}
            <nav style={{
              display: 'flex',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              <ViewBtn active={view === 'dashboard'} onClick={() => onViewChange('dashboard')} icon={<LayoutDashboard size={12} />} label="MATRIX" />
              <ViewBtn active={view === 'graph'}     onClick={() => onViewChange('graph')}     icon={<Network size={12} />}          label="GRAPH" />
              <ViewBtn active={view === 'commlog'}   onClick={() => onViewChange('commlog')}   icon={<MessageSquare size={12} />}    label="COMMS" badge={pendingHumanCount > 0} />
              <ViewBtn active={view === 'timeline'}  onClick={() => onViewChange('timeline')}  icon={<Clock size={12} />}            label="LOG" />
              <ViewBtn active={view === 'history'}   onClick={() => onViewChange('history')}   icon={<ScrollText size={12} />}       label="HIST" last />
            </nav>

            <ThemeSwitcher />

            {/* Export menu — always accessible */}
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
      </header>

      {/* Main content — padding shrinks when nav collapsed to give more canvas space */}
      <main style={{
        flex: 1, overflow: 'auto',
        padding: navCollapsed ? '16px 12px' : '20px 24px',
        transition: 'padding 0.2s ease',
      }}>
        {children}
      </main>
    </div>
  );
}

// ─── Status dot — standardized traffic-light indicator ──────────────────────
function StatusDot({ live, label, color }: { live: boolean; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        display: 'inline-block', flexShrink: 0,
        background: color,
        boxShadow: `0 0 5px ${color}`,
        animation: live ? 'status-pulse 2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: '9px', color, letterSpacing: '0.1em' }}>{label}</span>
    </div>
  );
}

// ─── Stat pill ──────────────────────────────────────────────────────────────
function StatPill({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '3px',
      padding: '2px 7px',
      background: `${color}10`,
      border: `1px solid ${color}28`,
      borderRadius: '3px',
    }}>
      <span style={{
        fontSize: '13px', fontWeight: 700, color,
        fontFamily: 'var(--font-mono)', lineHeight: 1,
        animation: pulse ? 'status-pulse 2s ease-in-out infinite' : 'none',
      }}>
        {value}
      </span>
      <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  );
}

// ─── View button ─────────────────────────────────────────────────────────────
function ViewBtn({ active, onClick, icon, label, last = false, badge = false }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; last?: boolean; badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 11px',
        fontSize: '10px', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--active-bg-hi)' : 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: 'none',
        borderRight: last ? 'none' : '1px solid var(--border)',
        borderBottom: active ? '2px solid var(--phosphor)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textShadow: active ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
      {icon}{label}
      {badge && (
        <span style={{
          position: 'absolute', top: '4px', right: '5px',
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--amber)',
          boxShadow: '0 0 5px var(--amber)',
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Label for CSV changes by view
  const csvLabel = view === 'commlog' ? 'Export Comms CSV'
    : view === 'timeline' ? 'Export Timeline CSV'
    : 'Export Tasks CSV';

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Export data"
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 9px', fontSize: '9px', letterSpacing: '0.1em',
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
        EXPORT
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px', overflow: 'hidden', zIndex: 200,
          minWidth: '160px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-up 0.12s ease-out',
        }}>
          {/* Context-sensitive primary export */}
          {onExportCsv && (
            <ExportItem
              label={csvLabel}
              sublabel="Spreadsheet"
              onClick={() => { onExportCsv(); setOpen(false); }}
            />
          )}
          {canExportPng && onExportPng && (
            <ExportItem
              label="Export Graph PNG"
              sublabel="Screenshot"
              onClick={() => { onExportPng(); setOpen(false); }}
              divided={!!onExportCsv}
            />
          )}
          {onExportJson && (
            <ExportItem
              label="Export Team JSON"
              sublabel="Full data dump"
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
