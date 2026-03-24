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
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // WebSocket with reconnection + polling fallback
  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = () => {
      if (!isMounted) return;

      const ws = new WebSocket('/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        // Clear polling when WS connects
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

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

      ws.onclose = () => {
        if (!isMounted) return;
        // Attempt reconnection with exponential backoff
        const attempt = reconnectAttemptRef.current;
        const maxAttempts = 3;

        if (attempt < maxAttempts) {
          const delayMs = Math.min(500 * Math.pow(2, attempt), 5000);
          reconnectAttemptRef.current = attempt + 1;
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delayMs);
        } else {
          // After 3 failed attempts, fallback to polling
          console.warn('[PermissionRequests] WS reconnection failed, falling back to polling');
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(fetchPending, 10000);
          }
        }
      };

      ws.onerror = () => {
        // Error handled by onclose
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchPending]);

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
