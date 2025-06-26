import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OnboardingTriggerProps {
  tourId: string;
  variant?: 'icon' | 'button';
  className?: string;
}

const OnboardingTrigger: React.FC<OnboardingTriggerProps> = ({ 
  tourId, 
  variant = 'icon',
  className = '' 
}) => {
  const { startTour, completedTours, resetOnboarding } = useOnboarding();

  const handleStartTour = () => {
    startTour(tourId);
  };

  const handleResetAndStart = () => {
    resetOnboarding();
    setTimeout(() => {
      startTour(tourId);
    }, 100);
  };

  const isCompleted = completedTours.includes(tourId);

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={isCompleted ? handleResetAndStart : handleStartTour}
              className={`h-9 w-9 ${className}`}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCompleted ? 'Restart tour' : 'Start tour'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isCompleted ? handleResetAndStart : handleStartTour}
      className={`gap-2 ${className}`}
    >
      {isCompleted ? (
        <>
          <RotateCcw className="h-3 w-3" />
          Restart Tour
        </>
      ) : (
        <>
          <HelpCircle className="h-3 w-3" />
          Take Tour
        </>
      )}
    </Button>
  );
};

export default OnboardingTrigger;