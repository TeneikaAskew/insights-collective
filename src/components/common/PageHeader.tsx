
import React from 'react';
import { Button } from '@/components/ui/button';
import OnboardingTrigger from '@/components/onboarding/OnboardingTrigger';
import { RefreshCw } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  tourId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  tourId,
  onRefresh,
  isRefreshing = false,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {tourId && <OnboardingTrigger tourId={tourId} variant="button" />}
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            className="whitespace-nowrap"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
