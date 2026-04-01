import { useState, useRef, useCallback, useMemo, lazy, Suspense, useEffect } from 'react';
import { useTeamData } from './hooks/useTeamData';
import { usePendingHumanRequests } from './hooks/usePendingHumanRequests';
import { useProjectTodos } from './hooks/useProjectTodos';
import { useInboxSummary } from './hooks/useInboxSummary';
import { useSessionStats } from './hooks/useSessionStats';
import { useAlerts } from './hooks/useAlerts';
import { useCostData } from './hooks/useCostData';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePermissionRequests } from './hooks/usePermissionRequests';
import { useTranslation } from 'react-i18next';
import Layout, { type ViewType } from './components/Layout';
import EmptyState from './components/EmptyState';
import DashboardView from './components/dashboard/DashboardView';
import PermissionToastStack, { type PermissionToast } from './components/approval/PermissionToastStack';
import TaskDetailPanel from './components/TaskDetailPanel';
import AgentProfilePanel from './components/AgentProfilePanel';
import AlertBanner from './components/alerts/AlertBanner';
import { exportGraphAsPng, exportTeamAsJson, exportTasksCsv, exportCommLogCsv, exportTimelineCsv } from './utils/exportUtils';
import type { AgentMessage, TaskChangeEvent, Task, PermissionRequest } from './types';

