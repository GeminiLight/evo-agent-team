import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, Network, Activity, ScrollText, MessageSquare, 
  DollarSign, Star, Brain, ChevronLeft, ChevronRight, Settings,
  BarChart3, Zap, Check, MonitorCog
} from 'lucide-react';
import type { ViewType } from '../Layout';
import type { TeamDetail } from '../../types';
import { agentColor, agentInitials } from '../../utils/agentColors';
import { useIsTablet } from '../../hooks/useMediaQuery';

const STORAGE_KEY = 'sidebar-collapsed';

// Activity-family views: commlog and timeline should highlight the Activity nav item
const ACTIVITY_FAMILY: ViewType[] = ['activity', 'commlog', 'timeline'];

interface NavItem {
  key: ViewType;
  icon: typeof LayoutDashboard;
  labelKey: string;
  badgeCount?: number;
  id?: string; // Optional unique ID for rendering
}

interface NavGroup {
  id: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
  badgeCount?: number;
}

interface SidebarProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  teamDetail: TeamDetail | null;
  pendingHumanCount?: number;
  pendingHumanAgents?: string[];
  alertedAgentNames?: Set<string>;
  onAgentSelect?: (agentId: string) => void;
}

const buildNavStructure = (pendingApprovalCount: number = 0): NavGroup[] => [
  {
    id: 'monitoring',
    labelKey: 'nav.group.monitoring',
    icon: MonitorCog,
    items: [
      { key: 'dashboard', icon: LayoutDashboard, labelKey: 'sidebar.overview' },
      { key: 'graph',     icon: Network,         labelKey: 'sidebar.topology' },
      { key: 'activity',  icon: Activity,        labelKey: 'sidebar.activity' },
    ],
  },
  {
    id: 'collaboration',
    labelKey: 'nav.group.collaboration',
    icon: MessageSquare,
    items: [
      { key: 'commlog',   icon: MessageSquare,   labelKey: 'sidebar.messages' },
      { key: 'approvals', icon: Check,           labelKey: 'sidebar.approvals', badgeCount: pendingApprovalCount },
      { key: 'history',   icon: ScrollText,      labelKey: 'sidebar.sessions' },
      { key: 'chat',      icon: MessageSquare,   labelKey: 'sidebar.chat' },
    ],
    badgeCount: pendingApprovalCount,
  },
  {
    id: 'knowledge',
    labelKey: 'nav.group.knowledge',
    icon: Brain,
    items: [
      { key: 'knowledge', icon: Brain,           labelKey: 'sidebar.knowledge' },
    ],
  },
  {
    id: 'review',
    labelKey: 'nav.group.review',
    icon: Star,
    items: [
      { key: 'review',    icon: Star,            labelKey: 'sidebar.review' },
      { key: 'cost',      icon: DollarSign,      labelKey: 'sidebar.stats' },
    ],
  },
];

