
import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { HelpCircle, Map, Navigation } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface TourTriggerProps {
  pageTourId?: string;
  showNavigationTour?: boolean;
  className?: string;
}

export const TourTrigger: React.FC<TourTriggerProps> = ({ 
  pageTourId, 
  showNavigationTour = true,
  className = ""
}) => {
  const { startTour } = useOnboarding();

  const handleStartTour = (tourId: string) => {
    startTour(tourId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-8 px-2 ${className}`}>
          <HelpCircle className="h-4 w-4 mr-1" />
          Help
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {showNavigationTour && (
          <>
            <DropdownMenuItem onClick={() => handleStartTour('navigation')}>
              <Navigation className="h-4 w-4 mr-2" />
              Navigation Overview
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {pageTourId && (
          <DropdownMenuItem onClick={() => handleStartTour(pageTourId)}>
            <Map className="h-4 w-4 mr-2" />
            Page Tour
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
