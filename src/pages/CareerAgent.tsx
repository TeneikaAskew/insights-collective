
import React from 'react';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CareerAgent = () => {
  usePageOnboarding({ tourId: 'careerAgent' });

  return (
    <AppLayout>
      <OnboardingGuide tourId="careerAgent" />
      <OnboardingGuide tourId="navigation" />
      
      <div className="space-y-6">
        <PageHeader 
          title="Career Agent"
          description="Get personalized career guidance from your AI career advisor"
          tourId="careerAgent"
        />
        
        <div data-tour="career-agent-main">
          <Card>
            <CardHeader>
              <CardTitle>AI Career Guidance</CardTitle>
              <CardDescription>
                Chat with your personal AI career advisor for guidance on your data science journey.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Career agent chat functionality will be implemented here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
