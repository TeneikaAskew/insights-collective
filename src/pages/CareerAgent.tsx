
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Lightbulb, TrendingUp, Users, DollarSign } from 'lucide-react';

const CareerAgent = () => {
  // Initialize page onboarding
  usePageOnboarding({ 
    tourId: 'career-agent', 
    autoStart: true,
    dependencies: ['interview-prep'] // Start after interview prep tour
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Career Agent"
          description="Get personalized AI-powered career guidance for your data career journey."
          pageTourId="career-agent"
        />
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card data-tour="agent-chat">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Chat with Your Career Agent
                </CardTitle>
                <CardDescription>
                  Ask questions about your data career path, skills, or industry trends
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-4 min-h-[400px] bg-gray-50">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm max-w-[80%]">
                      <p>Hi! I'm your AI Career Agent. I'm here to help you navigate your data career journey. What would you like to know about?</p>
                    </div>
                  </div>
                  <div className="text-center text-gray-500 py-8">
                    Start a conversation by typing your question below
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Input placeholder="Ask about career transitions, skills, salary, or anything else..." className="flex-1" />
                  <Button>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card data-tour="advice-examples">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Ask Me About
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start text-left h-auto p-3">
                  <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-sm">Career transition from business analyst to data scientist</span>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-auto p-3">
                  <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-sm">Salary negotiation for data roles</span>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-auto p-3">
                  <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-sm">Building a professional network in data</span>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-auto p-3">
                  <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-sm">Essential skills for machine learning engineers</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Conversations</CardTitle>
                <CardDescription>Your latest career guidance sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Bot className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start chatting to see your history here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
