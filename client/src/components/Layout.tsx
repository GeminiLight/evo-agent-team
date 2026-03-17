import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Download } from 'lucide-react';
import type { TeamSummary, TeamDetail } from '../types';
import Sidebar from './layout/Sidebar';
import StatusBar from './layout/StatusBar';

export type ViewType = 'dashboard' | 'graph' | 'activity' | 'commlog' | 'timeline' | 'history' | 'chat' | 'cost' | 'review' | 'settings';

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
  onAgentSelect?: (agentId: string) => void;
  alertedAgentNames?: Set<string>;
  onExpertProfile?: () => void;
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
  onAgentSelect,
  alertedAgentNames = new Set(),
  onExpertProfile,
}: LayoutProps) {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--void)', fontFamily: 'var(--font-mono)' }}>

      {/* ═══════ HEADER — Single row command bar ═══════ */}
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
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {/* Logo */}
          <div
            onClick={() => onViewChange('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
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

          {/* Right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

            {isDemoMode && (
              <span style={{
                fontSize: '9px', letterSpacing: '0.12em',
                color: 'var(--status-warn)', background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)',
                padding: '1px 6px', borderRadius: '2px', lineHeight: '14px',
                textTransform: 'uppercase',
              }}>
                {t('status.demo')}
              </span>
            )}

            {/* Human-input alert pill */}
            {pendingHumanCount > 0 && (
              <button
                onClick={() => onViewChange('activity')}
                title={t('alert.agents_awaiting', { names: pendingHumanAgents.join(', ') })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '2px 7px',
                  background: 'var(--amber-glow)',
                  border: '1px solid var(--amber)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px', letterSpacing: '0.1em', lineHeight: '14px',
                  color: 'var(--amber)',
                  animation: 'status-pulse 2s ease-in-out infinite',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: '9px' }}>!</span>
                {t('alert.input', { count: pendingHumanCount })}
              </button>
            )}

            {/* Alert count pill */}
            {alertCount > 0 && (
              <button
                onClick={() => onViewChange('dashboard')}
                title={t('alert.alert_detail', { count: alertCount }) + (criticalAlertCount > 0 ? ` ${t('alert.alert_detail_critical', { count: criticalAlertCount })}` : '')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '2px 7px',
                  background: criticalAlertCount > 0 ? 'var(--crimson-bg-subtle)' : 'var(--amber-bg-subtle)',
                  border: `1px solid ${criticalAlertCount > 0 ? 'var(--crimson)' : 'var(--amber)'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px', letterSpacing: '0.1em', lineHeight: '14px',
                  color: criticalAlertCount > 0 ? 'var(--crimson)' : 'var(--amber)',
                  animation: criticalAlertCount > 0 ? 'status-pulse 2s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: '9px' }}>●</span>
                {t('alert.alert', { count: alertCount })}
              </button>
            )}

            <div style={{ width: '1px', height: '14px', background: 'var(--border)', flexShrink: 0 }} />

            {/* Export menu */}
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

      {/* ═══════ BODY — Sidebar + Main ═══════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          view={view}
          onViewChange={onViewChange}
          teamDetail={teamDetail}
          pendingHumanCount={pendingHumanCount}
          pendingHumanAgents={pendingHumanAgents}
          alertedAgentNames={alertedAgentNames}
          onAgentSelect={onAgentSelect}
          onExpertProfile={onExpertProfile}
        />
        <main style={{
          flex: 1, overflow: 'auto',
          padding: '20px 24px',
        }}>
          {children}
        </main>
      </div>

      {/* ═══════ STATUS BAR ═══════ */}
      <StatusBar
        teamDetail={teamDetail}
        wsConnected={wsConnected}
      />
    </div>
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
    : view === 'activity' ? t('export.comms_csv')
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
      {sublabel && <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{sublabel}</span>}
    </button>
  );
}
