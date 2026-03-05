import { useState, useRef, useCallback } from 'react';
import { useTeamData } from './hooks/useTeamData';
import { usePendingHumanRequests } from './hooks/usePendingHumanRequests';
import { useProjectTodos } from './hooks/useProjectTodos';
import { useInboxSummary } from './hooks/useInboxSummary';
import { useSessionStats } from './hooks/useSessionStats';
import { useSessionHistory } from './hooks/useSessionHistory';
import Layout, { type ViewType } from './components/Layout';
import EmptyState from './components/EmptyState';
import DashboardView from './components/dashboard/DashboardView';
import { TopologyView } from './components/graph/TopologyView';
import TaskDetailPanel from './components/TaskDetailPanel';
import AgentProfilePanel from './components/AgentProfilePanel';
import CommLogView from './components/commlog/CommLogView';
import TimelineView from './components/timeline/TimelineView';
import SessionHistoryView from './components/history/SessionHistoryView';
import { exportGraphAsPng, exportTeamAsJson, exportTasksCsv, exportCommLogCsv, exportTimelineCsv } from './utils/exportUtils';
import type { AgentMessage, TaskChangeEvent } from './types';

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [pollInterval] = useState(2000);
  const { teams, selectedTeamId, setSelectedTeamId, teamDetail, loading, isDemoMode, enableDemo, wsConnected } = useTeamData(pollInterval);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = teamDetail?.tasks.find(t => t.id === selectedTaskId) ?? null;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = teamDetail?.config?.members.find(m => m.agentId === selectedAgentId) ?? null;
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const pendingHuman = usePendingHumanRequests(selectedTeamId);
  const projectTodos = useProjectTodos(selectedTeamId);
  const sessionHistory = useSessionHistory(selectedTeamId);
  const inboxSummary = useInboxSummary(selectedTeamId);
  const sessionStats = useSessionStats(selectedTeamId);

  const leadName = teamDetail?.config?.leadAgentId?.split('@')[0] ?? null;

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
      >
        {view === 'dashboard' && teamDetail && (
          <DashboardView team={teamDetail} onTaskSelect={setSelectedTaskId} onAgentSelect={setSelectedAgentId} pendingHumanAgents={pendingHuman.agentNames} pendingHumanDetails={pendingHuman.details} inboxSummary={inboxSummary} leadName={leadName} projectTodos={projectTodos} />
        )}
        {view === 'graph' && teamDetail && (
          <TopologyView team={teamDetail} onTaskSelect={setSelectedTaskId} containerRef={graphContainerRef} />
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
        {view === 'history' && (
          <SessionHistoryView
            messages={sessionHistory.messages}
            sessionId={sessionHistory.sessionId}
            loading={sessionHistory.loading}
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
