
import { useEffect } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';

interface UsePageOnboardingProps {
  tourId: string;
  autoStart?: boolean;
  dependencies?: string[];
}

export const usePageOnboarding = ({ 
  tourId, 
  autoStart = true,
  dependencies = []
}: UsePageOnboardingProps) => {
  const { startTour, completedTours, isFirstVisit } = useOnboarding();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!autoStart || !isAuthenticated) return;

    // Check if this tour has already been completed
    if (completedTours.includes(tourId)) return;

    // Check if dependencies are met (other tours completed)
    const dependenciesMet = dependencies.every(dep => completedTours.includes(dep));
    if (dependencies.length > 0 && !dependenciesMet) return;

    // Auto-start tour for returning users on key pages
    const shouldAutoStart = isFirstVisit || !completedTours.includes(tourId);
    
    if (shouldAutoStart) {
      // Delay to allow page to render
      const timer = setTimeout(() => {
        startTour(tourId);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [tourId, autoStart, isAuthenticated, completedTours, isFirstVisit, dependencies, startTour]);

  return { startTour };
};
