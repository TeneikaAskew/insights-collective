
import React from 'react';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const InterviewPrep = () => {
  usePageOnboarding({ tourId: 'interviewPrep' });

  return (
    <AppLayout>
      <OnboardingGuide tourId="interviewPrep" />
      <OnboardingGuide tourId="navigation" />
      
      <div className="space-y-6">
        <PageHeader 
          title="Interview Preparation"
          description="Practice data science interviews with AI-powered feedback and realistic scenarios"
          tourId="interviewPrep"
        />
        
        <div data-tour="interview-main">
          <Card>
            <CardHeader>
              <CardTitle>AI Interview Practice</CardTitle>
              <CardDescription>
                Practice with realistic data science interview questions and get instant feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Interview practice functionality will be implemented here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default InterviewPrep;
