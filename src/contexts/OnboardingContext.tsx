
import React, { createContext, useContext, useState, useEffect } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetPath: string;
  completed: boolean;
}

interface OnboardingContextType {
  currentStep: number;
  steps: OnboardingStep[];
  isOnboardingActive: boolean;
  completeStep: (stepId: string) => void;
  startOnboarding: () => void;
  skipOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const defaultSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Insights Collective',
    description: 'Let\'s get you started with your data science journey',
    targetPath: '/dashboard',
    completed: false,
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Tell us about yourself to get personalized recommendations',
    targetPath: '/profile',
    completed: false,
  },
  {
    id: 'career-pathway',
    title: 'Discover Your Career Path',
    description: 'Take our assessment to find the perfect data science career for you',
    targetPath: '/career-pathway',
    completed: false,
  },
  {
    id: 'explore-courses',
    title: 'Explore Courses',
    description: 'Browse our comprehensive course catalog',
    targetPath: '/courses',
    completed: false,
  },
  {
    id: 'join-community',
    title: 'Join the Community',
    description: 'Connect with other learners in our forums',
    targetPath: '/forums',
    completed: false,
  },
  {
    id: 'resources',
    title: 'Access Resources',
    description: 'Discover tools and resources to accelerate your learning',
    targetPath: '/resources',
    completed: false,
  },
];

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>(defaultSteps);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    if (!onboardingCompleted) {
      setIsOnboardingActive(true);
    }
  }, []);

  const completeStep = (stepId: string) => {
    setSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  };

  const startOnboarding = () => {
    setIsOnboardingActive(true);
    setCurrentStep(0);
    localStorage.removeItem('onboarding-completed');
  };

  const skipOnboarding = () => {
    setIsOnboardingActive(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Onboarding completed
      setIsOnboardingActive(false);
      localStorage.setItem('onboarding-completed', 'true');
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        steps,
        isOnboardingActive,
        completeStep,
        startOnboarding,
        skipOnboarding,
        nextStep,
        prevStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
