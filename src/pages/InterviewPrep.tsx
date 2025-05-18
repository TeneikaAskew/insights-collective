import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Code, Star, Users } from 'lucide-react';
import JobDescriptionAnalyzer from '@/components/resume/JobDescriptionAnalyzer';
import { useUser } from '@/hooks/use-user';

export default function InterviewPrep() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Interview Preparation</CardTitle>
            <CardDescription>Please log in to access interview preparation tools.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Interview Preparation</h1>
        <p className="text-muted-foreground">
          Comprehensive tools to help you prepare for your next interview.
        </p>
      </div>

      <Tabs defaultValue="job-analysis" className="space-y-8">
        <TabsList className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <TabsTrigger value="job-analysis" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Job Analysis
          </TabsTrigger>
          <TabsTrigger value="star-practice" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            STAR Practice
          </TabsTrigger>
          <TabsTrigger value="code-practice" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Practice
          </TabsTrigger>
          <TabsTrigger value="mock-interviews" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mock Interviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job-analysis">
          <Card>
            <CardHeader>
              <CardTitle>Job Description Analysis</CardTitle>
              <CardDescription>
                Analyze job descriptions to get personalized study guides and interview preparation tips.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobDescriptionAnalyzer resumeText={null} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="star-practice">
          <Card>
            <CardHeader>
              <CardTitle>STAR Response Practice</CardTitle>
              <CardDescription>
                Practice behavioral interview questions using the STAR method with AI feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Button onClick={() => navigate('/star-practice')}>
                  Start STAR Practice
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code-practice">
          <Card>
            <CardHeader>
              <CardTitle>Code Challenge Practice</CardTitle>
              <CardDescription>
                Practice technical coding challenges with real-time feedback and AI code review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Button onClick={() => navigate('/code-practice')}>
                  Start Code Practice
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mock-interviews">
          <Card>
            <CardHeader>
              <CardTitle>Mock Interviews</CardTitle>
              <CardDescription>
                Schedule and participate in mock interviews with peers or AI interviewers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Button onClick={() => navigate('/mock-interviews')}>
                  Schedule Mock Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 