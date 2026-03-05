import type { Node, Edge } from '@xyflow/react';
import type { TeamDetail, Task } from '../../types';
import { getTaskStatus, getEdgeColor } from '../../utils/statusColors';

export type LayoutMode = 'hierarchical' | 'circular' | 'force';

const AGENT_Y = 50;
const TASK_START_Y = 250;
const TASK_Y_GAP = 190;
const NODE_X_GAP = 240;

function buildAgentStats(tasks: Task[]) {
  const inProgressByOwner = new Map<string, number>();
  const completedByOwner = new Map<string, number>();
  const taskCountByOwner = new Map<string, number>();
  for (const task of tasks) {
    if (task.owner) {
      taskCountByOwner.set(task.owner, (taskCountByOwner.get(task.owner) ?? 0) + 1);
      if (task.status === 'in_progress') {
        inProgressByOwner.set(task.owner, (inProgressByOwner.get(task.owner) ?? 0) + 1);
      }
      if (task.status === 'completed') {
        completedByOwner.set(task.owner, (completedByOwner.get(task.owner) ?? 0) + 1);
      }
    }
  }
  return { inProgressByOwner, completedByOwner, taskCountByOwner };
}

function buildEdges(tasks: Task[], members: NonNullable<TeamDetail['config']>['members']): Edge[] {
  const edges: Edge[] = [];
  const taskMap = new Map<string, Task>();
  for (const task of tasks) taskMap.set(task.id, task);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  for (const task of tasks) {
    const derivedStatus = getTaskStatus(task, allTaskSummary);
    for (const blockerId of task.blockedBy) {
      if (taskMap.has(blockerId)) {
        const edgeColor = getEdgeColor(derivedStatus);
        edges.push({
          id: `dep-${blockerId}-${task.id}`,
          source: `task-${blockerId}`,
          target: `task-${task.id}`,
          type: 'smoothstep',
          style: {
            stroke: edgeColor,
            opacity: derivedStatus === 'blocked' ? 0.6 : 0.25,
            strokeDasharray: '4 4',
            strokeWidth: 1.5,
          },
          animated: derivedStatus === 'pending' || derivedStatus === 'blocked',
        });
      }
    }
  }

  for (const task of tasks) {
    if (task.owner) {
      const agentExists = members.some(m => m.name === task.owner);
      if (agentExists) {
        const derivedStatus = getTaskStatus(task, allTaskSummary);
        const assignColor = getEdgeColor(derivedStatus);
        edges.push({
          id: `assign-${task.owner}-${task.id}`,
          source: `agent-${task.owner}`,
          target: `task-${task.id}`,
          type: 'smoothstep',
          style: {
            stroke: assignColor,
            strokeWidth: 1.5,
            opacity: 0.7,
          },
          animated: derivedStatus === 'in_progress',
        });
      }
    }
  }

  return edges;
}

// ─── Hierarchical (default) ───────────────────────────────────────────────────
function buildHierarchicalLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const { inProgressByOwner, completedByOwner, taskCountByOwner } = buildAgentStats(tasks);

  const agentSpan = members.length * NODE_X_GAP;
  const agentStartX = Math.max(0, (tasks.length * NODE_X_GAP - agentSpan) / 2);

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const isActive = (inProgressByOwner.get(member.name) ?? 0) > 0;
    nodes.push({
      id: `agent-${member.name}`,
      type: 'agentNode',
      position: { x: agentStartX + i * NODE_X_GAP, y: AGENT_Y },
      data: {
        member,
        isActive,
        taskCount: taskCountByOwner.get(member.name) ?? 0,
        inProgressCount: inProgressByOwner.get(member.name) ?? 0,
        completedCount: completedByOwner.get(member.name) ?? 0,
      },
    });
  }

  const taskMap = new Map<string, Task>();
  for (const task of tasks) taskMap.set(task.id, task);

  const depthMap = new Map<string, number>();
  const queue: string[] = [];
  for (const task of tasks) {
    const hasRealBlockers = task.blockedBy.some(id => taskMap.has(id));
    if (!hasRealBlockers) { depthMap.set(task.id, 0); queue.push(task.id); }
  }
  let head = 0;
  while (head < queue.length) {
    const currentId = queue[head++];
    const currentDepth = depthMap.get(currentId)!;
    for (const task of tasks) {
      if (task.blockedBy.includes(currentId)) {
        const existingDepth = depthMap.get(task.id);
        const newDepth = currentDepth + 1;
        if (existingDepth === undefined || newDepth > existingDepth) {
          depthMap.set(task.id, newDepth);
          queue.push(task.id);
        }
      }
    }
  }
  for (const task of tasks) { if (!depthMap.has(task.id)) depthMap.set(task.id, 0); }

  const tasksByDepth = new Map<number, Task[]>();
  for (const task of tasks) {
    const depth = depthMap.get(task.id)!;
    if (!tasksByDepth.has(depth)) tasksByDepth.set(depth, []);
    tasksByDepth.get(depth)!.push(task);
  }
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));
  for (const [depth, depthTasks] of tasksByDepth) {
    const y = TASK_START_Y + depth * TASK_Y_GAP;
    const totalWidth = depthTasks.length * NODE_X_GAP;
    const startX = Math.max(0, (Math.max(members.length, tasks.length) * NODE_X_GAP - totalWidth) / 2);
    for (let i = 0; i < depthTasks.length; i++) {
      const task = depthTasks[i];
      nodes.push({
        id: `task-${task.id}`,
        type: 'taskNode',
        position: { x: startX + i * NODE_X_GAP, y },
        data: { task, derivedStatus: getTaskStatus(task, allTaskSummary) },
      });
    }
  }

  return { nodes, edges: buildEdges(tasks, members) };
}

