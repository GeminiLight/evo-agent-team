import { describe, it, expect } from 'vitest';
import { createPermissionRequest, listPendingPermissionRequests, resolvePermissionRequest } from '../permissionRequests.js';

describe('permissionRequests store', () => {
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

  it('returns null when resolving missing request', () => {
    expect(resolvePermissionRequest('missing-id', 'deny')).toBeNull();
  });
});
