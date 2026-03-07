/**
 * B3 wrapper: adds agent selector tabs above SessionHistoryView.
 * The lead agent is selected by default. If no agent sessions are available,
 * it falls back to the plain sessionHistory hook (lead only).
 */

import { useState } from 'react';
import type { TeamDetail } from '../../types';
import { useSessionHistory } from '../../hooks/useSessionHistory';
import { useAgentSessions } from '../../hooks/useAgentSessions';
import SessionHistoryView from './SessionHistoryView';

interface SessionHistoryContainerProps {
  teamId: string;
  teamDetail: TeamDetail | null;
}

export default function SessionHistoryContainer({ teamId, teamDetail }: SessionHistoryContainerProps) {
  const { agents, loading: agentsLoading } = useAgentSessions(teamId);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Use selectedAgent or null (= lead)
  const targetAgent = selectedAgent;
  const { messages, sessionId, loading } = useSessionHistory(teamId, targetAgent);

  const teamName = teamDetail?.name ?? teamId;

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 100px)',
      minHeight: '280px',
    }}>
      {/* Header with agent tabs */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, flexWrap: 'wrap', gap: '8px',
      }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          HISTORY // {teamName.toUpperCase()}
        </span>

        {/* Agent selector */}
        {agents.length > 0 && (
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
            {/* "LEAD" = null (default lead session) */}
            <AgentTab
              label="LEAD"
              active={selectedAgent === null}
              isLead={true}
              msgCount={agents.find(a => a.isLead)?.messageCount}
              onClick={() => setSelectedAgent(null)}
            />
            {agents.filter(a => !a.isLead).map(a => (
              <AgentTab
                key={a.sessionId}
                label={a.agentName}
                active={selectedAgent === a.agentName}
                isLead={false}
                msgCount={a.messageCount}
                onClick={() => setSelectedAgent(a.agentName)}
              />
            ))}
          </div>
        )}

        {agentsLoading && agents.length === 0 && (
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            SCANNING SESSIONS...
          </span>
        )}
      </div>

      {/* History view */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
        <SessionHistoryView
          messages={messages}
          sessionId={sessionId}
          loading={loading}
        />
      </div>
    </div>
  );
}

function AgentTab({
  label, active, isLead, msgCount, onClick,
}: {
  label: string;
  active: boolean;
  isLead: boolean;
  msgCount?: number;
  onClick: () => void;
}) {
  const color = isLead ? 'var(--amber, #f5a623)' : 'var(--phosphor, #39ff6a)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px',
        background: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: '2px',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: '8px', letterSpacing: '0.08em',
        color: active ? color : 'var(--text-muted)',
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
    >
      {isLead && (
        <span style={{ fontSize: '7px', color: active ? color : 'var(--text-muted)' }}>★</span>
      )}
      {label.toUpperCase()}
      {msgCount !== undefined && (
        <span style={{ fontSize: '7px', opacity: 0.6 }}>{msgCount}</span>
      )}
    </button>
  );
}
