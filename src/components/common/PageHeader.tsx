
import React from 'react';
import TourTrigger from '@/components/onboarding/TourTrigger';

interface PageHeaderProps {
  title: string;
  description?: string;
  tourId?: string;
  showNavigationTour?: boolean;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  tourId,
  showNavigationTour = true,
  children
}) => {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          {showNavigationTour && (
            <TourTrigger tourId="navigation" variant="navigation" />
          )}
          {tourId && (
            <TourTrigger tourId={tourId} variant="page" />
          )}
        </div>
      </div>
      
      {children}
    </div>
  );
};

export default PageHeader;
