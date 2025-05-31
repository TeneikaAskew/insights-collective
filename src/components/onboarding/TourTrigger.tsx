
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

interface TourTriggerProps {
  tourId: string;
  variant?: 'navigation' | 'page';
  size?: 'sm' | 'default';
}

const TourTrigger: React.FC<TourTriggerProps> = ({ 
  tourId, 
  variant = 'page',
  size = 'sm' 
}) => {
  const { startTour } = useOnboarding();

  const handleTriggerTour = () => {
    startTour(tourId);
  };

  const buttonText = variant === 'navigation' ? 'Navigation Guide' : 'Page Guide';
  const tooltipText = variant === 'navigation' 
    ? 'Learn about sidebar navigation and platform features'
    : 'Get a guided tour of this page';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size={size}
            onClick={handleTriggerTour}
            className="gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            {buttonText}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TourTrigger;
