
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
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

interface StudyGuide {
  id: string;
  created_at: string;
  competencies: {
    technical: string[];
    behavioral: string[];
  };
  questions: any[];
}

export default function InterviewPrep() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('job-description');
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);

  useEffect(() => {
    if (user) {
      console.log('Loading study guides for user:', user.id);
      loadStudyGuides();
    } else {
      // Set loading to false if no user is authenticated
      setLoading(false);
    }
  }, [user]);

  const loadStudyGuides = async () => {
    try {
      // Check if we have cached study guide in local storage
      if (user) {
        const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
        if (cachedStudyGuide) {
          console.log('Found study guide in local storage');
          setStudyGuides([cachedStudyGuide]);
          setLoading(false);
          return;
        }
      }

      // If no cached study guide or user not authenticated, try to load from database
      if (user && user.id) {
        console.log('Fetching study guides from Supabase for user:', user.id);
        const { data: guides, error } = await supabase
          .from('study_guides')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading study guides:', error);
          throw error;
        }

        console.log('Study guides loaded from database:', guides?.length || 0);
        setStudyGuides(guides || []);
        
        // Save the first study guide to local storage for future access
        if (guides && guides.length > 0 && user) {
          LocalStorageUtils.saveStudyGuide(user.id, guides[0]);
        }
      }
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
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Check if we have study guides in either local storage or database
  const hasStudyGuides = user && (
    (studyGuides && studyGuides.length > 0) || 
    (user && LocalStorageUtils.getStudyGuide(user.id))
  );

  return (
    <AppLayout>
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
                  {hasStudyGuides ? 'View Study Guide' : 'Analyze New Job Description'}
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
                <Button 
                  onClick={() => navigate('/interview-prep/star-practice')}
                  disabled={!hasStudyGuides}
                >
                  {hasStudyGuides ? 'Start STAR Practice' : 'Analyze Job Description First'}
                </Button>
                {!hasStudyGuides && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You need to analyze a job description first to get practice questions.
                  </p>
                )}
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
    </AppLayout>
  );
}
