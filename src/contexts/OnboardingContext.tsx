
import React, { createContext, useContext, useState, useEffect } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
}

interface OnboardingTour {
  id: string;
  name: string;
  steps: OnboardingStep[];
}

interface OnboardingContextType {
  isOnboardingActive: boolean;
  currentTour: string | null;
  currentStep: number;
  completedTours: string[];
  dismissedTours: string[];
  startTour: (tourId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetOnboarding: () => void;
  isFirstVisit: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

const STORAGE_KEY = 'onboarding_progress';

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentTour, setCurrentTour] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>([]);
  const [dismissedTours, setDismissedTours] = useState<string[]>([]);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        setCompletedTours(progress.completedTours || []);
        setDismissedTours(progress.dismissedTours || []);
        setIsFirstVisit(false);
      } catch (error) {
        console.error('Failed to parse onboarding progress:', error);
        setIsFirstVisit(true);
      }
    } else {
      setIsFirstVisit(true);
    }
  }, []);

  const saveProgress = (completed: string[], dismissed: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
      completedTours: completed,
      dismissedTours: dismissed,
      lastUpdated: Date.now()
    }));
  };

  const startTour = (tourId: string) => {
    // Don't start if tour was already completed or dismissed
    if (completedTours.includes(tourId) || dismissedTours.includes(tourId)) {
      return;
    }
    
    setCurrentTour(tourId);
    setCurrentStep(0);
    setIsOnboardingActive(true);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const skipTour = () => {
    console.log('[OnboardingContext] skipTour called');
    setIsFirstVisit(false);
    setIsOnboardingActive(false);
    
    if (currentTour && !dismissedTours.includes(currentTour)) {
      const newDismissedTours = [...dismissedTours, currentTour];
      setDismissedTours(newDismissedTours);
      saveProgress(completedTours, newDismissedTours);
    } else {
      // Even if no tour is active, save the progress to mark as not first visit
      saveProgress(completedTours, dismissedTours);
    }
    
    setCurrentTour(null);
    setCurrentStep(0);
  };

  const completeTour = () => {
    setIsFirstVisit(false);
    setIsOnboardingActive(false);
    
    if (currentTour && !completedTours.includes(currentTour)) {
      const newCompletedTours = [...completedTours, currentTour];
      setCompletedTours(newCompletedTours);
      saveProgress(newCompletedTours, dismissedTours);
    } else {
      // Even if no tour is active, save the progress to mark as not first visit
      saveProgress(completedTours, dismissedTours);
    }
    
    setCurrentTour(null);
    setCurrentStep(0);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCompletedTours([]);
    setDismissedTours([]);
    setIsFirstVisit(true);
    setIsOnboardingActive(false);
    setCurrentTour(null);
    setCurrentStep(0);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        currentTour,
        currentStep,
        completedTours,
        dismissedTours,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resetOnboarding,
        isFirstVisit,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
