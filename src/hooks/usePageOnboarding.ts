
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface UsePageOnboardingOptions {
  tourId?: string;
  autoStart?: boolean;
  delay?: number;
}

export const usePageOnboarding = (options: UsePageOnboardingOptions = {}) => {
  const location = useLocation();
  const { isFirstVisit, completedTours, startTour } = useOnboarding();

  const {
    tourId,
    autoStart = true,
    delay = 1000
  } = options;

  useEffect(() => {
    if (!autoStart || !tourId) return;

    // Don't auto-start tours on first visit (home page handles that)
    if (isFirstVisit) return;

    // Don't start if tour already completed
    if (completedTours.includes(tourId)) return;

    // Auto-start page tour for returning users
    const timer = setTimeout(() => {
      startTour(tourId);
    }, delay);

    return () => clearTimeout(timer);
  }, [isFirstVisit, completedTours, startTour, tourId, autoStart, delay, location.pathname]);

  return {
    isFirstVisit,
    completedTours,
    startTour
  };
};
