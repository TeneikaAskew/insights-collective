import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Star, Code, Users } from 'lucide-react';

export default function InterviewPrep() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('job-description');
  const [studyGuides, setStudyGuides] = useState([]);

  useEffect(() => {
    loadStudyGuides();
  }, []);

  const loadStudyGuides = async () => {
    try {
      const { data: guides, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudyGuides(guides || []);
    } catch (error) {
      console.error('Error loading study guides:', error);
      toast({
        title: 'Error',
        description: 'Failed to load study guides.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Spinner size="lg" />
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
          Prepare for your interviews with our comprehensive tools and resources.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="job-description" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Job Description
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

        <TabsContent value="job-description">
          <Card>
            <CardHeader>
              <CardTitle>Job Description Analysis</CardTitle>
              <CardDescription>
                Analyze job descriptions to get personalized study guides and practice materials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/interview-prep/job-description')}>
                Analyze New Job Description
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="star-practice">
          <Card>
            <CardHeader>
              <CardTitle>STAR Response Practice</CardTitle>
              <CardDescription>
                Practice behavioral interview questions using the STAR method.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/interview-prep/star-practice')}>
                Start STAR Practice
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code-practice">
          <Card>
            <CardHeader>
              <CardTitle>Code Challenge Practice</CardTitle>
              <CardDescription>
                Practice technical coding challenges with real-time feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/interview-prep/code-practice')}>
                Start Code Practice
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mock-interviews">
          <Card>
            <CardHeader>
              <CardTitle>Mock Interviews</CardTitle>
              <CardDescription>
                Schedule and participate in mock interviews with peers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/interview-prep/mock-interviews')}>
                Schedule Mock Interview
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 