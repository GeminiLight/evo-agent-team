import type { Task, TaskChangeEvent, TimelineResponse } from './types.js';

const taskSnapshots = new Map<string, Map<string, Task>>();
const eventLog = new Map<string, TaskChangeEvent[]>();
const MAX_EVENTS = 500;

export function recordSnapshot(teamId: string, tasks: Task[]): void {
  const snapshot = taskSnapshots.get(teamId) ?? new Map<string, Task>();
  const events = eventLog.get(teamId) ?? [];
  const now = new Date().toISOString();

  for (const task of tasks) {
    const prev = snapshot.get(task.id);
    if (!prev) {
      // First time seeing this task
      events.push({
        id: `${teamId}-${task.id}-${Date.now()}-init`,
        teamId,
        taskId: task.id,
        taskSubject: task.subject,
        oldStatus: null,
        newStatus: task.status,
        owner: task.owner,
        timestamp: now,
      });
    } else if (prev.status !== task.status) {
      // Status changed
      events.push({
        id: `${teamId}-${task.id}-${Date.now()}-change`,
        teamId,
        taskId: task.id,
        taskSubject: task.subject,
        oldStatus: prev.status,
        newStatus: task.status,
        owner: task.owner,
        timestamp: now,
      });
    }
    snapshot.set(task.id, { ...task });
  }

  // Cap at MAX_EVENTS — remove oldest
  while (events.length > MAX_EVENTS) events.shift();

  taskSnapshots.set(teamId, snapshot);
  eventLog.set(teamId, events);
}

export function getTimeline(teamId: string): TaskChangeEvent[] {
  return eventLog.get(teamId) ?? [];
}
