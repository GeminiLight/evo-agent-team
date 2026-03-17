import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentMessage } from '../../types';
import { agentColor, agentInitials, agentAvatarStyle } from '../../utils/agentColors';
import { useAgentRespond } from '../../hooks/useAgentRespond';

// ─── sessionStorage helpers for dismissed human-input inline replies ──────────
const DISMISS_KEY = 'dismissed-human-requests';
function isDismissed(id: string): boolean {
  try { return (JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]') as string[]).includes(id); }
  catch { return false; }
}
function setDismissed(id: string) {
  try {
    const arr: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]');
    if (!arr.includes(id)) sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...arr, id]));
  } catch { /* ignore */ }
}

// ─── HumanResponseInline ──────────────────────────────────────────────────────
interface HumanResponseInlineProps {
  agentName: string;
  messageId: string;
  teamId: string;
  pendingAgentNames: string[];
}

function HumanResponseInline({ agentName, messageId, teamId, pendingAgentNames }: HumanResponseInlineProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissedLocal] = useState(() => isDismissed(messageId));
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const { respond, sending, error, clearError } = useAgentRespond(teamId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDemo = teamId === 'demo-team';

  // Reset sent→idle when agent unblocks (no longer in pending list)
  useEffect(() => {
    if (sent && !pendingAgentNames.includes(agentName)) {
      setSent(false);
      setText('');
    }
  }, [pendingAgentNames, agentName, sent]);

  if (dismissed) return null;

  const handleSend = async () => {
    if (!text.trim() || sending || sent) return;
    const ok = await respond(agentName, text);
    if (ok) setSent(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: '8px',
        padding: '10px 12px',
        background: 'var(--amber-bg-subtle)',
        border: '1px solid var(--amber-border-subtle)',
        borderRadius: '3px',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase' }}>
          {t('message.human_input')}
        </span>
        <button
          onClick={() => { setDismissed(messageId); setDismissedLocal(true); }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1, padding: '0 2px' }}
          title="Dismiss"
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >×</button>
      </div>

      {/* Demo warning */}
      {isDemo && (
        <div style={{ marginBottom: '8px', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.06em', opacity: 0.8 }}>
          {t('agent_card.demo_unavailable')}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => { setText(e.target.value); clearError(); }}
        onKeyDown={handleKeyDown}
        disabled={sending || sent || isDemo}
        placeholder={sent ? '✓ Response queued' : 'Type your response...  (Ctrl+Enter to send)'}
        rows={3}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: `1px solid ${error ? 'var(--crimson)' : 'var(--border)'}`,
          borderRadius: '3px',
          color: sent ? 'var(--phosphor)' : 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          padding: '6px 8px',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: (sending || isDemo) ? 0.6 : 1,
          transition: 'border-color 0.15s',
          minHeight: '56px',
        }}
        onFocus={e => { if (!error) e.target.style.borderColor = 'var(--phosphor)'; }}
        onBlur={e => { if (!error) e.target.style.borderColor = error ? 'var(--crimson)' : 'var(--border)'; }}
      />

      {/* Error */}
      {error && (
        <div style={{ marginTop: '4px', fontSize: '9px', color: 'var(--crimson)', letterSpacing: '0.06em' }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.08em', color: sent ? 'var(--phosphor)' : 'var(--text-muted)' }}>
          {sent ? t('message.sent_status') : t('message.awaiting_status', { name: agentName })}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {error && (
            <button
              onClick={() => { clearError(); handleSend(); }}
              style={{
                padding: '3px 10px', fontSize: '9px', letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)',
                background: 'var(--crimson-bg-subtle)', color: 'var(--crimson)',
                border: '1px solid var(--crimson-border-subtle)', borderRadius: '2px', cursor: 'pointer',
              }}
            >
              <span style={{ textTransform: 'uppercase' }}>{t('message.retry')}</span>
            </button>
          )}
          {!sent && (
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending || isDemo}
              style={{
                padding: '3px 12px', fontSize: '9px', letterSpacing: '0.12em', fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: 'var(--phosphor-bg-subtle)', color: 'var(--phosphor)',
                border: '1px solid var(--phosphor)', borderRadius: '2px',
                cursor: (!text.trim() || sending || isDemo) ? 'default' : 'pointer',
                opacity: (!text.trim() || sending || isDemo) ? 0.4 : 1,
              }}
            >
              <span style={{ textTransform: 'uppercase' }}>{sending ? '...' : t('message.send')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTypeBadge(t: (key: string) => string): Record<string, { color: string; label: string; glow?: boolean }> {
  return {
    idle_notification:        { color: 'var(--text-muted)',    label: t('message.type_idle')           },
    shutdown_request:         { color: 'var(--crimson)',       label: t('message.type_shutdown')       },
    shutdown_response:        { color: 'var(--crimson)',       label: t('message.type_shutdown')       },
    plan_approval_request:    { color: 'var(--amber)',         label: t('message.type_plan_approval')  },
    plan_approval_response:   { color: 'var(--amber)',         label: t('message.type_plan_approval')  },
    task_assignment:          { color: 'var(--ice)',           label: t('message.type_task_update')    },
    broadcast:                { color: 'var(--phosphor)',      label: t('message.type_broadcast')      },
    human_input_request:      { color: 'var(--amber)',         label: t('message.type_needs_input'),   glow: true },
  };
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

interface MessageBubbleProps {
  message: AgentMessage;
  /** When true, omit the sender avatar (used for grouped follow-up messages) */
  compact?: boolean;
  teamId?: string;
  pendingAgentNames?: string[];
}

export default function MessageBubble({ message, compact = false, teamId, pendingAgentNames = [] }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const TYPE_BADGE = buildTypeBadge(t);
  const badge = message.parsedType ? TYPE_BADGE[message.parsedType] : undefined;
  const isHumanRequest = message.parsedType === 'human_input_request';
  const isLong = message.text.length > 120;
  const preview = isLong ? message.text.slice(0, 120) + '…' : message.text;
  const senderColor = agentColor(message.sender);
  const recipientColor = agentColor(message.recipient);
  const avatarStyle = agentAvatarStyle(message.sender);

  return (
    <div
      onClick={() => isLong && setExpanded(e => !e)}
      style={{
        display: 'flex',
        gap: '8px',
        padding: compact ? '3px 10px 3px 10px' : '7px 10px',
        borderRadius: '3px',
        cursor: isLong ? 'pointer' : 'default',
        transition: 'background 0.1s',
        alignItems: 'flex-start',
        borderLeft: isHumanRequest ? '2px solid var(--amber)' : `2px solid ${senderColor}55`,
        background: isHumanRequest ? 'var(--amber-glow)' : 'var(--surface-1)',
        marginBottom: '1px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isHumanRequest ? 'var(--amber-bg-subtle)' : 'var(--surface-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = isHumanRequest ? 'var(--amber-glow)' : 'var(--surface-1)'; }}
    >
      {/* Avatar column */}
      <div style={{ flexShrink: 0, width: '22px', paddingTop: '1px' }}>
        {!compact ? (
          <div style={{
            width: '22px', height: '22px',
            borderRadius: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)',
            ...avatarStyle,
          }}>
            {agentInitials(message.sender)}
          </div>
        ) : (
          /* Continuation line */
          <div style={{ width: '1px', height: '100%', background: senderColor + '22', margin: '0 auto' }} />
        )}
      </div>

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: only for non-compact */}
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
            {/* Sender */}
            <span style={{ fontSize: '10px', fontWeight: 600, color: senderColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              {message.sender}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>→</span>
            {/* Recipient */}
            <span style={{ fontSize: '10px', color: recipientColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              {message.recipient}
            </span>
            {/* Timestamp */}
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginLeft: '2px' }}>
              {formatTs(message.timestamp)}
            </span>
            {/* Type badge */}
            {badge && (
              <span style={{
                fontSize: '9px',
                letterSpacing: '0.12em',
                color: badge.color,
                border: `1px solid ${badge.color}`,
                padding: '1px 5px',
                borderRadius: '2px',
                opacity: 0.85,
                boxShadow: badge.glow ? `0 0 6px ${badge.color}88` : 'none',
                animation: badge.glow ? 'status-pulse 2s ease-in-out infinite' : 'none',
                textTransform: 'uppercase',
              }}>
                {badge.label}
              </span>
            )}
            {/* Unread dot */}
            {!message.read && (
              <span style={{
                width: '5px', height: '5px',
                borderRadius: '50%',
                background: 'var(--unread-dot)',
                boxShadow: '0 0 4px var(--unread-dot)',
                display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
          </div>
        )}

        {/* Compact: just timestamp + badge inline */}
        {compact && (badge || !message.read) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {formatTs(message.timestamp)}
            </span>
            {badge && (
              <span style={{
                fontSize: '9px', letterSpacing: '0.12em',
                color: badge.color, border: `1px solid ${badge.color}`,
                padding: '1px 5px', borderRadius: '2px', opacity: 0.85,
                textTransform: 'uppercase',
              }}>
                {badge.label}
              </span>
            )}
            {!message.read && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--unread-dot)', boxShadow: '0 0 4px var(--unread-dot)', display: 'inline-block' }} />
            )}
          </div>
        )}

        {/* Message body */}
        <div style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          letterSpacing: '0.02em',
          lineHeight: 1.5,
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
        }}>
          {expanded ? message.text : preview}
        </div>

        {isLong && (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {expanded ? t('commlog.collapse') : t('commlog.expand')}
          </div>
        )}

        {/* Inline reply for human_input_request messages */}
        {isHumanRequest && !compact && teamId && (
          <HumanResponseInline
            agentName={message.sender}
            messageId={message.id}
            teamId={teamId}
            pendingAgentNames={pendingAgentNames}
          />
        )}
      </div>
    </div>
  );
}
