
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, MessageSquare, FileText, Video, Target, Clock } from 'lucide-react';

const InterviewPrep = () => {
  // Initialize page onboarding
  usePageOnboarding({ 
    tourId: 'interview-prep', 
    autoStart: true,
    dependencies: ['resume'] // Start after resume tour
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Interview Preparation"
          description="Master your data career interviews with AI-powered practice sessions and personalized feedback."
          pageTourId="interview-prep"
        />
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-tour="prep-options">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-500" />
                Code Practice
              </CardTitle>
              <CardDescription>
                Practice coding challenges for technical interviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Start Coding Practice</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                STAR Practice
              </CardTitle>
              <CardDescription>
                Master behavioral questions using the STAR method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Practice STAR Method</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                Job Analysis
              </CardTitle>
              <CardDescription>
                Analyze job descriptions and prepare targeted responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Analyze Job Description</Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2" data-tour="practice-sections">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Mock Interviews
              </CardTitle>
              <CardDescription>
                Practice with AI-powered mock interviews for different data roles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Data Scientist Interview</h3>
                    <p className="text-sm text-gray-500">45 minutes • Technical + Behavioral</p>
                  </div>
                  <Button size="sm">Start</Button>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Data Analyst Interview</h3>
                    <p className="text-sm text-gray-500">30 minutes • SQL + Business Cases</p>
                  </div>
                  <Button size="sm">Start</Button>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium">ML Engineer Interview</h3>
                    <p className="text-sm text-gray-500">60 minutes • System Design + Coding</p>
                  </div>
                  <Button size="sm">Start</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Your Progress
              </CardTitle>
              <CardDescription>
                Track your interview preparation progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Practice Sessions</p>
                    <p className="text-sm text-gray-500">0 completed this week</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Code className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Coding Challenges</p>
                    <p className="text-sm text-gray-500">0 problems solved</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">STAR Responses</p>
                    <p className="text-sm text-gray-500">0 responses practiced</p>
                  </div>
                </div>
              </div>
              
              <Button className="w-full mt-4">View Detailed Progress</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default InterviewPrep;
