import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, Star, MessageSquare, Bookmark, Clock, FileText, Activity } from 'lucide-react';
import type { FeedbackEntry } from './review/ReviewView';

interface ExpertProfilePanelProps {
  teamId: string;
  teamName?: string;
  onClose: () => void;
}

interface GuideData {
  content: string | null;
  filename: string;
}

interface HumanInputStatus {
  waitingAgents: string[];
  details: { agentName: string; waitingSince: string; context: string }[];
}

export default function ExpertProfilePanel({ teamId, teamName, onClose }: ExpertProfilePanelProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [preferences, setPreferences] = useState<Record<string, string[]>>({});
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [humanInput, setHumanInput] = useState<HumanInputStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fbRes, prefRes, guideRes, hiRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/feedback`),
        fetch(`/api/teams/${teamId}/preferences`),
        fetch(`/api/teams/${teamId}/guide`).catch(() => null),
        fetch(`/api/teams/${teamId}/human-input-status`).catch(() => null),
      ]);
      const fbJson = await fbRes.json();
      const prefJson = await prefRes.json();
      setEntries(fbJson.entries ?? []);
      setPreferences(prefJson.preferences ?? {});
      if (guideRes?.ok) {
        const gj = await guideRes.json();
        setGuide({ content: gj.content ?? null, filename: gj.filename ?? 'TEAM_GUIDE.md' });
      }
      if (hiRes?.ok) {
        const hj = await hiRes.json();
        setHumanInput({ waitingAgents: hj.waitingAgents ?? [], details: hj.details ?? [] });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const praiseCount = entries.filter(e => e.type === 'praise').length;
  const correctionCount = entries.filter(e => e.type === 'correction').length;
  const bookmarkCount = entries.filter(e => e.type === 'bookmark').length;
  const totalFeedback = entries.length;
  const processedCount = entries.filter(e => e.processedAt).length;
  const totalPrefRules = Object.values(preferences).reduce((sum, rules) => sum + rules.length, 0);
  const agentsCovered = Object.keys(preferences).length;
  const lastActivity = entries.length > 0
    ? entries.reduce((latest, e) => e.createdAt > latest ? e.createdAt : latest, entries[0].createdAt)
    : null;

  // Agent breakdown
  const agentNames = [...new Set(entries.map(e => e.agentName))].sort();

  // Recent entries (last 5)
  const recentEntries = useMemo(() =>
    [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [entries]
  );

  // Heatmap data: 7 days × 4 time slots
  const heatmapData = useMemo(() => buildHeatmap(entries), [entries]);

  // Human input stats
  const pendingCount = humanInput?.waitingAgents.length ?? 0;
  const totalResponded = entries.filter(e => e.type === 'correction' || e.type === 'praise').length;

  // Guide rules (parse bullet points from guide content)
  const guideRules = useMemo(() => {
    if (!guide?.content) return [];
    return guide.content
      .split('\n')
      .filter(line => /^\s*[-*]\s+/.test(line))
      .map(line => line.replace(/^\s*[-*]\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [guide]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,8,0.5)', zIndex: 300 }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '400px', maxWidth: '90vw',
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '0 0 40px rgba(0,0,0,0.6)',
        zIndex: 301,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
        animation: 'fade-up 0.2s ease-out',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--phosphor-glow)',
              border: '1.5px solid var(--phosphor)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={15} style={{ color: 'var(--phosphor)' }} />
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                {t('expert.title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--phosphor)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {teamName?.toUpperCase() ?? teamId.toUpperCase()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '24px 0', textAlign: 'center' }}>
              {t('common.loading')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Feedback Stats */}
              <SectionBlock label={t('expert.feedback_stats')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <StatCard icon={<MessageSquare size={12} />} label={t('expert.total_feedback')} value={totalFeedback} color="var(--text-secondary)" />
                  <StatCard icon={<Star size={12} />} label={t('expert.praise')} value={praiseCount} color="var(--phosphor)" />
                  <StatCard label={t('expert.corrections')} value={correctionCount} color="var(--amber)" />
                  <StatCard icon={<Bookmark size={12} />} label={t('expert.bookmarks')} value={bookmarkCount} color="var(--ice)" />
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <MiniStat label={t('expert.processed')} value={`${processedCount}/${totalFeedback}`} />
                  <MiniStat label={t('expert.last_activity')} value={lastActivity ? fmtRelative(lastActivity) : '—'} />
                </div>
              </SectionBlock>

              {/* Response Stats */}
              <SectionBlock label={t('expert.response_stats')} icon={<Clock size={10} />}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <MiniCard label={t('expert.pending_requests')} value={String(pendingCount)} color={pendingCount > 0 ? 'var(--amber)' : 'var(--phosphor)'} />
                  <MiniCard label={t('expert.total_responses')} value={String(totalResponded)} color="var(--text-secondary)" />
                </div>
                {humanInput && humanInput.details.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {humanInput.details.map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 8px',
                        background: 'var(--surface-1)',
                        borderRadius: '3px',
                        border: '1px solid var(--amber)',
                        borderLeftWidth: '2px',
                      }}>
                        <span style={{ fontSize: '9px', color: 'var(--amber)', fontWeight: 600, flex: 1, letterSpacing: '0.04em' }}>
                          {d.agentName}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                          {fmtRelative(d.waitingSince)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionBlock>

              {/* Activity Heatmap */}
              {entries.length > 0 && (
                <SectionBlock label={t('expert.activity_heatmap')} icon={<Activity size={10} />}>
                  <HeatmapGrid data={heatmapData} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                      {t('expert.heatmap_less')}
                    </span>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      {[0, 1, 2, 3, 4].map(level => (
                        <div key={level} style={{
                          width: '10px', height: '10px', borderRadius: '2px',
                          background: level === 0 ? 'var(--surface-1)' : `var(--phosphor)`,
                          opacity: level === 0 ? 1 : 0.2 + level * 0.2,
                          border: '1px solid var(--border)',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                      {t('expert.heatmap_more')}
                    </span>
                  </div>
                </SectionBlock>
              )}

              {/* Per-Agent Breakdown */}
              {agentNames.length > 0 && (
                <SectionBlock label={t('expert.by_agent')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {agentNames.map(name => {
                      const ag = entries.filter(e => e.agentName === name);
                      const p = ag.filter(e => e.type === 'praise').length;
                      const c = ag.filter(e => e.type === 'correction').length;
                      const b = ag.filter(e => e.type === 'bookmark').length;
                      return (
                        <div key={name} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 10px',
                          background: 'var(--surface-1)',
                          borderRadius: '3px',
                          border: '1px solid var(--border)',
                        }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-primary)', letterSpacing: '0.04em', flex: 1 }}>{name}</span>
                          <span style={{ fontSize: '9px', color: 'var(--phosphor)' }}>👍{p}</span>
                          <span style={{ fontSize: '9px', color: 'var(--amber)' }}>👎{c}</span>
                          <span style={{ fontSize: '9px', color: 'var(--ice)' }}>📌{b}</span>
                        </div>
                      );
                    })}
                  </div>
                </SectionBlock>
              )}

              {/* Recent Feedback */}
              {recentEntries.length > 0 && (
                <SectionBlock label={t('expert.recent_feedback')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recentEntries.map(entry => (
                      <div key={entry.id} style={{
                        padding: '8px 10px',
                        background: 'var(--surface-1)',
                        borderRadius: '3px',
                        border: '1px solid var(--border)',
                        borderLeftWidth: '2px',
                        borderLeftColor: entry.type === 'praise' ? 'var(--phosphor)'
                          : entry.type === 'correction' ? 'var(--amber)' : 'var(--ice)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em',
                            color: entry.type === 'praise' ? 'var(--phosphor)'
                              : entry.type === 'correction' ? 'var(--amber)' : 'var(--ice)',
                          }}>
                            {entry.type === 'praise' ? '👍' : entry.type === 'correction' ? '👎' : '📌'}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', flex: 1 }}>
                            {entry.agentName}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                            {fmtRelative(entry.createdAt)}
                          </span>
                        </div>
                        {entry.content && (
                          <div style={{
                            fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {entry.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionBlock>
              )}

              {/* Preferences Summary */}
              <SectionBlock label={t('expert.preferences_summary')}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: totalPrefRules > 0 ? '12px' : '0' }}>
                  <MiniStat label={t('expert.total_rules')} value={String(totalPrefRules)} />
                  <MiniStat label={t('expert.agents_covered')} value={String(agentsCovered)} />
                </div>

                {totalPrefRules > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(preferences).map(([agentName, rules]) => (
                      <div key={agentName}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '4px', textTransform: 'uppercase' }}>
                          {agentName}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
                          {rules.slice(0, 3).map((rule, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <span style={{ color: 'var(--ice)', fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>▸</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{rule}</span>
                            </div>
                          ))}
                          {rules.length > 3 && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '14px', letterSpacing: '0.06em' }}>
                              +{rules.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center', letterSpacing: '0.06em' }}>
                    {t('expert.no_preferences')}
                  </div>
                )}
              </SectionBlock>

              {/* Team Guide Rules */}
              {guide?.content && guideRules.length > 0 && (
                <SectionBlock label={t('expert.team_guide')} icon={<FileText size={10} />}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                      {guide.filename}
                    </span>
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '2px',
                      background: 'var(--surface-1)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', letterSpacing: '0.1em',
                    }}>
                      {t('expert.guide_readonly')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--phosphor)', borderLeftStyle: 'dashed' }}>
                    {guideRules.map((rule, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ color: 'var(--phosphor)', fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>▹</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{rule}</span>
                      </div>
                    ))}
                    {guide.content.split('\n').filter(l => /^\s*[-*]\s+/.test(l)).length > 10 && (
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '14px', letterSpacing: '0.06em' }}>
                        +{guide.content.split('\n').filter(l => /^\s*[-*]\s+/.test(l)).length - 10} more
                      </span>
                    )}
                  </div>
                </SectionBlock>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBlock({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '14px 16px',
    }}>
      <div style={{
        fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.18em',
        textTransform: 'uppercase', marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {icon && <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{icon}</span>}
        {label}
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon?: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {icon && <span style={{ color, opacity: 0.7 }}>{icon}</span>}
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span style={{ fontSize: '18px', fontWeight: 700, color, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      display: 'flex', flexDirection: 'column', gap: '3px',
    }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 700, color, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABELS = ['00-06', '06-12', '12-18', '18-24'];

interface HeatmapCell { day: number; slot: number; count: number; }

function buildHeatmap(entries: FeedbackEntry[]): HeatmapCell[] {
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const day = (d.getDay() + 6) % 7; // Mon=0
    const hour = d.getHours();
    const slot = Math.floor(hour / 6);
    grid[day][slot]++;
  }
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < 4; s++) {
      cells.push({ day: d, slot: s, count: grid[d][s] });
    }
  }
  return cells;
}

function HeatmapGrid({ data }: { data: HeatmapCell[] }) {
  const maxCount = Math.max(1, ...data.map(c => c.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: '2px', marginLeft: '32px' }}>
        {SLOT_LABELS.map(sl => (
          <div key={sl} style={{
            flex: 1, textAlign: 'center',
            fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em',
          }}>
            {sl}
          </div>
        ))}
      </div>
      {/* Day rows */}
      {DAY_LABELS.map((dayLabel, dayIdx) => (
        <div key={dayLabel} style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <span style={{ width: '28px', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: 'right', marginRight: '2px' }}>
            {dayLabel}
          </span>
          {[0, 1, 2, 3].map(slot => {
            const cell = data.find(c => c.day === dayIdx && c.slot === slot);
            const count = cell?.count ?? 0;
            const intensity = count / maxCount;
            return (
              <div
                key={slot}
                title={`${dayLabel} ${SLOT_LABELS[slot]}: ${count}`}
                style={{
                  flex: 1, height: '18px',
                  borderRadius: '2px',
                  border: '1px solid var(--border)',
                  background: count === 0
                    ? 'var(--surface-1)'
                    : `var(--phosphor)`,
                  opacity: count === 0 ? 1 : 0.2 + intensity * 0.8,
                  cursor: 'default',
                  transition: 'opacity 0.15s ease',
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m ago';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
