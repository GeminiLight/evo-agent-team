import { useState, useRef, useCallback } from 'react';
import { useTeamData } from './hooks/useTeamData';
import { usePendingHumanRequests } from './hooks/usePendingHumanRequests';
import { useProjectTodos } from './hooks/useProjectTodos';
import { useInboxSummary } from './hooks/useInboxSummary';
import { useSessionStats } from './hooks/useSessionStats';
import { useAlerts } from './hooks/useAlerts';
import { useCostData } from './hooks/useCostData';
import Layout, { type ViewType } from './components/Layout';
import EmptyState from './components/EmptyState';
import DashboardView from './components/dashboard/DashboardView';
import { TopologyView } from './components/graph/TopologyView';
import TaskDetailPanel from './components/TaskDetailPanel';
import AgentProfilePanel from './components/AgentProfilePanel';
import CommLogView from './components/commlog/CommLogView';
import TimelineView from './components/timeline/TimelineView';
import SessionHistoryContainer from './components/history/SessionHistoryContainer';
import CostView from './components/cost/CostView';
import AlertBanner from './components/alerts/AlertBanner';
import { exportGraphAsPng, exportTeamAsJson, exportTasksCsv, exportCommLogCsv, exportTimelineCsv } from './utils/exportUtils';
import type { AgentMessage, TaskChangeEvent, Task } from './types';

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [pollInterval] = useState(2000);
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

  const leadName = teamDetail?.config?.leadAgentId?.split('@')[0] ?? null;

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
    } else if (teamDetail) {
      exportTasksCsv(teamDetail);
    }
  }, [view, teamDetail, selectedTeamId]);

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  const alertedAgentNames = new Set(visibleAlerts.map(a => a.agentName).filter(Boolean) as string[]);

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
        pendingHumanCount={pendingHuman.count}
        pendingHumanAgents={pendingHuman.agentNames}
        alertCount={visibleAlerts.length}
        criticalAlertCount={visibleAlerts.filter(a => a.severity === 'critical').length}
      >
        {/* Alert banner — shown on dashboard and graph views */}
        {visibleAlerts.length > 0 && (view === 'dashboard' || view === 'graph') && (
          <AlertBanner
            alerts={visibleAlerts}
            onDismiss={id => setDismissedAlerts(prev => new Set([...prev, id]))}
          />
        )}

        {view === 'dashboard' && teamDetail && (
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
          />
        )}
        {view === 'graph' && teamDetail && (
          <TopologyView team={teamDetail} onTaskSelect={setSelectedTaskId} onAgentSelect={setSelectedAgentId} containerRef={graphContainerRef} selectedAgentId={selectedAgentId} alertedAgentNames={alertedAgentNames} />
        )}
        {view === 'commlog' && selectedTeamId && (
          <CommLogView
            teamId={selectedTeamId}
            teamDetail={teamDetail}
            onMessagesChange={msgs => { commMessagesRef.current = msgs; }}
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
        {view === 'cost' && selectedTeamId && (
          <CostView
            teamId={selectedTeamId}
            data={costData}
            loading={costLoading}
          />
        )}
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
    </>
  );
}
