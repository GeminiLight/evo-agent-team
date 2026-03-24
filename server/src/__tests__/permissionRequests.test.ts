import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPermissionRequest, listPendingPermissionRequests, resolvePermissionRequest } from '../permissionRequests.js';

describe('permissionRequests store', () => {
  beforeEach(() => {
    // Clear all pending requests before each test
    while (listPendingPermissionRequests().length > 0) {
      const pending = listPendingPermissionRequests();
      if (pending[0]) {
        resolvePermissionRequest(pending[0].id, 'deny');
      }
    }
  });

  describe('Normal paths', () => {
    it('creates, lists, and resolves a permission request', async () => {
      const { request, response } = createPermissionRequest({
        teamId: 'team-a',
        agentName: 'worker',
        toolName: 'Bash',
        command: 'npm test',
      });

      const pending = listPendingPermissionRequests();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(request.id);
      expect(pending[0].teamId).toBe('team-a');

      const resolved = resolvePermissionRequest(request.id, 'approve');
      expect(resolved?.decision).toBe('approve');

      const finalResult = await response;
      expect(finalResult.decision).toBe('approve');
      expect(listPendingPermissionRequests()).toHaveLength(0);
    });

    it('handles deny decision', async () => {
      const { request, response } = createPermissionRequest({
        agentName: 'agent1',
        toolName: 'Bash',
      });

      resolvePermissionRequest(request.id, 'deny');
      const result = await response;
      expect(result.decision).toBe('deny');
    });
  });

  describe('Boundary cases', () => {
    it('returns null when resolving missing request', () => {
      expect(resolvePermissionRequest('missing-id', 'deny')).toBeNull();
    });

    it('prevents double resolution of same request', async () => {
      const { request, response } = createPermissionRequest({
        agentName: 'agent1',
        toolName: 'Bash',
      });

      const firstResolve = resolvePermissionRequest(request.id, 'approve');
      expect(firstResolve?.decision).toBe('approve');

      const secondResolve = resolvePermissionRequest(request.id, 'deny');
      expect(secondResolve).toBeNull();

      const result = await response;
      expect(result.decision).toBe('approve');
    });

    it('auto-denies request after timeout (5 min)', async () => {
      vi.useFakeTimers();
      const timeoutMs = 100; // Use small timeout for testing

      const onResolved = vi.fn();
      const { response } = createPermissionRequest(
        { agentName: 'agent1', toolName: 'Bash' },
        timeoutMs,
        onResolved
      );

      // Fast-forward past timeout
      vi.advanceTimersByTime(timeoutMs + 10);

      const result = await response;
      expect(result.decision).toBe('deny');
      expect(onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'deny' })
      );
      expect(listPendingPermissionRequests()).toHaveLength(0);

      vi.useRealTimers();
    });

    it('request with no agentName still creates', async () => {
      const { request, response } = createPermissionRequest({
        toolName: 'Bash',
        command: 'echo test',
      });

      expect(request.agentName).toBeUndefined();
      expect(request.toolName).toBe('Bash');
      expect(request.command).toBe('echo test');

      resolvePermissionRequest(request.id, 'approve');
      const result = await response;
      expect(result.decision).toBe('approve');
    });

    it('handles concurrent request creation', async () => {
      const req1 = createPermissionRequest({ agentName: 'a1', toolName: 'Bash' });
      const req2 = createPermissionRequest({ agentName: 'a2', toolName: 'Bash' });
      const req3 = createPermissionRequest({ agentName: 'a3', toolName: 'Bash' });

      const pending = listPendingRequests();
      expect(pending).toHaveLength(3);

      resolvePermissionRequest(req2.request.id, 'approve');
      expect(listPendingPermissionRequests()).toHaveLength(2);

      const result2 = await req2.response;
      expect(result2.decision).toBe('approve');
    });
  });

  describe('Error paths', () => {
    it('timeout fires even without explicit resolve', async () => {
      vi.useFakeTimers();
      const timeoutMs = 50;

      const { request, response } = createPermissionRequest(
        { agentName: 'agent1', toolName: 'Bash' },
        timeoutMs
      );

      expect(listPendingPermissionRequests()).toHaveLength(1);

      vi.advanceTimersByTime(timeoutMs + 10);

      const result = await response;
      expect(result.decision).toBe('deny');
      expect(listPendingPermissionRequests()).toHaveLength(0);

      vi.useRealTimers();
    });

    it('cannot resolve after timeout fires', async () => {
      vi.useFakeTimers();
      const timeoutMs = 50;

      const { request, response } = createPermissionRequest(
        { agentName: 'agent1', toolName: 'Bash' },
        timeoutMs
      );

      vi.advanceTimersByTime(timeoutMs + 10);
      await response;

      // Try to resolve after timeout
      const resolved = resolvePermissionRequest(request.id, 'approve');
      expect(resolved).toBeNull();

      vi.useRealTimers();
    });

    it('handles sanitized payloads', async () => {
      const complexPayload = {
        agentName: 'test-agent',
        toolName: 'Bash',
        command: 'echo $SECRET',
        nested: {
          key: 'value',
          number: 42,
        },
        shouldIgnore: () => 'function',
        buffer: Buffer.from('data'),
      };

      const { request } = createPermissionRequest(complexPayload);

      expect(request.requestPayload).toBeDefined();
      expect(request.requestPayload?.agentName).toBe('test-agent');
      expect(request.requestPayload?.nested).toBeDefined();
      expect(request.requestPayload?.shouldIgnore).toBeUndefined();
      expect(request.requestPayload?.buffer).toBeUndefined();
    });
  });
});

// Helper: workaround for potential issue in beforeEach cleanup
function listPendingRequests() {
  return listPendingPermissionRequests();
}
