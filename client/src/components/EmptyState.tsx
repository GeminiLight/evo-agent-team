import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../hooks/useOnboarding';
import OnboardingTour from './OnboardingTour';

interface EmptyStateProps {
  onEnableDemo: () => void;
}

export default function EmptyState({ onEnableDemo }: EmptyStateProps) {
  const { t } = useTranslation();
  const { tourStarted, currentStep, completeTour, startTour, nextStep, prevStep, skipTour } =
    useOnboarding();

  const handleStartTour = () => {
    startTour();
  };

  const handleTourComplete = () => {
    completeTour();
    // After tour, enable demo mode automatically
    onEnableDemo();
  };

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--void)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Logo/Title */}
          <div
            style={{
              marginBottom: '32px',
            }}
          >
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 8px 0',
                letterSpacing: '0.04em',
              }}
            >
              evo-agent-team
            </h1>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                margin: 0,
                letterSpacing: '0.06em',
              }}
            >
              Manage your AI coding team like humans
            </p>
          </div>

          {/* Main CTA: Tour */}
          <button
            onClick={handleStartTour}
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              background: 'var(--phosphor-glow)',
              color: 'var(--void)',
              border: '1px solid var(--phosphor)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 20px var(--phosphor-glow-strong)';
              e.currentTarget.style.background = 'var(--phosphor)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'var(--phosphor-glow)';
            }}
          >
            🎯 {t('onboarding.tour_cta')}
          </button>

          {/* Secondary CTA: Setup */}
          <button
            onClick={onEnableDemo}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-bright)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              marginBottom: '24px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface-0)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ⚙️ {t('onboarding.setup_cta')}
          </button>

          {/* Feature Highlight Box */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '12px',
                fontWeight: 600,
              }}
            >
              {t('onboarding.what_you_can_do')}
            </div>

            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {[
                { icon: '👁️', key: 'watch_team' },
                { icon: '🎯', key: 'respond_inline' },
                { icon: '📚', key: 'save_lessons' },
                { icon: '💰', key: 'track_costs' },
              ].map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    padding: '6px 0',
                    lineHeight: 1.5,
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ marginRight: '8px' }}>{item.icon}</span>
                  {t(`onboarding.${item.key}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Onboarding Checklist */}
          <div
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '12px',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '8px',
                fontWeight: 600,
              }}
            >
              📋 Onboarding Checklist
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { label: 'Take guided tour', key: 'tour' },
                { label: 'Understand Dashboard', key: 'dashboard' },
                { label: 'Try approving a request', key: 'approve' },
              ].map((item, idx) => (
                <label
                  key={idx}
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  <input
                    type="checkbox"
                    disabled
                    checked={idx === 1}
                    style={{ cursor: 'not-allowed' }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tour overlay */}
      <OnboardingTour
        active={tourStarted}
        currentStep={currentStep}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        onComplete={handleTourComplete}
      />
    </>
  );
}
