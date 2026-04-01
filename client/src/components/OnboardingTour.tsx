import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface TourStep {
  id: string;
  titleKey: string;
  descKey: string;
  elementSelector: string;
  highlightOffset?: { top?: number; left?: number; width?: number; height?: number };
}

interface OnboardingTourProps {
  active: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    titleKey: 'onboarding.step1_title',
    descKey: 'onboarding.step1_desc',
    elementSelector: '[data-tour="dashboard"]',
  },
  {
    id: 'approvals',
    titleKey: 'onboarding.step2_title',
    descKey: 'onboarding.step2_desc',
    elementSelector: '[data-tour="approvals"]',
  },
  {
    id: 'messages',
    titleKey: 'onboarding.step3_title',
    descKey: 'onboarding.step3_desc',
    elementSelector: '[data-tour="messages"]',
  },
  {
    id: 'feedback',
    titleKey: 'onboarding.step4_title',
    descKey: 'onboarding.step4_desc',
    elementSelector: '[data-tour="feedback"]',
  },
  {
    id: 'knowledge',
    titleKey: 'onboarding.step5_title',
    descKey: 'onboarding.step5_desc',
    elementSelector: '[data-tour="knowledge"]',
  },
];

export default function OnboardingTour({
  active,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}: OnboardingTourProps) {
  const { t } = useTranslation();
  const [highlight, setHighlight] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Find and highlight the element
  useEffect(() => {
    if (!active || !step) return;

    let retryCount = 0;
    const maxRetries = 50; // 5 seconds at 100ms intervals
    let timeoutId: ReturnType<typeof setTimeout>;

    const findAndHighlightElement = () => {
      const el = document.querySelector(step.elementSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlight({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
        return true; // Found successfully
      }
      return false; // Not found
    };

    // Try immediately
    if (findAndHighlightElement()) {
      // Element found, add listeners for recalculation
      const handleResize = () => {
        findAndHighlightElement();
      };
      const handleScroll = () => {
        findAndHighlightElement();
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }

    // Retry with exponential backoff if not found
    const attemptFind = () => {
      if (findAndHighlightElement()) {
        // Success — add listeners
        const handleResize = () => {
          findAndHighlightElement();
        };
        const handleScroll = () => {
          findAndHighlightElement();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, true);
      } else if (retryCount < maxRetries) {
        retryCount++;
        timeoutId = setTimeout(attemptFind, 100);
      }
    };

    timeoutId = setTimeout(attemptFind, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, currentStep, step]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const lastStep = currentStep === TOUR_STEPS.length - 1;
      if (e.key === 'ArrowRight') {
        if (lastStep) onComplete();
        else onNext();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'Escape') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, currentStep, onNext, onPrev, onSkip, onComplete]);

  if (!active || !step) return null;

  return (
    <>
      {/* Dimmed overlay */}
      <div
        onClick={onSkip}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          cursor: 'pointer',
        }}
      />

      {/* Spotlight */}
      {highlight && (
        <div
          style={{
            position: 'fixed',
            top: highlight.top - 8,
            left: highlight.left - 8,
            width: highlight.width + 16,
            height: highlight.height + 16,
            border: '2px solid var(--phosphor)',
            borderRadius: '6px',
            boxShadow: '0 0 20px var(--phosphor-glow-strong)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          top: highlight ? Math.min(highlight.top + highlight.height + 24, window.innerHeight - 280) : '50%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '20px',
          maxWidth: '400px',
          width: '90vw',
          zIndex: 10000,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          animation: 'fade-up 0.3s ease-out',
        }}
      >
        {/* Progress indicator */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}
        >
          {t('onboarding.progress', {
            current: currentStep + 1,
            total: TOUR_STEPS.length,
          })}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
            letterSpacing: '0.04em',
          }}
        >
          {t(step.titleKey)}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '0 0 16px 0',
            lineHeight: 1.5,
            letterSpacing: '0.02em',
          }}
        >
          {t(step.descKey)}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left group: Back + Skip */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onPrev}
              disabled={currentStep === 0}
              style={{
                padding: '6px 12px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                background: currentStep === 0 ? 'var(--surface-1)' : 'transparent',
                color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                border: `1px solid ${currentStep === 0 ? 'var(--border)' : 'var(--border-bright)'}`,
                borderRadius: '3px',
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
              }}
              onMouseEnter={e => {
                if (currentStep > 0) {
                  e.currentTarget.style.background = 'var(--surface-1)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (currentStep > 0) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {t('onboarding.back')}
            </button>

            <button
              onClick={onSkip}
              style={{
                padding: '6px 12px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {t('onboarding.skip')}
            </button>
          </div>

          {/* Right: Next/Complete */}
          <button
            onClick={isLastStep ? onComplete : onNext}
            style={{
              padding: '6px 16px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              background: 'var(--phosphor-glow)',
              color: 'var(--void)',
              border: '1px solid var(--phosphor)',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 600,
              textTransform: 'uppercase',
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
            {isLastStep ? t('onboarding.complete') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </>
  );
}
