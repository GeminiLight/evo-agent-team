import { useState, useEffect, useCallback } from 'react';

interface OnboardingState {
  tourStarted: boolean;
  currentStep: number;
  tourComplete: boolean;
}

const STORAGE_KEY = 'onboarding-state';

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') {
      return { tourStarted: false, currentStep: 0, tourComplete: false };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { tourStarted: false, currentStep: 0, tourComplete: false };
    } catch {
      return { tourStarted: false, currentStep: 0, tourComplete: false };
    }
  });

  const saveState = useCallback((newState: OnboardingState) => {
    setState(newState);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {
        // Silently fail if localStorage is unavailable
      }
    }
  }, []);

  const startTour = useCallback(() => {
    saveState({ tourStarted: true, currentStep: 0, tourComplete: false });
  }, [saveState]);

  const nextStep = useCallback(() => {
    setState(prev => {
      const next = { ...prev, currentStep: Math.min(prev.currentStep + 1, 4) };
      saveState(next);
      return next;
    });
  }, [saveState]);

  const prevStep = useCallback(() => {
    setState(prev => {
      const next = { ...prev, currentStep: Math.max(prev.currentStep - 1, 0) };
      saveState(next);
      return next;
    });
  }, [saveState]);

  const skipTour = useCallback(() => {
    saveState({ tourStarted: false, currentStep: 0, tourComplete: true });
  }, [saveState]);

  const completeTour = useCallback(() => {
    saveState({ tourStarted: false, currentStep: 0, tourComplete: true });
  }, [saveState]);

  return {
    tourStarted: state.tourStarted,
    currentStep: state.currentStep,
    tourComplete: state.tourComplete,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  };
}
