import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamDetail, TimelineResponse, TaskChangeEvent } from '../../types';
import TimelineEvent from './TimelineEvent';
import CRTEmptyState from '../shared/CRTEmptyState';

interface TimelineViewProps {
  teamId: string;
  teamDetail: TeamDetail | null;
  onEventsChange?: (events: TaskChangeEvent[]) => void;
}

function useTimeline(teamId: string) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/timeline`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    setLoading(true);
    fetch_();
    const interval = setInterval(fetch_, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { data, loading };
}

type SortOrder = 'desc' | 'asc';

export default function TimelineView({ teamId, teamDetail, onEventsChange }: TimelineViewProps) {
  const { t } = useTranslation();
  const { data, loading } = useTimeline(teamId);
  const [order, setOrder] = useState<SortOrder>('desc');

  const teamName = teamDetail?.name ?? teamId;
  const events = data?.events ?? [];
  const sorted = [...events].sort((a, b) =>
    order === 'asc'
      ? a.timestamp.localeCompare(b.timestamp)
      : b.timestamp.localeCompare(a.timestamp)
  );

  // Expose events to parent for export
  useEffect(() => { onEventsChange?.(sorted); }, [sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const currentCount = sorted.length;
    if (currentCount > prevCountRef.current && !isFollowing) {
      setNewCount(n => n + (currentCount - prevCountRef.current));
    }
    prevCountRef.current = currentCount;
  }, [sorted.length, isFollowing]);

  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      if (order === 'desc') {
        scrollRef.current.scrollTop = 0;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      setNewCount(0);
    }
  }, [sorted.length, isFollowing, order]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (order === 'desc') {
      if (el.scrollTop > 60) {
        setIsFollowing(false);
      } else {
        setIsFollowing(true);
        setNewCount(0);
      }
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 60) {
        setIsFollowing(false);
      } else {
        setIsFollowing(true);
        setNewCount(0);
      }
    }
  }, [order]);

  const jumpToNewest = () => {
    if (scrollRef.current) {
      if (order === 'desc') {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
    setIsFollowing(true);
    setNewCount(0);
  };

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
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {t('timeline.title', { name: teamName })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <OrderBtn active={order === 'desc'} onClick={() => { setOrder('desc'); setIsFollowing(true); }} title="Newest first">NEW→OLD</OrderBtn>
            <OrderBtn active={order === 'asc'}  onClick={() => { setOrder('asc');  setIsFollowing(true); }} title="Oldest first">OLD→NEW</OrderBtn>
          </div>
          {/* Follow toggle */}
          <button
            onClick={() => { setIsFollowing(f => !f); if (!isFollowing) jumpToNewest(); }}
            title={isFollowing ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 8px',
              background: isFollowing ? 'var(--active-bg-med)' : 'transparent',
              border: `1px solid ${isFollowing ? 'var(--active-border)' : 'var(--border)'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px', letterSpacing: '0.1em',
              color: isFollowing ? 'var(--active-text)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: isFollowing ? 'var(--phosphor)' : 'var(--text-muted)',
              boxShadow: isFollowing ? '0 0 5px var(--phosphor)' : 'none',
              animation: isFollowing ? 'status-pulse 2s ease-in-out infinite' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ textTransform: 'uppercase' }}>{t('timeline.follow')}</span>
          </button>
          {!loading && (
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('timeline.event', { count: sorted.length })}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}
      >
        {loading && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '40px', textAlign: 'center' }}>
            LOADING...
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <CRTEmptyState title="NO EVENTS" subtitle="Activity will stream here in real-time" />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map(event => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>
      </div>

      {/* Floating "N new" banner */}
      {!isFollowing && newCount > 0 && (
        <button
          onClick={jumpToNewest}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 14px',
            background: 'var(--active-bg-hi)',
            border: '1px solid var(--active-border-hi)',
            borderRadius: '20px',
            color: 'var(--active-text)',
            fontSize: '9px', letterSpacing: '0.12em',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 10px var(--phosphor-glow)',
            zIndex: 20,
            whiteSpace: 'nowrap',
            animation: 'fade-up 0.2s ease-out',
          }}
        >
          {order === 'desc' ? '↑' : '↓'} <span style={{ textTransform: 'uppercase' }}>{t('timeline.new_event', { count: newCount })}</span>
        </button>
      )}
    </div>
  );
}

function OrderBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '2px 7px', fontSize: '9px', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--active-bg-med)' : 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--active-border)' : 'transparent'}`,
        borderRadius: '2px', cursor: 'pointer', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = active ? 'var(--active-text)' : 'var(--text-muted)'; }}
    >
      {children}
    </button>
  );
}
