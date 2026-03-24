import { useCallback, useEffect, useRef, useState } from 'react';
import type { PermissionDecisionResult, PermissionRequest, WsMessage } from '../types';

interface UsePermissionRequestsReturn {
  requests: PermissionRequest[];
  resolveRequest: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
  resolvingId: string | null;
}

export function usePermissionRequests(): UsePermissionRequestsReturn {
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/hooks/permission-requests');
      if (!res.ok) return;
      const data = await res.json();
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    const ws = new WebSocket('/ws');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        if (msg.type === 'permission_request_pending' && msg.payload) {
          const req = msg.payload as PermissionRequest;
          setRequests(prev => prev.some(item => item.id === req.id) ? prev : [...prev, req]);
        }
        if (msg.type === 'permission_request_resolved' && msg.payload) {
          const result = msg.payload as PermissionDecisionResult;
          setRequests(prev => prev.filter(item => item.id !== result.id));
          setResolvingId(current => current === result.id ? null : current);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const resolveRequest = useCallback(async (id: string, decision: 'approve' | 'deny') => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/hooks/permission-requests/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        setResolvingId(null);
        return false;
      }
      return true;
    } catch {
      setResolvingId(null);
      return false;
    }
  }, []);

  return { requests, resolveRequest, resolvingId };
}
