
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Target, TrendingUp, Users } from 'lucide-react';

const CareerAgent = () => {
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Career Agent</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Your personal AI-powered career advisor to guide your professional journey.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Career Consultation
              </CardTitle>
              <CardDescription>
                Get personalized career advice and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Chat with our AI career agent to get insights about your career path, skill development, and job opportunities.
              </p>
              <Button className="w-full">
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Goal Setting
              </CardTitle>
              <CardDescription>
                Define and track your career objectives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set SMART career goals and get guidance on achieving them with actionable steps.
              </p>
              <Button className="w-full">
                Set Goals
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Skills Assessment
              </CardTitle>
              <CardDescription>
                Evaluate your current skills and identify gaps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Take comprehensive assessments to understand your strengths and areas for improvement.
              </p>
              <Button className="w-full">
                Take Assessment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mentorship Matching
              </CardTitle>
              <CardDescription>
                Connect with industry professionals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Get matched with mentors in your field who can provide guidance and support.
              </p>
              <Button className="w-full">
                Find Mentor
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