// ─── Circular ─────────────────────────────────────────────────────────────────
function buildCircularLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const { inProgressByOwner, completedByOwner, taskCountByOwner } = buildAgentStats(tasks);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  const allItems = [
    ...members.map(m => ({ kind: 'agent' as const, id: `agent-${m.name}`, member: m })),
    ...tasks.map(t => ({ kind: 'task' as const, id: `task-${t.id}`, task: t })),
  ];
  const total = allItems.length;
  const radius = Math.max(300, total * 60);
  const cx = radius + 50;
  const cy = radius + 50;

  for (let i = 0; i < allItems.length; i++) {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    const x = cx + radius * Math.cos(angle) - 100;
    const y = cy + radius * Math.sin(angle) - 60;
    const item = allItems[i];

    if (item.kind === 'agent') {
      const m = item.member;
      const isActive = (inProgressByOwner.get(m.name) ?? 0) > 0;
      nodes.push({
        id: item.id,
        type: 'agentNode',
        position: { x, y },
        data: {
          member: m,
          isActive,
          taskCount: taskCountByOwner.get(m.name) ?? 0,
          inProgressCount: inProgressByOwner.get(m.name) ?? 0,
          completedCount: completedByOwner.get(m.name) ?? 0,
        },
      });
    } else {
      const t = item.task;
      nodes.push({
        id: item.id,
        type: 'taskNode',
        position: { x, y },
        data: { task: t, derivedStatus: getTaskStatus(t, allTaskSummary) },
      });
    }
  }

  return { nodes, edges: buildEdges(tasks, members) };
}

// ─── Force-directed (approximated with grid + jitter, no physics lib needed) ──
function buildForceLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  // We do a simple spring-approximation: group connected components together.
  // Agents are placed in a horizontal band, tasks fan out below their owners.
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const { inProgressByOwner, completedByOwner, taskCountByOwner } = buildAgentStats(tasks);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));
  const nodes: Node[] = [];

  const AGENT_SPREAD = 280;
  const centerX = (members.length * AGENT_SPREAD) / 2;

  // Place agents in horizontal arc
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const isActive = (inProgressByOwner.get(m.name) ?? 0) > 0;
    const x = i * AGENT_SPREAD + 40;
    const y = AGENT_Y;
    nodes.push({
      id: `agent-${m.name}`,
      type: 'agentNode',
      position: { x, y },
      data: {
        member: m,
        isActive,
        taskCount: taskCountByOwner.get(m.name) ?? 0,
        inProgressCount: inProgressByOwner.get(m.name) ?? 0,
        completedCount: completedByOwner.get(m.name) ?? 0,
      },
    });
  }

  // Group tasks by owner with radial spread below the owner's agent
  const ownerIndex = new Map<string, number>();
  for (let i = 0; i < members.length; i++) {
    ownerIndex.set(members[i].name, i);
  }
  const tasksByOwner = new Map<string, Task[]>();
  const unowned: Task[] = [];
  for (const task of tasks) {
    if (task.owner && ownerIndex.has(task.owner)) {
      if (!tasksByOwner.has(task.owner)) tasksByOwner.set(task.owner, []);
      tasksByOwner.get(task.owner)!.push(task);
    } else {
      unowned.push(task);
    }
  }

  for (const [ownerName, ownerTasks] of tasksByOwner) {
    const agentX = (ownerIndex.get(ownerName)! * AGENT_SPREAD) + 40 + 80; // center of agent node
    const spread = Math.min(180, ownerTasks.length * 50);
    for (let i = 0; i < ownerTasks.length; i++) {
      const t = ownerTasks[i];
      const offsetX = ownerTasks.length === 1 ? 0 : -spread / 2 + (i / (ownerTasks.length - 1)) * spread;
      const offsetY = 220 + Math.abs(offsetX) * 0.3;
      nodes.push({
        id: `task-${t.id}`,
        type: 'taskNode',
        position: { x: agentX + offsetX - 100, y: offsetY },
        data: { task: t, derivedStatus: getTaskStatus(t, allTaskSummary) },
      });
    }
  }

  // Unowned tasks centered at bottom
  for (let i = 0; i < unowned.length; i++) {
    const t = unowned[i];
    const spread = unowned.length * 220;
    const x = centerX - spread / 2 + i * 220;
    nodes.push({
      id: `task-${t.id}`,
      type: 'taskNode',
      position: { x, y: 500 },
      data: { task: t, derivedStatus: getTaskStatus(t, allTaskSummary) },
    });
  }

  return { nodes, edges: buildEdges(tasks, members) };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function buildGraphElements(
  team: TeamDetail,
  layout: LayoutMode = 'hierarchical',
): { nodes: Node[]; edges: Edge[] } {
  if (layout === 'circular') return buildCircularLayout(team);
  if (layout === 'force') return buildForceLayout(team);
  return buildHierarchicalLayout(team);
}
