import { Router } from 'express';
import { createPermissionRequest, listPendingPermissionRequests, resolvePermissionRequest } from '../permissionRequests.js';
import { broadcastPermissionRequestPending, broadcastPermissionRequestResolved } from '../websocket.js';
import type { PermissionDecision } from '../types.js';

const router = Router();

router.get('/hooks/permission-requests', (_req, res) => {
  res.json({ requests: listPendingPermissionRequests() });
});

router.post('/hooks/permission-request', async (req, res) => {
  const { request, response } = createPermissionRequest(req.body, undefined, broadcastPermissionRequestResolved);
  broadcastPermissionRequestPending(request);

  const result = await response;
  res.json({ decision: result.decision });
});

router.post('/hooks/permission-requests/:id/decision', (req, res) => {
  const { id } = req.params;
  const decision = req.body?.decision;

  if (decision !== 'approve' && decision !== 'deny') {
    res.status(400).json({ error: 'decision must be approve or deny' });
    return;
  }

  const result = resolvePermissionRequest(id, decision as PermissionDecision);
  if (!result) {
    res.status(404).json({ error: 'Permission request not found' });
    return;
  }

  res.json({ ok: true, ...result });
});

export default router;
