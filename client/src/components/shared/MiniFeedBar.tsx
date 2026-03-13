import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentMessage, TaskChangeEvent } from '../../types';
import { agentColor, agentInitials, agentAvatarStyle } from '../../utils/agentColors';
import { STATUS_COLORS, type StatusKey } from '../../utils/statusColors';

// ─── Data hooks (lightweight, independent polls) ─────────────────────────────

function useMiniMessages(teamId: string | null) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/teams/${teamId}/messages`);
        if (res.ok) { const j = await res.json(); if (!cancelled) setMessages(j.messages ?? []); }
      } catch { /* silent */ }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [teamId]);
  return messages;
}

function useMiniEvents(teamId: string | null) {
  const [events, setEvents] = useState<TaskChangeEvent[]>([]);
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/teams/${teamId}/timeline`);
        if (res.ok) { const j = await res.json(); if (!cancelled) setEvents(j.events ?? []); }
      } catch { /* silent */ }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [teamId]);
  return events;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedEntry =
  | { kind: 'msg'; data: AgentMessage; ts: number }
  | { kind: 'evt'; data: TaskChangeEvent; ts: number };

// ─── Time formatting ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MiniFeedBarProps {
  teamId: string | null;
  onOpenActivity?: () => void;
  maxItems?: number;
}

export default function MiniFeedBar({ teamId, onOpenActivity, maxItems = 5 }: MiniFeedBarProps) {
  const { t } = useTranslation();
  const messages = useMiniMessages(teamId);
  const events = useMiniEvents(teamId);

  const entries = useMemo(() => {
    const all: FeedEntry[] = [
      ...messages.map(m => ({ kind: 'msg' as const, data: m, ts: new Date(m.timestamp).getTime() })),
      ...events.map(e => ({ kind: 'evt' as const, data: e, ts: new Date(e.timestamp).getTime() })),
    ];
    all.sort((a, b) => b.ts - a.ts);
    return all.slice(0, maxItems);
  }, [messages, events, maxItems]);

  if (!teamId || entries.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '32px',
      background: 'var(--surface-0)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '0',
      fontFamily: 'var(--font-mono)',
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {/* Label */}
      <button
        onClick={onOpenActivity}
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '2px 10px 2px 0',
          background: 'none', border: 'none',
          cursor: onOpenActivity ? 'pointer' : 'default',
          fontFamily: 'var(--font-mono)',
          borderRight: '1px solid var(--border)',
          marginRight: '10px',
        }}
        title={t('activity.open_feed')}
      >
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: 'var(--phosphor)',
          boxShadow: '0 0 4px var(--phosphor)',
          animation: 'status-pulse 2s ease-in-out infinite',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {t('activity.feed')}
        </span>
      </button>

      {/* Feed entries — horizontally scrolling */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        overflow: 'hidden',
      }}>
        {entries.map((entry, idx) => (
          <FeedChip key={entry.kind === 'msg' ? (entry.data as AgentMessage).id : (entry.data as TaskChangeEvent).id} entry={entry} />
        ))}
      </div>

      {/* Total count */}
      <div style={{
        flexShrink: 0,
        fontSize: '9px',
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        paddingLeft: '10px',
        borderLeft: '1px solid var(--border)',
      }}>
        {messages.length + events.length}
      </div>
    </div>
  );
}

// ─── Feed chip — ultra-compact inline entry ──────────────────────────────────

function FeedChip({ entry }: { entry: FeedEntry }) {
  if (entry.kind === 'msg') {
    const m = entry.data as AgentMessage;
    const color = agentColor(m.sender);
    const isHuman = m.parsedType === 'human_input_request';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        flexShrink: 0, maxWidth: '260px',
      }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}>
          {timeAgo(entry.ts)}
        </span>
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: isHuman ? 'var(--amber)' : color,
          boxShadow: isHuman ? '0 0 4px var(--amber)' : 'none',
          flexShrink: 0, display: 'inline-block',
          animation: isHuman ? 'status-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: '9px', color, fontWeight: 600,
          letterSpacing: '0.04em', flexShrink: 0,
        }}>
          {m.sender}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>→</span>
        <span style={{
          fontSize: '9px', color: agentColor(m.recipient),
          letterSpacing: '0.04em', flexShrink: 0,
        }}>
          {m.recipient}
        </span>
        <span style={{
          fontSize: '9px', color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}>
          {m.text.length > 40 ? m.text.slice(0, 40) + '...' : m.text}
        </span>
      </div>
    );
  }

  // Event chip
  const e = entry.data as TaskChangeEvent;
  const dotColor = STATUS_COLORS[e.newStatus as StatusKey]?.border ?? 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      flexShrink: 0, maxWidth: '240px',
    }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}>
        {timeAgo(entry.ts)}
      </span>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: dotColor, boxShadow: `0 0 3px ${dotColor}`,
        flexShrink: 0, display: 'inline-block',
      }} />
      <span style={{
        fontSize: '9px', color: dotColor, letterSpacing: '0.06em',
        fontWeight: 600, flexShrink: 0,
      }}>
        #{e.taskId}
      </span>
      <span style={{
        fontSize: '9px', color: 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}>
        {e.taskSubject.length > 30 ? e.taskSubject.slice(0, 30) + '...' : e.taskSubject}
      </span>
      <span style={{
        fontSize: '9px', letterSpacing: '0.1em',
        color: dotColor, background: `${dotColor}15`,
        border: `1px solid ${dotColor}30`,
        padding: '0px 4px', borderRadius: '2px',
        flexShrink: 0,
      }}>
        {e.newStatus === 'completed' ? 'DONE' : e.newStatus === 'in_progress' ? 'RUN' : 'NEW'}
      </span>
    </div>
  );
}
