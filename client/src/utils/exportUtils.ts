import { toPng } from 'html-to-image';
import type { TeamDetail, AgentMessage, TaskChangeEvent } from '../types';

export async function exportGraphAsPng(containerEl: HTMLDivElement): Promise<void> {
  const dataUrl = await toPng(containerEl, {
    backgroundColor: '#040608',
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      return !node.classList.contains('react-flow__minimap') &&
             !node.classList.contains('react-flow__controls');
    },
  });
  const link = document.createElement('a');
  link.download = `agent-team-graph-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

export function exportTeamAsJson(team: TeamDetail): void {
  const blob = new Blob([JSON.stringify(team, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${team.id}-export-${Date.now()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTasksCsv(team: TeamDetail): void {
  const header = ['id', 'subject', 'status', 'owner', 'blockedBy', 'blocks', 'activeForm'];
  const rows = [header, ...team.tasks.map(t => [
    t.id,
    t.subject,
    t.status,
    t.owner ?? '',
    t.blockedBy.join(';'),
    t.blocks.join(';'),
    t.activeForm ?? '',
  ])];
  downloadCsv(`${team.id}-tasks-${Date.now()}.csv`, rows);
}

export function exportCommLogCsv(teamId: string, messages: AgentMessage[]): void {
  const header = ['timestamp', 'sender', 'recipient', 'type', 'text'];
  const rows = [header, ...messages.map(m => [
    m.timestamp,
    m.sender,
    m.recipient,
    m.parsedType ?? 'message',
    m.text,
  ])];
  downloadCsv(`${teamId}-comms-${Date.now()}.csv`, rows);
}

export function exportTimelineCsv(teamId: string, events: TaskChangeEvent[]): void {
  const header = ['timestamp', 'taskId', 'taskSubject', 'oldStatus', 'newStatus', 'owner'];
  const rows = [header, ...events.map(e => [
    e.timestamp,
    e.taskId,
    e.taskSubject,
    e.oldStatus ?? '',
    e.newStatus,
    e.owner ?? '',
  ])];
  downloadCsv(`${teamId}-timeline-${Date.now()}.csv`, rows);
}
