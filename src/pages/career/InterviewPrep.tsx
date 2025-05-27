
import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Code, MessageSquare, FileText, Video } from 'lucide-react';

const InterviewPrep = () => {
  const prepModules = [
    {
      id: 'code-practice',
      title: 'Coding Practice',
      description: 'Practice coding problems commonly asked in data science interviews',
      icon: <Code className="h-6 w-6" />,
      path: '/interview-prep/code-practice',
      difficulty: 'Intermediate',
      duration: '30-60 min'
    },
    {
      id: 'star-practice',
      title: 'STAR Method Practice',
      description: 'Master behavioral interview questions using the STAR method',
      icon: <MessageSquare className="h-6 w-6" />,
      path: '/interview-prep/star-practice',
      difficulty: 'Beginner',
      duration: '20-40 min'
    },
    {
      id: 'job-description',
      title: 'Job Description Analysis',
      description: 'Analyze job descriptions and prepare targeted responses',
      icon: <FileText className="h-6 w-6" />,
      path: '/interview-prep/job-description',
      difficulty: 'Beginner',
      duration: '15-30 min'
    },
    {
      id: 'mock-interviews',
      title: 'Mock Interviews',
      description: 'Practice with AI-powered mock interview sessions',
      icon: <Video className="h-6 w-6" />,
      path: '/interview-prep/mock-interviews',
      difficulty: 'All Levels',
      duration: '45-90 min'
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Interview Preparation</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Get ready for your data science interviews with comprehensive practice modules and AI-powered feedback.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {prepModules.map((module) => (
            <Card key={module.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {module.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                    <CardDescription>
                      {module.difficulty} • {module.duration}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {module.description}
                </p>
                
                <Button asChild className="w-full group">
                  <Link to={module.path}>
                    Start Practice
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle>Interview Success Tips</CardTitle>
            <CardDescription>
              Essential strategies for acing your data science interviews
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Technical Preparation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Review fundamental statistics and ML concepts</li>
                  <li>• Practice SQL queries and data manipulation</li>
                  <li>• Prepare portfolio projects to discuss</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Behavioral Preparation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use the STAR method for storytelling</li>
                  <li>• Prepare examples of problem-solving</li>
                  <li>• Research the company and role thoroughly</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InterviewPrep;
