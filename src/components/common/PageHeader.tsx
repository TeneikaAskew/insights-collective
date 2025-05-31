
import React from 'react';
import { TourTrigger } from '@/components/onboarding/TourTrigger';

interface PageHeaderProps {
  title: string;
  description?: string;
  pageTourId?: string;
  showNavigationTour?: boolean;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  pageTourId,
  showNavigationTour = true,
  children
}) => {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground max-w-2xl">{description}</p>
        )}
        {children}
      </div>
      <TourTrigger 
        pageTourId={pageTourId}
        showNavigationTour={showNavigationTour}
        className="mt-1"
      />
    </div>
  );
};
