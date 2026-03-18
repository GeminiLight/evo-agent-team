/**
 * Shared date/time formatting utilities.
 *
 * Extracted from MemoryView, ContextSummaryView, ReviewView, TaskDetailPanel,
 * TaskList, MiniFeedBar, SessionHistoryView to eliminate 5× fmtDate + 3× timeAgo duplication.
 */

/**
 * Locale-aware date+time: "Mar 18, 2026 14:30"
 * @param lang - i18n language code ('zh' → 'zh-CN', else 'en-US')
 */
export function fmtDate(iso: string, lang = 'en'): string {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Date only: "Mar 18" — for SessionHistoryView date headers.
 */
export function fmtDateOnly(ts: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ts.slice(0, 10); }
}

/**
 * Time only: "14:30:05" — for SessionHistoryView message timestamps.
 */
export function fmtTime(ts: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts.slice(11, 19); }
}

/**
 * Relative time from ISO string: "5m ago", "2h ago", "3d ago".
 * Returns null if input is falsy.
 * Used by TaskDetailPanel, TaskList.
 */
export function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m ago';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Compact relative time (no "ago" suffix): "<1m", "5m", "2h", "3d".
 * Returns '?' if input is falsy.
 * Used by TaskList compact rows.
 */
export function timeAgoShort(iso?: string): string {
  if (!iso) return '?';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Relative time from numeric timestamp (ms): "5s", "3m", "2h", "1d".
 * Used by MiniFeedBar.
 */
export function timeAgoFromTs(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/**
 * Locale-aware date+time for detail panels: "Mar 18, 14:30"
 * Returns null if input is falsy.
 */
export function fmtDatetime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
