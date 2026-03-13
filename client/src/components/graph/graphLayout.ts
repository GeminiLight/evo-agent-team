import type { Node, Edge } from '@xyflow/react';
import type { TeamDetail, Task } from '../../types';
import { getTaskStatus, getEdgeColor } from '../../utils/statusColors';

export type LayoutMode = 'hierarchical' | 'circular' | 'force';
export type StatusFilter = 'all' | 'active' | 'blocked';

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

function makeAgentNode(
  member: NonNullable<TeamDetail['config']>['members'][number],
  x: number,
  y: number,
  leadName: string | null,
  stats: ReturnType<typeof buildAgentStats>,
): Node {
  const isActive = (stats.inProgressByOwner.get(member.name) ?? 0) > 0;
  return {
    id: `agent-${member.name}`,
    type: 'agentNode',
    position: { x, y },
    data: {
      member,
      isActive,
      isLead: member.name === leadName,
      taskCount: stats.taskCountByOwner.get(member.name) ?? 0,
      inProgressCount: stats.inProgressByOwner.get(member.name) ?? 0,
      completedCount: stats.completedByOwner.get(member.name) ?? 0,
    },
  };
}

function makeTaskNode(task: Task, x: number, y: number, allTaskSummary: { id: string; status: string }[]): Node {
  return {
    id: `task-${task.id}`,
    type: 'taskNode',
    position: { x, y },
    data: { task, derivedStatus: getTaskStatus(task, allTaskSummary) },
  };
}

function buildEdges(
  tasks: Task[],
  members: NonNullable<TeamDetail['config']>['members'],
  edgeType: 'smoothstep' | 'default' = 'smoothstep',
): Edge[] {
  const edges: Edge[] = [];
  const taskMap = new Map<string, Task>();
  for (const task of tasks) taskMap.set(task.id, task);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  // Dependency edges — dashed, thin, muted
  for (const task of tasks) {
    const derivedStatus = getTaskStatus(task, allTaskSummary);
    for (const blockerId of task.blockedBy) {
      if (taskMap.has(blockerId)) {
        const edgeColor = getEdgeColor(derivedStatus);
        edges.push({
          id: `dep-${blockerId}-${task.id}`,
          source: `task-${blockerId}`,
          target: `task-${task.id}`,
          type: edgeType,
          style: {
            stroke: edgeColor,
            opacity: derivedStatus === 'blocked' ? 0.5 : 0.12,
            strokeDasharray: '4 3',
            strokeWidth: 1,
          },
          animated: derivedStatus === 'blocked',
        });
      }
    }
  }

  // Assignment edges — solid, prominent
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
          type: edgeType,
          style: {
            stroke: assignColor,
            strokeWidth: 2.2,
            opacity: derivedStatus === 'completed' ? 0.15 : 0.6,
          },
          animated: derivedStatus === 'in_progress',
        });
      }
    }
  }

  return edges;
}

// Helper: sort tasks — in_progress first, then pending, then blocked, then completed
function sortTasks(tasks: Task[], allTaskSummary: { id: string; status: string }[]): Task[] {
  const order: Record<string, number> = { in_progress: 0, pending: 1, blocked: 2, completed: 3 };
  return [...tasks].sort((a, b) => {
    const sa = getTaskStatus(a, allTaskSummary);
    const sb = getTaskStatus(b, allTaskSummary);
    return (order[sa] ?? 9) - (order[sb] ?? 9);
  });
}

