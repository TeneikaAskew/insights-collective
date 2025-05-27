
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare, Brain, Code, BarChart } from 'lucide-react';

const Assistants = () => {
  const assistants = [
    {
      id: 1,
      name: "Data Science Tutor",
      description: "Get help with statistics, machine learning, and data analysis concepts",
      icon: <Brain className="h-6 w-6" />,
      specialty: "Statistics & ML",
      available: true
    },
    {
      id: 2,
      name: "Code Reviewer",
      description: "Review your Python, R, and SQL code for best practices and optimization",
      icon: <Code className="h-6 w-6" />,
      specialty: "Code Review",
      available: true
    },
    {
      id: 3,
      name: "Career Advisor",
      description: "Guidance on career paths, resume reviews, and interview preparation",
      icon: <MessageSquare className="h-6 w-6" />,
      specialty: "Career Guidance",
      available: false
    },
    {
      id: 4,
      name: "Analytics Expert",
      description: "Help with data visualization, business intelligence, and reporting",
      icon: <BarChart className="h-6 w-6" />,
      specialty: "Analytics & BI",
      available: true
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">AI Assistants</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Get instant help from specialized AI assistants trained in different areas of data science and career development.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {assistants.map((assistant) => (
            <Card key={assistant.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {assistant.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{assistant.name}</CardTitle>
                    <CardDescription>
                      {assistant.specialty}
                    </CardDescription>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${assistant.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {assistant.description}
                </p>
                
                <Button 
                  className="w-full" 
                  disabled={!assistant.available}
                  variant={assistant.available ? "default" : "secondary"}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  {assistant.available ? 'Start Chat' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle>How to Use AI Assistants</CardTitle>
            <CardDescription>
              Tips for getting the most out of your AI assistant interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Be Specific</h4>
                <p className="text-sm text-muted-foreground">
                  Provide clear context and specific questions for better responses.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Share Code</h4>
                <p className="text-sm text-muted-foreground">
                  Include code snippets when asking for help with programming issues.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Follow Up</h4>
                <p className="text-sm text-muted-foreground">
                  Ask follow-up questions to dive deeper into topics.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Provide Feedback</h4>
                <p className="text-sm text-muted-foreground">
                  Rate responses to help improve the assistant's performance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Assistants;