export default function Sidebar({
  view,
  onViewChange,
  teamDetail,
  pendingHumanCount = 0,
  pendingHumanAgents = [],
  alertedAgentNames = new Set(),
  onAgentSelect,
}: SidebarProps) {
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const [userCollapsed, setUserCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  // Force collapsed on tablet-width viewports; otherwise respect user preference
  const collapsed = isTablet || userCollapsed;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, userCollapsed ? '1' : '0'); } catch { /* noop */ }
  }, [userCollapsed]);

  const width = collapsed ? 48 : 200;
  const members = teamDetail?.config?.members ?? [];
  const tasks = teamDetail?.tasks ?? [];
  const navGroups = buildNavStructure(pendingHumanCount);

  function getAgentStatus(name: string): 'active' | 'pending' | 'alerted' | 'idle' {
    if (alertedAgentNames.has(name)) return 'alerted';
    if (pendingHumanAgents.includes(name)) return 'pending';
    if (tasks.some(t => t.owner === name && t.status === 'in_progress')) return 'active';
    return 'idle';
  }

  const statusDotColor: Record<string, string> = {
    active: 'var(--status-ok)',
    pending: 'var(--amber)',
    alerted: 'var(--crimson, #ff4466)',
    idle: 'var(--text-muted)',
  };

  const statusPulse: Record<string, boolean> = {
    active: true, pending: true, alerted: true, idle: false,
  };

  function isItemActive(item: NavItem, currentView: ViewType): boolean {
    if (item.key === 'activity' && ACTIVITY_FAMILY.includes(currentView)) return true;
    return currentView === item.key;
  }

  function renderBadge(count?: number) {
    if (!count || count === 0) return null;
    return (
      <span style={{
        position: 'absolute',
        top: collapsed ? '4px' : '5px',
        right: collapsed ? '8px' : '8px',
        minWidth: '12px',
        height: '12px',
        borderRadius: '50%',
        background: 'var(--amber)',
        boxShadow: '0 0 4px var(--amber)',
        animation: 'status-pulse 2s ease-in-out infinite',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        color: 'var(--surface-0)',
        padding: '0 3px',
      }}>
        <span aria-hidden="true">{count > 9 ? '9+' : count}</span>
        <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {count} pending
        </span>
      </span>
    );
  }

  return (
    <aside style={{
      width,
      minWidth: width,
      transition: 'width 0.2s ease, min-width 0.2s ease',
      background: 'var(--surface-0)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-mono)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* ─── Navigation Groups ─── */}
      <nav aria-label="Main navigation" style={{ 
        padding: collapsed ? '10px 6px 6px' : '10px 8px 6px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        overflowY: 'auto',
        flex: 1,
      }}>
        {navGroups.map(group => {
          const GroupIcon = group.icon;
          
          return (
            <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {/* Group header (only show label when expanded) */}
              {!collapsed && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  opacity: 0.6,
                  fontWeight: 700,
                }}>
                  <GroupIcon size={12} style={{ flexShrink: 0 }} />
                  <span>{t(group.labelKey)}</span>
                </div>
              )}

              {/* Group items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isItemActive(item, view);
                  const itemBadgeCount = item.badgeCount;
                  const itemKey = item.id || `${group.id}-${item.key}`;

                  return (
                    <button
                      key={itemKey}
                      onClick={() => onViewChange(item.key)}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? t(item.labelKey) : undefined}
                      data-tour={item.id || item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: collapsed ? '8px 0' : '8px 10px',
                        minHeight: 'var(--min-target)',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? 'var(--active-bg-med)' : 'transparent',
                        color: active ? 'var(--active-text)' : 'var(--text-secondary)',
                        border: 'none',
                        borderLeft: active ? '2px solid var(--phosphor)' : '2px solid transparent',
                        borderRadius: '0 3px 3px 0',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        transition: 'all 0.15s',
                        textShadow: active ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        width: '100%',
                      }}
                      onMouseEnter={e => { 
                        if (!active) { 
                          e.currentTarget.style.color = 'var(--text-primary)'; 
                          e.currentTarget.style.background = 'var(--surface-1)'; 
                        } 
                      }}
                      onMouseLeave={e => { 
                        if (!active) { 
                          e.currentTarget.style.color = 'var(--text-secondary)'; 
                          e.currentTarget.style.background = 'transparent'; 
                        } 
                      }}
                    >
                      <Icon size={14} style={{ flexShrink: 0 }} />
                      {!collapsed && <span>{t(item.labelKey)}</span>}
                      {itemBadgeCount !== undefined && renderBadge(itemBadgeCount)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ─── Spacer ─── */}
      <div style={{ flex: 1 }} />

      {/* ─── Agent mini-list ─── */}
      {members.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: collapsed ? '8px 6px' : '8px 8px',
          overflow: 'auto',
        }}>
          {!collapsed && (
            <div style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.12em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '6px',
              padding: '0 2px',
              opacity: 0.7,
            }}>
              {t('sidebar.team', 'TEAM')}: {teamDetail?.name?.toUpperCase() ?? '—'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {members.map(member => {
              const status = getAgentStatus(member.name);
              const dotColor = statusDotColor[status];
              const pulse = statusPulse[status];
              const color = agentColor(member.name);
              return (
                <button
                  key={member.agentId}
                  onClick={() => onAgentSelect?.(member.agentId)}
                  title={member.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? '0' : '8px',
                    padding: collapsed ? '6px 0' : '6px 8px',
                    minHeight: '28px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {collapsed ? (
                    /* Collapsed: tiny avatar circle with initials */
                    <div style={{
                      width: '22px', height: '22px',
                      borderRadius: '50%',
                      background: `${color}22`,
                      border: `1.5px solid ${color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-xs)', fontWeight: 700,
                      color,
                      position: 'relative',
                      flexShrink: 0,
                    }}>
                      {agentInitials(member.name)}
                      {/* Status dot overlay */}
                      <span style={{
                        position: 'absolute', bottom: '-1px', right: '-1px',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: dotColor,
                        boxShadow: `0 0 3px ${dotColor}`,
                        animation: pulse ? 'status-pulse 2s ease-in-out infinite' : 'none',
                        border: '1px solid var(--surface-0)',
                      }} />
                    </div>
                  ) : (
                    /* Expanded: dot + name */
                    <>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: dotColor,
                        boxShadow: `0 0 4px ${dotColor}`,
                        animation: pulse ? 'status-pulse 2s ease-in-out infinite' : 'none',
                        flexShrink: 0,
                        display: 'inline-block',
                      }} />
                      <span style={{
                        fontSize: '10px',
                        color,
                        letterSpacing: '0.04em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                      }}>
                        {member.name}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Bottom: Settings + Collapse ─── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: collapsed ? '4px 6px' : '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <button
          onClick={() => onViewChange('settings')}
          title={collapsed ? t('nav.settings') : undefined}
          aria-label={t('nav.settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '8px 0' : '8px 10px',
            minHeight: 'var(--min-target)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            background: view === 'settings' ? 'var(--active-bg-med)' : 'transparent',
            color: view === 'settings' ? 'var(--phosphor)' : 'var(--text-secondary)',
            border: 'none',
            borderLeft: view === 'settings' ? '2px solid var(--phosphor)' : '2px solid transparent',
            borderRadius: '0 3px 3px 0',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { 
            if (view !== 'settings') { 
              e.currentTarget.style.color = 'var(--text-primary)'; 
              e.currentTarget.style.background = 'var(--surface-1)'; 
            } 
          }}
          onMouseLeave={e => { 
            if (view !== 'settings') { 
              e.currentTarget.style.color = 'var(--text-secondary)'; 
              e.currentTarget.style.background = 'transparent'; 
            } 
          }}
        >
          <Settings size={13} style={{ flexShrink: 0 }} />
          {!collapsed && <span>{t('nav.settings')}</span>}
        </button>

        {!isTablet && (
        <button
          onClick={() => setUserCollapsed(c => !c)}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '8px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
            borderRadius: '3px',
            minHeight: 'var(--min-target)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          {!collapsed && <span style={{ textTransform: 'uppercase' }}>{t('sidebar.collapse')}</span>}
        </button>
        )}
      </div>
    </aside>
  );
}
