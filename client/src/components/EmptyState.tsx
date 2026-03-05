import { useEffect, useState } from 'react';

interface EmptyStateProps {
  onEnableDemo: () => void;
}

const BOOT_LINES = [
  'AGENT//CTRL v2.0.0',
  'Initializing subsystems...',
  'Scanning team directories...',
  '~/.claude/teams/  ............. [EMPTY]',
  '~/.claude/tasks/  ............. [EMPTY]',
  'No active agent teams detected.',
];

const STEPS = [
  {
    number: '01',
    title: 'Start a Claude Code Session',
    description: 'Open your project in Claude Code and begin a conversation.',
    code: 'claude',
    color: 'var(--ice)',
  },
  {
    number: '02',
    title: 'Create a Team',
    description: 'Use TeamCreate to spawn a coordinated group of agents.',
    code: 'TeamCreate({ team_name: "my-team" })',
    color: 'var(--amber)',
  },
  {
    number: '03',
    title: 'Spawn Teammates',
    description: 'Launch agents with the Agent tool — they appear here live.',
    code: 'Agent({ subagent_type: "general-purpose" })',
    color: 'var(--phosphor)',
  },
];

export default function EmptyState({ onEnableDemo }: EmptyStateProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Typewriter boot sequence
  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length) {
      setTimeout(() => setShowActions(true), 300);
      return;
    }
    const delay = visibleLines === 0 ? 200 : 100;
    const timer = setTimeout(() => setVisibleLines(v => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  function handleCopy(code: string, idx: number) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--void)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>

        {/* Terminal window */}
        <div style={{
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: showActions ? '24px' : '0',
          transition: 'margin 0.3s',
        }}>
          {/* Terminal titlebar */}
          <div style={{
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--crimson)', opacity: 0.7 }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--amber)', opacity: 0.7 }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--phosphor)', opacity: 0.7 }} />
            <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              agent-ctrl — system scan
            </span>
          </div>

          {/* Terminal body */}
          <div style={{ padding: '20px', minHeight: '160px' }}>
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} style={{
                fontSize: '12px', lineHeight: 1.7, letterSpacing: '0.02em',
                color: line.includes('[EMPTY]') ? 'var(--amber)'
                  : line.startsWith('AGENT//') ? 'var(--phosphor)'
                  : line.startsWith('~') ? 'var(--ice)'
                  : 'var(--text-secondary)',
                textShadow: line.startsWith('AGENT//') ? '0 0 10px var(--phosphor-glow-strong)' : 'none',
              }}>
                {line}
              </div>
            ))}
            {/* Blinking cursor while typing */}
            {visibleLines < BOOT_LINES.length && (
              <span style={{
                display: 'inline-block', width: '8px', height: '14px',
                background: 'var(--phosphor)',
                animation: 'status-pulse 1s ease-in-out infinite',
                verticalAlign: 'middle',
                marginTop: '2px',
              }} />
            )}
          </div>
        </div>

        {/* Action section — fades in after boot */}
        {showActions && (
          <div style={{ animation: 'fade-up 0.4s ease-out' }}>

            {/* Getting started steps */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.2em',
                marginBottom: '12px', textAlign: 'center',
              }}>
                — GET STARTED IN 3 STEPS —
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--surface-0)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${step.color}`,
                      borderRadius: '4px',
                      padding: '12px 14px',
                      display: 'flex', gap: '14px', alignItems: 'flex-start',
                      animation: `fade-up 0.35s ease-out ${idx * 0.1}s both`,
                    }}
                  >
                    {/* Step number */}
                    <div style={{
                      flexShrink: 0,
                      fontSize: '11px', fontWeight: 700,
                      color: step.color,
                      opacity: 0.7,
                      letterSpacing: '0.04em',
                      minWidth: '24px',
                      paddingTop: '1px',
                    }}>
                      {step.number}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '11px', fontWeight: 600,
                        color: 'var(--text-primary)', letterSpacing: '0.04em',
                        marginBottom: '3px',
                      }}>
                        {step.title}
                      </div>
                      <div style={{
                        fontSize: '10px', color: 'var(--text-muted)',
                        letterSpacing: '0.02em', marginBottom: '8px', lineHeight: 1.5,
                      }}>
                        {step.description}
                      </div>
                      {/* Code snippet */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        padding: '5px 10px',
                      }}>
                        <span style={{
                          flex: 1,
                          fontSize: '10px', color: step.color,
                          letterSpacing: '0.04em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {step.code}
                        </span>
                        <button
                          onClick={() => handleCopy(step.code, idx)}
                          title="Copy to clipboard"
                          style={{
                            flexShrink: 0,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: '9px', letterSpacing: '0.08em',
                            color: copiedIdx === idx ? 'var(--phosphor)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => { if (copiedIdx !== idx) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          onMouseLeave={e => { if (copiedIdx !== idx) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          {copiedIdx === idx ? '✓ COPIED' : 'COPY'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Demo CTA */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '12px' }}>
                EXPLORE WITH SIMULATED TEAM DATA
              </p>
              <button
                onClick={onEnableDemo}
                style={{
                  padding: '10px 28px',
                  fontSize: '11px', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.14em',
                  background: 'transparent',
                  color: 'var(--phosphor)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--phosphor-glow)';
                  e.currentTarget.style.boxShadow = '0 0 20px var(--phosphor-glow-strong)';
                  e.currentTarget.style.borderColor = 'var(--phosphor)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-bright)';
                }}
              >
                ▶ LAUNCH DEMO
              </button>
              <p style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '8px', opacity: 0.6 }}>
                No setup required — see a live team simulation
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
