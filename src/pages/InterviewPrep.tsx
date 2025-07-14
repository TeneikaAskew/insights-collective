
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Star, Code, Users, CheckCircle, BarChart, Brain, Target } from 'lucide-react';
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
          <p className="text-muted-foreground text-lg">
            Prepare for your interviews with our comprehensive tools and resources designed to help you 
            stand out from other candidates and secure your dream job.
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-2xl font-bold">
                      <Briefcase className="h-6 w-6 mr-2" />
                      Job Description Analysis
                    </CardTitle>
                    <CardDescription className="text-base">
                      Analyze job descriptions to get personalized study guides and practice materials tailored to your target role.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-left">
                      <p className="mb-4">Our AI-powered job description analyzer helps you:</p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Identify key technical and behavioral competencies employers are looking for</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Generate personalized interview questions based on the specific role</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Create a focused study guide to prepare efficiently</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Highlight skills gaps to prioritize your interview preparation</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                      <h3 className="text-sm font-medium mb-2 flex items-center">
                        <Target className="h-4 w-4 mr-2" />
                        Success Story
                      </h3>
                      <p className="text-sm italic">
                        "By analyzing the job description, I discovered key requirements I had missed. The custom study guide helped me prepare specific examples that impressed the interviewer." — Maria S., Data Analyst
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/interview-prep/job-description')} 
                      className="w-full sm:w-auto mt-2"
                      size="lg"
                    >
                      {hasStudyGuides ? 'View Study Guide' : 'Analyze New Job Description'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-1">
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-100 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">Why This Matters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <BarChart className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">73% of successful candidates</p>
                        <p className="text-xs text-muted-foreground">Customize their preparation based on the specific job description</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Targeted preparation</p>
                        <p className="text-xs text-muted-foreground">Focuses your study time on what matters most to hiring managers</p>
                      </div>
                    </div>
                    
                    <div className="text-center mt-4">
                      <div className="inline-block rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-200">
                        Most popular feature
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="star-practice">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-2xl font-bold">
                      <Star className="h-6 w-6 mr-2" />
                      STAR Response Practice
                    </CardTitle>
                    <CardDescription className="text-base">
                      Master behavioral questions by practicing the Situation, Task, Action, Result (STAR) method with AI feedback.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-left">
                      <p className="mb-4">Our STAR Method practice tool helps you:</p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Structure your answers effectively with the proven STAR format</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Receive instant feedback on your responses from our AI coach</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Improve your storytelling ability to engage interviewers</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Build a library of polished responses to common questions</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                        <h3 className="text-sm font-medium mb-1">Before STAR Practice:</h3>
                        <p className="text-xs text-muted-foreground italic">
                          "I helped my team finish a project and it went well."
                        </p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-900/50">
                        <h3 className="text-sm font-medium mb-1 text-green-700 dark:text-green-400">After STAR Practice:</h3>
                        <p className="text-xs text-green-600 dark:text-green-300 italic">
                          "When our team faced a tight deadline (S), I was tasked with coordinating resources (T). I implemented a new project tracking system (A), which resulted in delivering 2 weeks early and saving $50K (R)."
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/interview-prep/star-practice')}
                      className="w-full sm:w-auto mt-2"
                      size="lg"
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
              </div>
              
              <div className="md:col-span-1">
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border-yellow-100 dark:border-yellow-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">Why This Matters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <BarChart className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">89% of hiring managers</p>
                        <p className="text-xs text-muted-foreground">Say behavioral questions reveal more about candidates than technical questions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">STAR method is proven</p>
                        <p className="text-xs text-muted-foreground">To help candidates deliver clear, concise, and compelling answers</p>
                      </div>
                    </div>
                    
                    <div className="text-center mt-4">
                      <div className="inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-3 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                        Highest improvement rate
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="code-practice">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-2xl font-bold">
                      <Code className="h-6 w-6 mr-2" />
                      Code Challenge Practice
                    </CardTitle>
                    <CardDescription className="text-base">
                      Strengthen your technical coding skills with real-time feedback and industry-relevant practice problems.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-left">
                      <p className="mb-4">Our code practice platform helps you:</p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Solve common technical interview challenges in a realistic environment</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Get detailed feedback on both correctness and code quality</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Learn optimal approaches through guided solutions</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Track your progress and identify areas for improvement</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                      <h3 className="text-sm font-medium mb-2 flex items-center">
                        <Target className="h-4 w-4 mr-2" />
                        Success Story
                      </h3>
                      <p className="text-sm italic">
                        "The code challenges were incredibly similar to what I faced in my actual interviews. After practicing here, I felt confident and passed the technical rounds at three top companies." — Alex K., Software Engineer
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/interview-prep/code-practice')} 
                      className="w-full sm:w-auto mt-2"
                      size="lg"
                    >
                      Start Code Practice
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-1">
                <Card className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-100 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">Why This Matters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <BarChart className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">94% of technical roles</p>
                        <p className="text-xs text-muted-foreground">Include at least one coding challenge in the interview process</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Regular practice</p>
                        <p className="text-xs text-muted-foreground">Is the most reliable predictor of success in technical interviews</p>
                      </div>
                    </div>
                    
                    <div className="text-center mt-4">
                      <div className="inline-block rounded-full bg-green-100 dark:bg-green-900/50 px-3 py-1 text-xs font-medium text-green-800 dark:text-green-200">
                        Includes real interview questions
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mock-interviews">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-2xl font-bold">
                      <Users className="h-6 w-6 mr-2" />
                      Mock Interviews
                    </CardTitle>
                    <CardDescription className="text-base">
                      Practice with peers in realistic interview simulations and receive structured feedback to improve.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-left">
                      <p className="mb-4">Our mock interview platform helps you:</p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Experience realistic interview conditions to reduce anxiety</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Get feedback from peers who understand the technical requirements</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Practice both as an interviewer and interviewee to gain perspective</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
                          <span>Improve your communication skills and ability to explain complex concepts</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                      <h3 className="text-sm font-medium mb-2 flex items-center">
                        <Target className="h-4 w-4 mr-2" />
                        User Experience
                      </h3>
                      <p className="text-sm italic">
                        "The feedback I received from my mock interview partner helped me identify verbal tics and knowledge gaps I wasn't aware of. This single change transformed my interview performance." — Jamie T., Data Scientist
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/interview-prep/mock-interviews')} 
                      className="w-full sm:w-auto mt-2"
                      size="lg"
                    >
                      Schedule Mock Interview
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-1">
                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-100 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">Why This Matters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <BarChart className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">65% improvement</p>
                        <p className="text-xs text-muted-foreground">In interview performance after just two mock interview sessions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Real-time pressure</p>
                        <p className="text-xs text-muted-foreground">Helps build the mental resilience needed for actual interviews</p>
                      </div>
                    </div>
                    
                    <div className="text-center mt-4">
                      <div className="inline-block rounded-full bg-purple-100 dark:bg-purple-900/50 px-3 py-1 text-xs font-medium text-purple-800 dark:text-purple-200">
                        Community favorite
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