// ── Lazy-loaded views (non-dashboard) ────────────────────────────────────────
const TopologyView = lazy(() => import('./components/graph/TopologyView').then(m => ({ default: m.TopologyView })));
const ActivityView = lazy(() => import('./components/activity/ActivityView'));
const CommLogView = lazy(() => import('./components/commlog/CommLogView'));
const TimelineView = lazy(() => import('./components/timeline/TimelineView'));
const SessionHistoryContainer = lazy(() => import('./components/history/SessionHistoryContainer'));
const ChatView = lazy(() => import('./components/chat/ChatView'));
const CostView = lazy(() => import('./components/cost/CostView'));
const ReviewView = lazy(() => import('./components/review/ReviewView'));
const KnowledgeView = lazy(() => import('./components/knowledge/KnowledgeView'));
const SettingsView = lazy(() => import('./components/settings/SettingsView'));
const ApprovalModal = lazy(() => import('./components/shared/ApprovalModal'));

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [pollInterval] = useState(2000);
  const { t } = useTranslation();
  const { teams, selectedTeamId, setSelectedTeamId, teamDetail, setTeamDetail, loading, isDemoMode, enableDemo, wsConnected } = useTeamData(pollInterval);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = teamDetail?.tasks.find(t => t.id === selectedTaskId) ?? null;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = teamDetail?.config?.members.find(m => m.agentId === selectedAgentId) ?? null;
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const pendingHuman = usePendingHumanRequests(selectedTeamId);
  const projectTodos = useProjectTodos(selectedTeamId);
  const inboxSummary = useInboxSummary(selectedTeamId);
  const sessionStats = useSessionStats(selectedTeamId);
  const { alerts, loading: alertsLoading } = useAlerts(selectedTeamId);
  const { data: costData, loading: costLoading } = useCostData(selectedTeamId);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const { requests: permissionRequests, resolveRequest, resolvingId } = usePermissionRequests();
  const [selectedPermissionRequestId, setSelectedPermissionRequestId] = useState<string | null>(null);
  const [permissionToasts, setPermissionToasts] = useState<PermissionToast[]>([]);
  const seenPermissionIdsRef = useRef<Set<string>>(new Set());
  const permissionNotificationsReadyRef = useRef(false);

  const leadName = teamDetail?.config?.leadAgentId?.split('@')[0] ?? null;

  // Keyboard shortcuts
  const shortcutConfig = useMemo(() => ({
    onViewChange: setView,
    onClosePanel: () => { setSelectedTaskId(null); setSelectedAgentId(null); },
    onNextNotification: () => setView('activity'),
    onRefresh: () => { /* trigger re-render by bumping state — polling handles actual refresh */ },
  }), []);
  useKeyboardShortcuts(shortcutConfig);

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setTeamDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        stats: {
          ...prev.stats,
          pending:    prev.tasks.filter(t => (t.id === updatedTask.id ? updatedTask : t).status === 'pending').length,
          inProgress: prev.tasks.filter(t => (t.id === updatedTask.id ? updatedTask : t).status === 'in_progress').length,
          completed:  prev.tasks.filter(t => (t.id === updatedTask.id ? updatedTask : t).status === 'completed').length,
          total:      prev.tasks.length,
        },
      };
    });
  }, [setTeamDetail]);

  // Refs to let CommLogView and TimelineView expose their current filtered data to export
  const commMessagesRef = useRef<AgentMessage[]>([]);
  const timelineEventsRef = useRef<TaskChangeEvent[]>([]);

  const handleExportPng = async () => { if (graphContainerRef.current) await exportGraphAsPng(graphContainerRef.current); };
  const handleExportJson = () => { if (teamDetail) exportTeamAsJson(teamDetail); };

  const handleExportCsv = useCallback(() => {
    if (view === 'dashboard' && teamDetail) {
      exportTasksCsv(teamDetail);
    } else if (view === 'commlog' && selectedTeamId) {
      exportCommLogCsv(selectedTeamId, commMessagesRef.current);
    } else if (view === 'timeline' && selectedTeamId) {
      exportTimelineCsv(selectedTeamId, timelineEventsRef.current);
    } else if (view === 'activity' && selectedTeamId) {
      exportCommLogCsv(selectedTeamId, commMessagesRef.current);
    } else if (teamDetail) {
      exportTasksCsv(teamDetail);
    }
  }, [view, teamDetail, selectedTeamId]);

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  const alertedAgentNames = new Set(visibleAlerts.map(a => a.agentName).filter(Boolean) as string[]);

  const dismissPermissionToast = useCallback((id: string) => {
    setPermissionToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const notifyPermissionRequest = useCallback((req: PermissionRequest) => {
    const agent = req.agentName || t('approval.agent');
    const tool = req.toolName || t('approval.tool');

    setPermissionToasts(prev => {
      if (prev.some(toast => toast.id === req.id)) return prev;
      return [
        {
          id: req.id,
          title: t('approval.notification_title'),
          body: t('approval.notification_body', { agent, tool }),
        },
        ...prev,
      ].slice(0, 3);
    });
  }, [t]);

  useEffect(() => {
    if (!permissionNotificationsReadyRef.current) {
      seenPermissionIdsRef.current = new Set(permissionRequests.map(req => req.id));
      permissionNotificationsReadyRef.current = true;
      return;
    }

    for (const req of permissionRequests) {
      if (seenPermissionIdsRef.current.has(req.id)) continue;
      seenPermissionIdsRef.current.add(req.id);
      notifyPermissionRequest(req);
    }
  }, [permissionRequests, notifyPermissionRequest]);

  const activePermissionRequest = permissionRequests.find(req => req.id === selectedPermissionRequestId)
    ?? permissionRequests[0]
    ?? null;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--void)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px', height: '32px',
            border: '1px solid var(--border)',
            borderTop: '1px solid var(--phosphor)',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin-slow 1s linear infinite',
            boxShadow: '0 0 10px var(--phosphor-glow)',
          }} />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            CONNECTING...
          </p>
        </div>
      </div>
    );
  }

  const hasUsableTeam = teams.some(t => t.hasConfig || isDemoMode);
  if (!hasUsableTeam && !isDemoMode) {
    return <EmptyState onEnableDemo={enableDemo} />;
  }

  return (
    <>
      <Layout
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
        isDemoMode={isDemoMode}
        view={view}
        onViewChange={setView}
        teamDetail={teamDetail}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        canExportPng={view === 'graph'}
        wsConnected={wsConnected}
        pendingApprovalCount={permissionRequests.length}
        pendingHumanCount={pendingHuman.count}
        pendingHumanAgents={pendingHuman.agentNames}
        alertCount={visibleAlerts.length}
        criticalAlertCount={visibleAlerts.filter(a => a.severity === 'critical').length}
        onAgentSelect={setSelectedAgentId}
        alertedAgentNames={alertedAgentNames}
      >
        {/* Alert banner — shown on graph view (dashboard uses ActionQueue instead) */}
        {visibleAlerts.length > 0 && view === 'graph' && (
          <AlertBanner
            alerts={visibleAlerts}
            onDismiss={id => setDismissedAlerts(prev => new Set([...prev, id]))}
            teamId={selectedTeamId ?? undefined}
            pendingHumanDetails={pendingHuman.details}
          />
        )}

        {(view === 'dashboard' || view === 'approvals') && teamDetail && (
          <DashboardView
            team={teamDetail}
            onTaskSelect={setSelectedTaskId}
            onAgentSelect={setSelectedAgentId}
            onTeamUpdate={handleTaskUpdated}
            pendingHumanAgents={pendingHuman.agentNames}
            pendingHumanDetails={pendingHuman.details}
            inboxSummary={inboxSummary}
            sessionStats={sessionStats}
            leadName={leadName}
            projectTodos={projectTodos}
            teamId={selectedTeamId ?? undefined}
            alerts={visibleAlerts}
            onDismissAlert={id => setDismissedAlerts(prev => new Set([...prev, id]))}
            onViewChange={setView}
            permissionRequests={permissionRequests}
            resolvingPermissionId={resolvingId}
            onResolvePermission={resolveRequest}
            onOpenPermissionDetails={request => setSelectedPermissionRequestId(request.id)}
          />
        )}
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        }>
        {view === 'graph' && teamDetail && (
          <TopologyView team={teamDetail} onTaskSelect={setSelectedTaskId} onAgentSelect={setSelectedAgentId} containerRef={graphContainerRef} selectedAgentId={selectedAgentId} alertedAgentNames={alertedAgentNames} />
        )}
        {view === 'activity' && selectedTeamId && (
          <ActivityView
            teamId={selectedTeamId}
            teamDetail={teamDetail}
            onMessagesChange={msgs => { commMessagesRef.current = msgs; }}
            onEventsChange={evts => { timelineEventsRef.current = evts; }}
            pendingHumanRequests={pendingHuman}
          />
        )}
        {view === 'commlog' && selectedTeamId && (
          <CommLogView
            teamId={selectedTeamId}
            teamDetail={teamDetail}
            onMessagesChange={msgs => { commMessagesRef.current = msgs; }}
            pendingHumanRequests={pendingHuman}
          />
        )}
        {view === 'timeline' && selectedTeamId && (
          <TimelineView
            teamId={selectedTeamId}
            teamDetail={teamDetail}
            onEventsChange={evts => { timelineEventsRef.current = evts; }}
          />
        )}
        {view === 'history' && selectedTeamId && (
          <SessionHistoryContainer
            teamId={selectedTeamId}
            teamDetail={teamDetail}
          />
        )}
        {view === 'chat' && selectedTeamId && (
          <ChatView
            teamId={selectedTeamId}
            teamDetail={teamDetail}
          />
        )}
        {view === 'cost' && selectedTeamId && (
          <CostView
            teamId={selectedTeamId}
            data={costData}
            loading={costLoading}
          />
        )}
        {view === 'review' && selectedTeamId && (
          <ReviewView
            teamId={selectedTeamId}
            agentNames={teamDetail?.config?.members.map(m => m.name) ?? []}
            isDemoMode={isDemoMode}
          />
        )}
        {view === 'knowledge' && selectedTeamId && (
          <KnowledgeView
            teamId={selectedTeamId}
            teamName={teams.find(t => t.id === selectedTeamId)?.name}
            isDemoMode={isDemoMode}
          />
        )}
        {view === 'settings' && (
          <SettingsView teamId={selectedTeamId} wsConnected={wsConnected} />
        )}
        </Suspense>
        {!teamDetail && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '400px', fontSize: '11px',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
          }}>
            — SELECT A TEAM —
          </div>
        )}
      </Layout>
      <PermissionToastStack
        toasts={permissionToasts}
        onDismiss={dismissPermissionToast}
        onSelect={id => {
          setView('dashboard');
          setSelectedPermissionRequestId(id);
          
          // Allow React to switch view to dashboard first, then scroll the panel item
          setTimeout(() => {
            const el = document.getElementById(`approval-req-${id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }}
      />
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          allTasks={teamDetail?.tasks ?? []}
          members={teamDetail?.config?.members ?? []}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {selectedAgent && (
        <AgentProfilePanel
          member={selectedAgent}
          tasks={teamDetail?.tasks ?? []}
          teamId={selectedTeamId ?? ''}
          isLead={selectedAgent.name === leadName}
          sessionStats={sessionStats[selectedAgent.name]}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
      {activePermissionRequest && (
        <Suspense fallback={null}>
          <ApprovalModal
            request={activePermissionRequest}
            resolving={resolvingId === activePermissionRequest.id}
            onDecision={decision => {
              const requestId = activePermissionRequest.id;
              if (selectedPermissionRequestId === requestId) {
                setSelectedPermissionRequestId(null);
              }
              void resolveRequest(requestId, decision);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
