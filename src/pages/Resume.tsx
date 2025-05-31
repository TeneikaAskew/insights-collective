
import React from 'react';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Resume = () => {
  usePageOnboarding({ tourId: 'resume' });

  return (
    <AppLayout>
      <OnboardingGuide tourId="resume" />
      <OnboardingGuide tourId="navigation" />
      
      <div className="space-y-6">
        <PageHeader 
          title="Resume Analyzer"
          description="Get AI-powered analysis and optimization suggestions for your resume"
          tourId="resume"
        />
        
        <div data-tour="resume-main">
          <Card>
            <CardHeader>
              <CardTitle>Upload Your Resume</CardTitle>
              <CardDescription>
                Upload your resume to get instant AI-powered analysis with improvement recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Resume upload functionality will be implemented here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