// ─── Hierarchical → Swimlane Layout ─────────────────────────────────────────
// Each agent gets a vertical column. Tasks stack below their owner.
// Unowned tasks go in a "pool" column on the right.
function buildHierarchicalLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const leadName = team.config?.leadAgentId?.split('@')[0] ?? null;
  const stats = buildAgentStats(tasks);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  // Group tasks by owner
  const tasksByOwner = new Map<string, Task[]>();
  const unowned: Task[] = [];
  const memberNames = new Set(members.map(m => m.name));
  for (const task of tasks) {
    if (task.owner && memberNames.has(task.owner)) {
      if (!tasksByOwner.has(task.owner)) tasksByOwner.set(task.owner, []);
      tasksByOwner.get(task.owner)!.push(task);
    } else {
      unowned.push(task);
    }
  }

  const LANE_WIDTH = 240;
  const LANE_GAP = 40;
  const AGENT_Y = 40;
  const TASK_START_Y = 160;
  const TASK_Y_GAP = 130;
  const TASK_CARD_WIDTH = 190;
  const AGENT_CARD_WIDTH = 160;

  // Agents in a row — each centered in their lane
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const laneX = i * (LANE_WIDTH + LANE_GAP);
    const agentX = laneX + (LANE_WIDTH - AGENT_CARD_WIDTH) / 2;
    nodes.push(makeAgentNode(m, agentX, AGENT_Y, leadName, stats));

    // Stack tasks below
    const ownerTasks = sortTasks(tasksByOwner.get(m.name) ?? [], allTaskSummary);
    for (let j = 0; j < ownerTasks.length; j++) {
      const taskX = laneX + (LANE_WIDTH - TASK_CARD_WIDTH) / 2;
      const taskY = TASK_START_Y + j * TASK_Y_GAP;
      nodes.push(makeTaskNode(ownerTasks[j], taskX, taskY, allTaskSummary));
    }
  }

  // Unowned tasks in a pool column
  if (unowned.length > 0) {
    const poolX = members.length * (LANE_WIDTH + LANE_GAP);
    const sorted = sortTasks(unowned, allTaskSummary);
    for (let j = 0; j < sorted.length; j++) {
      const taskX = poolX + (LANE_WIDTH - TASK_CARD_WIDTH) / 2;
      const taskY = TASK_START_Y + j * TASK_Y_GAP;
      nodes.push(makeTaskNode(sorted[j], taskX, taskY, allTaskSummary));
    }
  }

  return { nodes, edges: buildEdges(tasks, members, 'smoothstep') };
}

// ─── Force → Cluster Layout ─────────────────────────────────────────────────
// Agents spaced in a row. Tasks in a tight 2-column grid below each agent.
// Better spatial grouping than the old force layout.
function buildForceLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const leadName = team.config?.leadAgentId?.split('@')[0] ?? null;
  const stats = buildAgentStats(tasks);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  const memberNames = new Set(members.map(m => m.name));
  const tasksByOwner = new Map<string, Task[]>();
  const unowned: Task[] = [];
  for (const task of tasks) {
    if (task.owner && memberNames.has(task.owner)) {
      if (!tasksByOwner.has(task.owner)) tasksByOwner.set(task.owner, []);
      tasksByOwner.get(task.owner)!.push(task);
    } else {
      unowned.push(task);
    }
  }

  // Calculate lane widths based on task count (2-col grid per agent)
  const COL_WIDTH = 200;
  const COL_GAP = 16;
  const CLUSTER_GAP = 70;
  const CLUSTER_PAD = 10;
  const AGENT_Y = 40;
  const TASK_START_Y = 160;
  const ROW_GAP = 140;

  let cursorX = 0;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const ownerTasks = sortTasks(tasksByOwner.get(m.name) ?? [], allTaskSummary);
    const cols = ownerTasks.length > 2 ? 2 : 1;
    const clusterWidth = cols * COL_WIDTH + (cols - 1) * COL_GAP + CLUSTER_PAD * 2;

    // Agent centered above cluster
    const agentX = cursorX + (clusterWidth - 160) / 2;
    nodes.push(makeAgentNode(m, agentX, AGENT_Y, leadName, stats));

    // Tasks in 2-col grid
    for (let j = 0; j < ownerTasks.length; j++) {
      const col = j % cols;
      const row = Math.floor(j / cols);
      const taskX = cursorX + CLUSTER_PAD + col * (COL_WIDTH + COL_GAP);
      const taskY = TASK_START_Y + row * ROW_GAP;
      nodes.push(makeTaskNode(ownerTasks[j], taskX, taskY, allTaskSummary));
    }

    cursorX += clusterWidth + CLUSTER_GAP;
  }

  // Unowned tasks pushed further below with clear separation
  if (unowned.length > 0) {
    const sorted = sortTasks(unowned, allTaskSummary);
    const totalWidth = cursorX - CLUSTER_GAP;
    const poolCols = Math.min(sorted.length, 3);
    const poolWidth = poolCols * (COL_WIDTH + COL_GAP) - COL_GAP;
    const poolStartX = Math.max(0, (totalWidth - poolWidth) / 2);

    // Find max Y used so far — push unowned well below
    const maxY = nodes.reduce((max, n) => Math.max(max, n.position.y), 0);
    const poolStartY = maxY + 220;

    for (let j = 0; j < sorted.length; j++) {
      const col = j % poolCols;
      const row = Math.floor(j / poolCols);
      const taskX = poolStartX + col * (COL_WIDTH + COL_GAP);
      const taskY = poolStartY + row * ROW_GAP;
      nodes.push(makeTaskNode(sorted[j], taskX, taskY, allTaskSummary));
    }
  }

  return { nodes, edges: buildEdges(tasks, members, 'smoothstep') };
}

