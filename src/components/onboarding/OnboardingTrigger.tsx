
import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OnboardingTriggerProps {
  tourId: string;
  variant?: 'button' | 'icon' | 'text';
  children?: React.ReactNode;
  className?: string;
}

const OnboardingTrigger: React.FC<OnboardingTriggerProps> = ({ 
  tourId, 
  variant = 'icon', 
  children,
  className 
}) => {
  const { startTour } = useOnboarding();

  const handleStartTour = () => {
    startTour(tourId);
  };

  if (variant === 'text') {
    return (
      <button
        onClick={handleStartTour}
        className={`text-sm text-muted-foreground hover:text-primary underline ${className}`}
      >
        {children || 'Take a tour'}
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartTour}
        className={className}
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        {children || 'Take Tour'}
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartTour}
            className={`h-8 w-8 p-0 ${className}`}
          >
            <HelpCircle className="h-4 w-4" />
            <span className="sr-only">Start tour</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Take a tour of this page</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default OnboardingTrigger;
