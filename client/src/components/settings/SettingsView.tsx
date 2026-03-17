import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES, useTheme, type ThemeId } from '../../context/ThemeContext';

interface SettingsViewProps {
  teamId: string | null;
  wsConnected: boolean;
}

interface ServerConfig {
  teamsDir: string;
  tasksDir: string;
  port: number;
  pollIntervalMs: number;
  demoMode: string;
}

type SaveState = 'idle' | 'saving' | 'saved';

const POLL_PRESETS = [1000, 2000, 5000, 10000];

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '12px', marginTop: '28px',
    }}>
      <span style={{
        fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', flexShrink: 0, textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      marginBottom: '14px',
    }}>
      <span style={{
        width: '110px', flexShrink: 0, textAlign: 'right',
        fontSize: '9px', letterSpacing: '0.06em',
        color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export default function SettingsView({ teamId, wsConnected }: SettingsViewProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [form, setForm] = useState({ teamsDir: '', tasksDir: '', pollIntervalMs: 2000, demoMode: 'auto' });
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Fetch server config on mount
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((data: ServerConfig) => {
        setConfig(data);
        setForm({
          teamsDir: data.teamsDir,
          tasksDir: data.tasksDir,
          pollIntervalMs: data.pollIntervalMs,
          demoMode: data.demoMode,
        });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamsDir: form.teamsDir,
          tasksDir: form.tasksDir,
          pollIntervalMs: form.pollIntervalMs,
          demoMode: form.demoMode,
        }),
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
    }
  };

  const teamName = teamId?.toUpperCase() ?? '';

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 100px)',
      minHeight: '280px',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
        }}>
          {t('settings.title', { name: teamName })}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* ── APPEARANCE ── */}
        <SectionLabel label={t('settings.appearance')} />

        <FieldRow label={t('settings.theme')}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            maxWidth: '420px',
          }}>
            {THEMES.map((themeItem) => {
              const isActive = theme === themeItem.id;
              return (
                <button
                  key={themeItem.id}
                  onClick={() => setTheme(themeItem.id as ThemeId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px',
                    background: isActive ? `${themeItem.accent}14` : 'var(--surface-1)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-1)'; }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                      background: themeItem.accent,
                      boxShadow: `0 0 6px ${themeItem.accent}`,
                    }} />
                  )}
                  <div style={{
                    width: '28px', height: '18px', borderRadius: '2px', flexShrink: 0,
                    background: themeItem.bg,
                    border: `1px solid ${isActive ? themeItem.accent : 'var(--border)'}`,
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', alignItems: 'flex-start',
                    gap: '2px', padding: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{ width: '80%', height: '2px', background: themeItem.accent, borderRadius: '1px', opacity: 0.9 }} />
                    <div style={{ width: '55%', height: '1px', background: themeItem.accent, borderRadius: '1px', opacity: 0.45 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em',
                      color: isActive ? themeItem.accent : 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                    }}>
                      {t(`theme.${themeItem.id}.label`)}
                    </div>
                    <div style={{
                      fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.03em',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {t(`theme.${themeItem.id}.desc`)}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                      background: themeItem.accent,
                      boxShadow: `0 0 5px ${themeItem.accent}`,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow label={t('settings.language')}>
          <div style={{ display: 'flex', gap: '0' }}>
            {[
              { code: 'en', label: 'EN' },
              { code: 'zh', label: '中' },
            ].map((lang, i) => {
              const isActive = i18n.language?.startsWith(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  style={{
                    padding: '4px 14px',
                    fontSize: '10px', fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    background: isActive ? 'var(--active-bg-med)' : 'var(--surface-1)',
                    color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
                    border: `1px solid ${isActive ? 'var(--phosphor)' : 'var(--border)'}`,
                    borderRadius: i === 0 ? '3px 0 0 3px' : '0 3px 3px 0',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        {/* ── SERVER ── */}
        <SectionLabel label={t('settings.server')} />

        <FieldRow label={t('settings.teams_dir')}>
          <input
            type="text"
            value={form.teamsDir}
            onChange={e => setForm(f => ({ ...f, teamsDir: e.target.value }))}
            style={inputStyle}
          />
        </FieldRow>

        <FieldRow label={t('settings.tasks_dir')}>
          <input
            type="text"
            value={form.tasksDir}
            onChange={e => setForm(f => ({ ...f, tasksDir: e.target.value }))}
            style={inputStyle}
          />
        </FieldRow>

        <FieldRow label={t('settings.poll_interval')}>
          <div style={{ display: 'flex', gap: '0' }}>
            {POLL_PRESETS.map((ms, i) => {
              const isActive = form.pollIntervalMs === ms;
              return (
                <button
                  key={ms}
                  onClick={() => setForm(f => ({ ...f, pollIntervalMs: ms }))}
                  style={{
                    padding: '4px 12px',
                    fontSize: '9px', fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    background: isActive ? 'var(--active-bg-med)' : 'var(--surface-1)',
                    color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
                    border: `1px solid ${isActive ? 'var(--phosphor)' : 'var(--border)'}`,
                    borderLeft: i === 0 ? undefined : 'none',
                    borderRadius: i === 0 ? '3px 0 0 3px' : i === POLL_PRESETS.length - 1 ? '0 3px 3px 0' : '0',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {ms / 1000}s
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow label={t('settings.demo_mode')}>
          <div style={{ display: 'flex', gap: '0' }}>
            {[
              { value: 'auto', label: t('settings.demo_auto') },
              { value: 'on', label: t('settings.demo_on') },
              { value: 'off', label: t('settings.demo_off') },
            ].map((opt, i, arr) => {
              const isActive = form.demoMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, demoMode: opt.value }))}
                  style={{
                    padding: '4px 14px',
                    fontSize: '9px', fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    background: isActive ? 'var(--active-bg-med)' : 'var(--surface-1)',
                    color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
                    border: `1px solid ${isActive ? 'var(--phosphor)' : 'var(--border)'}`,
                    borderLeft: i === 0 ? undefined : 'none',
                    borderRadius: i === 0 ? '3px 0 0 3px' : i === arr.length - 1 ? '0 3px 3px 0' : '0',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', maxWidth: '530px' }}>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            style={{
              padding: '5px 18px',
              fontSize: '9px', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: saveState === 'saved' ? 'var(--phosphor-bg-subtle)' : 'var(--surface-1)',
              color: saveState === 'saved' ? 'var(--status-ok)' : 'var(--phosphor)',
              border: `1px solid ${saveState === 'saved' ? 'var(--status-ok)' : 'var(--phosphor)'}`,
              borderRadius: '3px',
              cursor: saveState === 'saving' ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {saveState === 'saving' ? t('settings.saving') : saveState === 'saved' ? t('settings.saved') : t('settings.save')}
          </button>
        </div>

        {/* ── CONNECTION ── */}
        <SectionLabel label={t('settings.connection')} />

        <FieldRow label={t('settings.ws_status')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              display: 'inline-block',
              background: wsConnected ? 'var(--status-ok)' : 'var(--status-warn)',
              boxShadow: `0 0 4px ${wsConnected ? 'var(--status-ok)' : 'var(--status-warn)'}`,
              animation: wsConnected ? 'status-pulse 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              color: wsConnected ? 'var(--status-ok)' : 'var(--status-warn)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {wsConnected ? 'LIVE' : 'POLL'}
            </span>
          </div>
        </FieldRow>

        <FieldRow label={t('settings.server_port')}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
            {config?.port ?? '—'}
          </span>
        </FieldRow>

        <FieldRow label={t('settings.selected_team')}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
            {teamId ?? t('settings.none')}
          </span>
        </FieldRow>

        {/* ── KEYBOARD SHORTCUTS ── */}
        <SectionLabel label={t('settings.shortcuts_title')} />

        {[
          t('settings.shortcuts_view_switch'),
          t('settings.shortcuts_search'),
          t('settings.shortcuts_close'),
          t('settings.shortcuts_next'),
          t('settings.shortcuts_refresh'),
        ].map((shortcut, i) => {
          const [key, ...descParts] = shortcut.split(': ');
          const desc = descParts.join(': ');
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '4px 0', maxWidth: '530px',
            }}>
              <code style={{
                padding: '2px 8px', fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                color: 'var(--phosphor)',
                letterSpacing: '0.06em',
                minWidth: '50px', textAlign: 'center',
              }}>{key}</code>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{desc}</span>
            </div>
          );
        })}

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '320px',
  padding: '5px 10px',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.04em',
  background: 'var(--surface-1)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  outline: 'none',
};