// ─── Circular → Radial Layout ───────────────────────────────────────────────
// Agents in a tighter inner ring. Each agent's tasks fan outward in clean arcs.
// Unowned tasks placed in a compact grid below the ring (not center).
function buildCircularLayout(team: TeamDetail): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const members = team.config?.members ?? [];
  const tasks = team.tasks;
  const leadName = team.config?.leadAgentId?.split('@')[0] ?? null;
  const stats = buildAgentStats(tasks);
  const allTaskSummary = tasks.map(t => ({ id: t.id, status: t.status }));

  const memberNames = new Set(members.map(m => m.name));
  const tasksByOwner = new Map<string, Task[]>();
  const unowned: Task[] = [];
  for (const task of tasks) {
    if (task.owner && memberNames.has(task.owner)) {
      if (!tasksByOwner.has(task.owner)) tasksByOwner.set(task.owner, []);
      tasksByOwner.get(task.owner)!.push(task);
    } else {
      unowned.push(task);
    }
  }

  // Tighter agent ring
  const agentCount = members.length;
  const agentRadius = Math.max(250, agentCount * 80);
  const cx = agentRadius + 300;
  const cy = agentRadius + 300;

  // Task orbit distance from their agent
  const ORBIT_RADIUS = 160;

  // Max arc per agent sector — limit to prevent overlap with neighbors
  const maxSectorArc = agentCount > 1 ? (2 * Math.PI / agentCount) * 0.75 : Math.PI;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const agentAngle = (2 * Math.PI * i) / agentCount - Math.PI / 2;
    const ax = cx + agentRadius * Math.cos(agentAngle) - 80;
    const ay = cy + agentRadius * Math.sin(agentAngle) - 50;
    nodes.push(makeAgentNode(m, ax, ay, leadName, stats));

    // Tasks fan outward from this agent — active tasks closest
    const ownerTasks = sortTasks(tasksByOwner.get(m.name) ?? [], allTaskSummary);
    const taskCount = ownerTasks.length;
    if (taskCount === 0) continue;

    const TASK_ARC_SPREAD = 0.3; // radians per task
    const totalArc = Math.min(taskCount * TASK_ARC_SPREAD, maxSectorArc);
    const startAngle = agentAngle - totalArc / 2;

    for (let j = 0; j < taskCount; j++) {
      const taskAngle = taskCount === 1
        ? agentAngle
        : startAngle + (j / (taskCount - 1)) * totalArc;

      // Stagger radius slightly — active tasks closer, completed further
      const derivedStatus = getTaskStatus(ownerTasks[j], allTaskSummary);
      const radiusOffset = derivedStatus === 'completed' ? 30 : 0;

      const tx = cx + (agentRadius + ORBIT_RADIUS + radiusOffset) * Math.cos(taskAngle) - 95;
      const ty = cy + (agentRadius + ORBIT_RADIUS + radiusOffset) * Math.sin(taskAngle) - 50;
      nodes.push(makeTaskNode(ownerTasks[j], tx, ty, allTaskSummary));
    }
  }

  // Unowned tasks in a compact grid below the ring (not in center)
  if (unowned.length > 0) {
    const sorted = sortTasks(unowned, allTaskSummary);
    const gridCols = Math.min(sorted.length, 3);
    const gridColWidth = 210;
    const gridRowGap = 130;
    const gridWidth = gridCols * gridColWidth;
    const gridStartX = cx - gridWidth / 2;
    const gridStartY = cy + agentRadius + ORBIT_RADIUS + 120;

    for (let j = 0; j < sorted.length; j++) {
      const col = j % gridCols;
      const row = Math.floor(j / gridCols);
      const tx = gridStartX + col * gridColWidth;
      const ty = gridStartY + row * gridRowGap;
      nodes.push(makeTaskNode(sorted[j], tx, ty, allTaskSummary));
    }
  }

  // Use bezier (default) edges for radial layout — follows curves better
  return { nodes, edges: buildEdges(tasks, members, 'default') };
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function buildGraphElements(
  team: TeamDetail,
  layout: LayoutMode = 'hierarchical',
  _selectedAgentId?: string,
  statusFilter: StatusFilter = 'all',
): { nodes: Node[]; edges: Edge[] } {
  // Pre-filter tasks based on status filter
  const filteredTeam = statusFilter === 'all' ? team : {
    ...team,
    tasks: team.tasks.filter(t => {
      const s = getTaskStatus(t, team.tasks.map(tt => ({ id: tt.id, status: tt.status })));
      if (statusFilter === 'active') return s !== 'completed';
      if (statusFilter === 'blocked') return s === 'blocked';
      return true;
    }),
  };

  if (layout === 'circular') return buildCircularLayout(filteredTeam);
  if (layout === 'force') return buildForceLayout(filteredTeam);
  return buildHierarchicalLayout(filteredTeam);
}
