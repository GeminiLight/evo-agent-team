import { randomUUID } from 'crypto';
import type { PermissionDecision, PermissionDecisionResult, PermissionRequest } from './types.js';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

type PendingEntry = {
  request: PermissionRequest;
  resolve: (result: PermissionDecisionResult) => void;
  onResolved?: (result: PermissionDecisionResult) => void;
  timer: NodeJS.Timeout;
};

const pendingRequests = new Map<string, PendingEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readNestedString(source: Record<string, unknown>, parentKeys: string[], childKeys: string[]): string | undefined {
  for (const parentKey of parentKeys) {
    const parent = source[parentKey];
    if (!isRecord(parent)) continue;
    const nested = readString(parent, childKeys);
    if (nested) return nested;
  }
  return undefined;
}

function sanitizePayload(payload: unknown): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      copy[key] = value;
      continue;
    }
    if (isRecord(value)) {
      copy[key] = Object.fromEntries(
        Object.entries(value).filter(([, nested]) => (
          typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean' || nested === null
        )),
      );
    }
  }
  return copy;
}

function buildPermissionRequest(payload: unknown, timeoutMs: number): PermissionRequest {
  const body = isRecord(payload) ? payload : {};
  const now = Date.now();

  return {
    id: randomUUID(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + timeoutMs).toISOString(),
    teamId: readString(body, ['teamId', 'team_id']),
    agentName: readString(body, ['agentName', 'agent_name']),
    toolName: readString(body, ['toolName', 'tool_name']) ?? readNestedString(body, ['tool', 'tool_input', 'input'], ['name']),
    command: readString(body, ['command']) ?? readNestedString(body, ['toolInput', 'tool_input', 'input'], ['command']),
    reason: readString(body, ['reason', 'message', 'description', 'prompt']),
    cwd: readString(body, ['cwd']),
    requestPayload: sanitizePayload(payload),
  };
}

export function createPermissionRequest(
  payload: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onResolved?: (result: PermissionDecisionResult) => void,
): {
  request: PermissionRequest;
  response: Promise<PermissionDecisionResult>;
} {
  const request = buildPermissionRequest(payload, timeoutMs);

  const response = new Promise<PermissionDecisionResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(request.id);
      const result: PermissionDecisionResult = {
        id: request.id,
        decision: 'deny',
        resolvedAt: new Date().toISOString(),
      };
      onResolved?.(result);
      resolve(result);
    }, timeoutMs);

    pendingRequests.set(request.id, { request, resolve, onResolved, timer });
  });

  return { request, response };
}

export function listPendingPermissionRequests(): PermissionRequest[] {
  return Array.from(pendingRequests.values())
    .map(entry => entry.request)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function resolvePermissionRequest(id: string, decision: PermissionDecision): PermissionDecisionResult | null {
  const entry = pendingRequests.get(id);
  if (!entry) return null;

  clearTimeout(entry.timer);
  pendingRequests.delete(id);

  const result: PermissionDecisionResult = {
    id,
    decision,
    resolvedAt: new Date().toISOString(),
  };

  entry.onResolved?.(result);
  entry.resolve(result);
  return result;
}
