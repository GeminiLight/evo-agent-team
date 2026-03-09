import { useState, useCallback } from 'react';

export function useAgentRespond(teamId: string) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(async (agentName: string, message: string): Promise<boolean> => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/agents/${agentName}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = (json as { error?: string }).error ?? 'Request failed';
        setError(teamId === 'demo-team' ? 'Not available in demo mode' : msg);
        return false;
      }
      return true;
    } catch {
      setError('Network error');
      return false;
    } finally {
      setSending(false);
    }
  }, [teamId]);

  return { respond, sending, error, clearError: () => setError(null) };
}
