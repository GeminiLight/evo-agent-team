import { useState, useEffect, useCallback, useRef } from 'react';
import type { TeamSummary, TeamDetail, WsMessage } from '../types';

interface UseTeamDataReturn {
  teams: TeamSummary[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string) => void;
  teamDetail: TeamDetail | null;
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

  const selectedIdRef = useRef(selectedTeamId);
  selectedIdRef.current = selectedTeamId;

  // Polling interval refs so we can clear them when WS connects
  const teamsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
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
      const res = await fetch(`/api/teams/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setTeamDetail(data);
    } catch {
      // silent
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!teamsIntervalRef.current) {
      teamsIntervalRef.current = setInterval(fetchTeams, pollInterval);
    }
    if (!detailIntervalRef.current && selectedIdRef.current) {
      detailIntervalRef.current = setInterval(() => {
        if (selectedIdRef.current) fetchDetail(selectedIdRef.current);
      }, pollInterval);
    }
  }, [fetchTeams, fetchDetail, pollInterval]);

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
    if (detailIntervalRef.current) {
      clearInterval(detailIntervalRef.current);
    }
    detailIntervalRef.current = setInterval(() => {
      if (selectedIdRef.current) fetchDetail(selectedIdRef.current);
    }, pollInterval);
    return () => {
      if (detailIntervalRef.current) {
        clearInterval(detailIntervalRef.current);
        detailIntervalRef.current = null;
      }
    };
  }, [selectedTeamId, wsConnected, fetchDetail, pollInterval]);

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

  return { teams, selectedTeamId, setSelectedTeamId, teamDetail, loading, isDemoMode, enableDemo, wsConnected };
}
