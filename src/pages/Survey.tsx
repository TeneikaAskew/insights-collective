
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, BarChart3 } from 'lucide-react';

const Survey = () => {
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Surveys & Feedback</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Help us improve by participating in surveys and providing feedback.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Platform Feedback Survey
              </CardTitle>
              <CardDescription>
                Share your experience with our platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Your feedback helps us understand what's working well and what we can improve.
              </p>
              <Button className="w-full">
                Take Survey
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Career Development Survey
              </CardTitle>
              <CardDescription>
                Tell us about your career goals and challenges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Help us create better content and resources for your career journey.
              </p>
              <Button className="w-full">
                Take Survey
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Course Effectiveness Survey
              </CardTitle>
              <CardDescription>
                Rate our courses and suggest improvements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Your input directly influences how we design and improve our educational content.
              </p>
              <Button className="w-full">
                Take Survey
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Survey Results</CardTitle>
              <CardDescription>
                See how your feedback is making a difference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                We regularly publish insights from survey responses to show how we're improving based on your feedback.
              </p>
              <Button variant="outline" className="w-full">
                View Results
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Survey;
