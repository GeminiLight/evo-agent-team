import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import { fetchWithCache } from '../utils/fetchCache';
import type { TeamSummary, TeamDetail, WsMessage } from '../types';

interface UseTeamDataReturn {
  teams: TeamSummary[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string) => void;
  teamDetail: TeamDetail | null;
  setTeamDetail: React.Dispatch<React.SetStateAction<TeamDetail | null>>;
  loading: boolean;
  isDemoMode: boolean;
  enableDemo: () => Promise<void>;
  wsConnected: boolean;
}

export function useTeamData(pollInterval = 2000): UseTeamDataReturn {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isUserIdle, setIsUserIdle] = useState(false);

  const selectedIdRef = useRef(selectedTeamId);
  selectedIdRef.current = selectedTeamId;

  // Polling interval refs so we can clear them when WS connects
  const teamsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Calculate current polling interval based on visibility and idle state
  const calculateInterval = useCallback((): number => {
    if (!isTabVisible) return Math.max(pollInterval * 5, 10000); // 5x slower when hidden
    if (isUserIdle) return Math.max(pollInterval * 5, 10000); // 5x slower when idle
    return pollInterval;
  }, [pollInterval, isTabVisible, isUserIdle]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetchWithCache('/api/teams');
      if (!res.ok) return;
      const data = await res.json();
      setTeams(data.teams ?? []);
      setIsDemoMode(data.isDemoMode ?? false);

      if (data.teams?.length > 0) {
        const currentValid = selectedIdRef.current && data.teams.some((t: TeamSummary) => t.id === selectedIdRef.current);
        if (!currentValid) {
          const demoTeam = data.teams.find((t: TeamSummary) => t.id === 'demo-team');
          const configTeam = data.teams.find((t: TeamSummary) => t.hasConfig);
          setSelectedTeamId((demoTeam ?? configTeam ?? data.teams[0]).id);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetchWithCache(`/api/teams/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setTeamDetail(data);
    } catch {
      // silent
    }
  }, []);

  // Track user activity for idle detection
  useEffect(() => {
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
      if (isUserIdle) {
        setIsUserIdle(false);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setIsUserIdle(true);
      }, 60000); // 60s idle threshold
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    // Initial timer
    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isUserIdle]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startPolling = useCallback(() => {
    const interval = calculateInterval();

    if (!teamsIntervalRef.current) {
      teamsIntervalRef.current = setInterval(fetchTeams, interval);
    }
    if (!detailIntervalRef.current && selectedIdRef.current) {
      detailIntervalRef.current = setInterval(() => {
        if (selectedIdRef.current) fetchDetail(selectedIdRef.current);
      }, interval);
    }
  }, [fetchTeams, fetchDetail, calculateInterval]);

  const stopPolling = useCallback(() => {
    if (teamsIntervalRef.current) {
      clearInterval(teamsIntervalRef.current);
      teamsIntervalRef.current = null;
    }
    if (detailIntervalRef.current) {
      clearInterval(detailIntervalRef.current);
      detailIntervalRef.current = null;
    }
  }, []);

  const connectWs = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket('/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      stopPolling();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        if (msg.type === 'teams_update') {
          fetchTeams();
        } else if (msg.type === 'team_detail_update') {
          if (msg.teamId && msg.teamId === selectedIdRef.current) {
            fetchDetail(msg.teamId);
          }
        }
        // 'ping' messages require no action — server uses ws pong protocol
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
      startPolling();
    };

    ws.onclose = () => {
      setWsConnected(false);
      startPolling();
      // Attempt reconnect after 5s
      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectWs();
        }, 5000);
      }
    };
  }, [fetchTeams, fetchDetail, startPolling, stopPolling]);

  // Initial data fetch
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Connect WebSocket on mount; fall back to polling if it fails
  useEffect(() => {
    // Start polling immediately as fallback; WS open will clear it
    startPolling();
    connectWs();

    return () => {
      stopPolling();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs, startPolling, stopPolling]);

  // Fetch detail whenever selectedTeamId changes
  useEffect(() => {
    if (!selectedTeamId) return;
    fetchDetail(selectedTeamId);
  }, [selectedTeamId, fetchDetail]);

  // Restart detail polling interval if polling is active and selectedTeamId changes
  useEffect(() => {
    if (!selectedTeamId || wsConnected) return;
    const interval = calculateInterval();
    if (detailIntervalRef.current) {
      clearInterval(detailIntervalRef.current);
    }
    detailIntervalRef.current = setInterval(() => {
      if (selectedIdRef.current) fetchDetail(selectedIdRef.current);
    }, interval);
    return () => {
      if (detailIntervalRef.current) {
        clearInterval(detailIntervalRef.current);
        detailIntervalRef.current = null;
      }
    };
  }, [selectedTeamId, wsConnected, fetchDetail, calculateInterval]);

  // Adjust polling intervals when visibility or idle state changes
  useEffect(() => {
    if (wsConnected) return; // Skip when using WebSocket

    // Stop current polling
    stopPolling();
    
    // Restart polling with recalculated interval
    startPolling();
  }, [isTabVisible, isUserIdle, wsConnected, startPolling, stopPolling]);

  const enableDemo = useCallback(async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoMode: 'on' }),
      });
      setSelectedTeamId('demo-team');
      await fetchTeams();
    } catch {
      // silent
    }
  }, [fetchTeams]);

  return { teams, selectedTeamId, setSelectedTeamId, teamDetail, setTeamDetail, loading, isDemoMode, enableDemo, wsConnected };
}

