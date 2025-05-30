
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';

// Map routes to tour IDs
const routeToTourMap: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/resume': 'resume',
  '/interview-prep': 'interview-prep',
  '/interview-prep/star-practice': 'interview-prep',
  '/interview-prep/code-practice': 'interview-prep',
  '/interview-prep/job-description': 'interview-prep',
  '/interview-prep/mock-interviews': 'interview-prep',
  '/career-agent': 'career-agent',
  '/courses': 'courses',
  '/career-pathway': 'career-pathway',
  '/portfolio-explorer': 'portfolio-explorer',
};

export const usePageOnboarding = (delay: number = 1500) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { completedTours, startTour } = useOnboarding();

  useEffect(() => {
    if (!isAuthenticated) return;

    const tourId = routeToTourMap[location.pathname];
    if (!tourId || completedTours.includes(tourId)) return;

    const timer = setTimeout(() => {
      startTour(tourId);
    }, delay);

    return () => clearTimeout(timer);
  }, [location.pathname, isAuthenticated, completedTours, startTour, delay]);

  return {
    canStartTour: (tourId: string) => isAuthenticated && !completedTours.includes(tourId),
    startManualTour: startTour,
  };
};
