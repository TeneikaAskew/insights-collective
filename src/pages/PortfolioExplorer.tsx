
import React from 'react';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PortfolioExplorer = () => {
  usePageOnboarding({ tourId: 'portfolioExplorer' });

  return (
    <AppLayout>
      <OnboardingGuide tourId="portfolioExplorer" />
      <OnboardingGuide tourId="navigation" />
      
      <div className="space-y-6">
        <PageHeader 
          title="Portfolio Explorer"
          description="Build and showcase your data science portfolio to stand out to employers"
          tourId="portfolioExplorer"
        />
        
        <div data-tour="portfolio-main">
          <Card>
            <CardHeader>
              <CardTitle>Professional Portfolio</CardTitle>
              <CardDescription>
                Create a compelling portfolio that showcases your data science projects and skills.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Portfolio building functionality will be implemented here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default PortfolioExplorer;
