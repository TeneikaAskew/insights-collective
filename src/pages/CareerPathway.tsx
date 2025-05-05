import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Briefcase, 
  BookOpen, 
  Users, 
  FileText, 
  TrendingUp, 
  Star, 
  Award, 
  CheckCircle, 
  User, 
  Play,
  Loader2,
  GraduationCap
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import CareerAIRecommendations from '@/components/career/CareerAIRecommendations';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Helmet } from 'react-helmet-async';
import CareerActionPlan from '@/components/assistants/CareerActionPlan';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ActionPlanTimeframe {
  skills: Array<{
    name: string;
    courses: Array<{
      title: string;
      provider: string;
      url?: string;
    }>;
  }>;
  projects: Array<{
    title: string;
    description: string;
  }>;
  content: Array<{
    platform: string;
    topics: string[];
  }>;
  milestones: string[];
  narrative: string;
}

interface ActionPlan {
  "6_weeks": ActionPlanTimeframe;
  "9_weeks": ActionPlanTimeframe;
  "12_weeks": ActionPlanTimeframe;
  "6_months": ActionPlanTimeframe;
  "12_months": ActionPlanTimeframe;
}

const CareerPathway: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, error, isError } = useCareerPathwayResults();
  const [activeCareerStep, setActiveCareerStep] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<string>("6_weeks");
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const { toast } = useToast();

  const timeframeLabels = {
    "6_weeks": "6 Weeks",
    "9_weeks": "9 Weeks",
    "12_weeks": "12 Weeks",
    "6_months": "6 Months",
    "12_months": "12 Months"
  };

  useEffect(() => {
    console.log("Career pathway report data:", data);
    // Set the action plan from the data if it exists
    if (data?.actionPlan) {
      setActionPlan(data.actionPlan);
    }
  }, [data]);

  // Get user name from available properties
  const userName = (user as any)?.first_name || 
                  (user as any)?.user_metadata?.first_name || 
                  user?.email?.split('@')[0] || 
                  'there';
                
  // Career step carousel navigation
  const nextCareerStep = () => {
    if (data?.report?.careerPathSteps && activeCareerStep < data.report.careerPathSteps.length - 1) {
      setActiveCareerStep(activeCareerStep + 1);
    }
  };

  const prevCareerStep = () => {
    if (activeCareerStep > 0) {
      setActiveCareerStep(activeCareerStep - 1);
    }
  };

  // Generate action plan
  const generateActionPlan = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate your career action plan.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-career-action-plan', {
        body: { userId: user.id }
      });

      if (error) {
        console.error("Error invoking function:", error);
        throw error;
      }

      if (data?.success && data?.data) {
        setActionPlan(data.data);
        toast({
          title: "Action Plan Generated",
          description: "Your personalized career action plan is ready!",
        });
      } else {
        throw new Error("Failed to generate action plan");
      }
    } catch (error) {
      console.error("Error generating action plan:", error);
      toast({
        title: "Generation Failed",
        description: "We couldn't generate your action plan. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  // If there's an error or no report data found
  if (isError || (data?.report && data.report.skillsAndCourses && data.report.skillsAndCourses.length === 0)) {
    return (
      <AppLayout>
        <Helmet>
          <title>Career Pathway | Insights Collective</title>
          <meta name="description" content="Get personalized career path recommendations based on your skills and interests" />
        </Helmet>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="container mx-auto py-16 px-4"
        >
          <Card className="max-w-3xl mx-auto overflow-hidden">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 z-0" />
              <CardContent className="relative z-10 p-8 text-center">
                <Users className="h-16 w-16 mb-6 mx-auto text-primary" />
                <h2 className="text-3xl font-bold mb-4">Discover Your Ideal Career Path</h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                  Answer a few questions about your skills, experience, and career goals to receive personalized guidance tailored just for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg"
                    onClick={() => navigate('/career-agent')}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Career Assessment
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => navigate('/explore-data-careers')}
                  >
                    Browse Data Careers
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>Your Career Pathway | Insights Collective</title>
        <meta name="description" content="Your personalized career path recommendations based on your skills and interests" />
      </Helmet>
      
      <div className="container mx-auto py-8 px-4 space-y-8 max-w-6xl">
        {/* Hero Section */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          className="text-center space-y-6 mb-12"
        >
          <div className="h-24 w-24 mx-auto bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center mb-6">
            <Users className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            Hey {userName}, here's your career insights.
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            Based on your assessment, we've created personalized recommendations to help you build a fulfilling career path aligned with your strengths and goals.
          </p>
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          className="mb-8"
        >
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white">Overview</TabsTrigger>
              <TabsTrigger value="skills" className="data-[state=active]:bg-primary data-[state=active]:text-white">Skills</TabsTrigger>
              <TabsTrigger value="roles" className="data-[state=active]:bg-primary data-[state=active]:text-white">Roles</TabsTrigger>
              <TabsTrigger value="pathway" className="data-[state=active]:bg-primary data-[state=active]:text-white">Pathway</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.2 }}
                className="space-y-8"
              >
                {/* Summary Card */}
                <Card className="overflow-hidden border-t-4 border-t-primary">
                  <CardHeader className="bg-primary/5 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Your Career Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-4">
                    {isLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <p className="text-gray-700 leading-relaxed text-lg">
                        {data?.report?.summary || 'Loading your personalized career insights...'}
                      </p>
                    )}
                  </CardContent>
                </Card>
                
                {/* Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <Star className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Top Career Match</h3>
                        <p className="text-2xl font-bold">{data?.report?.recommendedRoles?.[0]?.title || 'Data Analyst'}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="bg-amber-100 p-3 rounded-full">
                        <TrendingUp className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Growth Potential</h3>
                        <p className="text-2xl font-bold">High</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="bg-green-100 p-3 rounded-full">
                        <Award className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Skill Alignment</h3>
                        <p className="text-2xl font-bold">76%</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Key Skills Preview */}
                <Card>
                  <CardHeader className="bg-primary/5 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Key Skills to Develop
                    </CardTitle>
                    <CardDescription>
                      These skills will help you advance in your career journey
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {isLoading ? (
                        <SkillsSkeleton />
                      ) : (
                        (data?.report?.skillsAndCourses || []).slice(0, 4).map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                              <BookOpen className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{item.skill}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={item.level === 'beginner' ? 30 : item.level === 'intermediate' ? 60 : 90} className="h-2" />
                                <span className="text-xs text-muted-foreground">{item.level || 'intermediate'}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <Button 
                      variant="link" 
                      className="mt-4"
                      onClick={() => setActiveTab('skills')}
                    >
                      View all recommended skills
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            {/* Skills Tab */}
            <TabsContent value="skills">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card>
                  <CardHeader className="bg-primary/5 pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          Recommended Skills
                        </CardTitle>
                        <CardDescription>
                          These recommendations are based on current market trends, your existing skill set, and the requirements of your desired roles.
                        </CardDescription>
                      </div>
                      <div className="hidden md:block h-24 w-24 flex-shrink-0">
                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                      <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 font-semibold border-b">
                        <div className="col-span-4">Skill</div>
                        <div className="col-span-4 md:col-span-5">Recommended Course</div>
                        <div className="hidden md:block md:col-span-3">Level</div>
                      </div>
                      {isLoading ? (
                        <SkillsSkeleton />
                      ) : data?.report?.skillsAndCourses?.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-4 p-4 border-b hover:bg-gray-50 transition-colors">
                          <div className="col-span-4 flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-gray-600" />
                            <div>
                              <div className="font-medium">{item.skill}</div>
                              <div className="md:hidden">
                                <Badge variant="secondary" className="mt-1">{item.level || 'intermediate'}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-8 md:col-span-5 text-gray-600 flex items-center">{item.course}</div>
                          <div className="hidden md:flex md:col-span-3 items-center">
                            <div className="w-full">
                              <div className="flex justify-between mb-1 text-xs">
                                <span>{item.level || 'Intermediate'}</span>
                                <span>{item.level === 'beginner' ? '30%' : item.level === 'intermediate' ? '60%' : '90%'}</span>
                              </div>
                              <Progress value={item.level === 'beginner' ? 30 : item.level === 'intermediate' ? 60 : 90} className="h-2" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-primary/5 p-4">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Export Skills List
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </TabsContent>
            
            {/* Roles Tab */}
            <TabsContent value="roles">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] p-8 rounded-lg"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Briefcase className="h-6 w-6 text-primary" />
                      Roles that match your profile
                    </h2>
                    <p className="text-gray-600">
                      These roles are suggested based on your transferable skills and interests—options that align with your career goals.
                    </p>
                  </div>
                  <div className="hidden md:block h-24 w-24 flex-shrink-0">
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-12 w-12 text-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {isLoading ? (
                    <AlternativeRolesSkeleton />
                  ) : data?.report?.recommendedRoles?.map((role, index) => (
                    <Card key={index} className="bg-white border-l-4 border-l-primary overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-6 flex items-start gap-4">
                          <div className="bg-primary/10 p-3 rounded-full">
                            <Briefcase className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-xl text-gray-900">{role.title}</h3>
                            <div className="flex items-center gap-3 mt-1 mb-3">
                              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                {role.salaryRange || '$80-120K'}
                              </Badge>
                              <span className="text-sm text-muted-foreground">Match: {90 - index * 5}%</span>
                            </div>
                            <p className="text-gray-600">{role.description}</p>
                            
                            <div className="mt-4 flex flex-wrap gap-2">
                              {['SQL', 'Python', 'Data Visualization', 'Communication'].map((skill) => (
                                <Badge key={skill} variant="outline">{skill}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Button 
                              onClick={() => navigate(`/explore-data-careers?role=${encodeURIComponent(role.title.toLowerCase().replace(/\s+/g, '-'))}`)}
                              variant="outline"
                              size="sm"
                            >
                              Explore
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-8 flex justify-center">
                  <Button onClick={() => navigate('/explore-data-careers')}>
                    Explore All Data Careers
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            </TabsContent>
            
            {/* Career Path Tab */}
            <TabsContent value="pathway">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Path to your aspirational role
                  </h2>
                  <p className="text-gray-600">
                    We created a clear path to your dream role—with a simple, step-by-step plan to bring you closer to your ultimate professional future.
                  </p>
                </div>

                <div className="relative bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center overflow-hidden">
                    <div className="p-6 w-32 flex-shrink-0 border-r">
                      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <User className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm text-center mt-2 text-gray-600">Current Position</p>
                    </div>

                    <div className="flex items-center flex-grow overflow-x-auto p-6 relative">
                      {/* Career path timeline line */}
                      <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
                      
                      {isLoading ? (
                        <CareerPathSkeleton />
                      ) : (
                        data?.report?.careerPathSteps?.map((step, index) => (
                          <div 
                            key={index}
                            className={`relative flex-shrink-0 w-64 px-4 transition-all duration-300 z-10 ${
                              index === activeCareerStep ? 'scale-105' : 'scale-95 opacity-75'
                            }`}
                          >
                            <Card className={`${index === activeCareerStep ? 'bg-blue-50 border-blue-200 shadow-lg' : 'bg-white'} relative`}>
                              {/* Step number marker */}
                              <div className="absolute top-0 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center font-medium">
                                {index + 1}
                              </div>
                              
                              <CardContent className="p-6 pt-8">
                                <h3 className="font-bold text-xl text-center text-gray-900">{step.title}</h3>
                                <p className="text-primary text-sm mb-4 font-medium text-center">
                                  1-2 years
                                </p>
                                <p className="text-gray-600 text-sm">{step.description}</p>
                                
                                <div className="mt-4 pt-4 border-t">
                                  <h4 className="font-medium text-sm mb-2">Focus areas:</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {['Technical skills', 'Domain knowledge', 'Communication'].map((area) => (
                                      <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 p-4 border-t">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={prevCareerStep}
                      disabled={activeCareerStep === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={nextCareerStep}
                      disabled={!data?.report?.careerPathSteps || activeCareerStep === data.report.careerPathSteps.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {data?.report?.careerPathSteps && data.report.careerPathSteps.length > 0 && (
                  <Card className="bg-white mt-8">
                    <CardHeader className="bg-primary/5 pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Action Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <p className="text-gray-700">
                        Your next career steps should build upon your current foundation while steering towards your aspirational role. 
                        Initially, advancing from your current position to {data.report.careerPathSteps[0].title} can help bridge the gap 
                        between your current expertise and desired career path.
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <p>Complete the recommended skill courses to strengthen your technical foundation</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <p>Build projects showcasing the skills relevant to your target role</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <p>Network with professionals in your desired field to gain insights and connections</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <p>Update your resume and LinkedIn profile to highlight relevant experience</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-primary/5 border-t p-4">
                      <Button onClick={generateActionPlan} disabled={isGeneratingPlan}>
                        {isGeneratingPlan ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate Detailed Action Plan"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                )}

                {/* Display the Action Plan component */}
                <CareerActionPlan initialActionPlan={data?.actionPlan} />
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Feedback / Recommendations Section */}
        <motion.div initial="initial" animate="animate" variants={fadeInUp} className="mt-8">
          <CareerAIRecommendations
            careerPath={data.report.recommendedRoles[0]?.title}
            userSkills={userSkills}
          />
        </motion.div>
      </>
    ) : (
      <div className="text-center py-12 space-y-6">
        <h2 className="text-3xl font-bold">No Career Assessment Results Yet</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Take our career assessment quiz to get personalized career pathway recommendations,
          skill development guidance, and a customized learning path.
        </p>
        <Button onClick={handleTakeQuiz} size="lg">
          Take Career Assessment <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
    
        {/* Show AI recommendations even without assessment */}
        <div className="pt-12">
          <CareerAIRecommendations />
    
          {/* Feedback Buttons */}
          <motion.div initial="initial" animate="animate" variants={fadeInUp} className="text-center space-y-4 mt-12">
            <p className="text-gray-600">Was this information useful?</p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" className="px-8">Yes</Button>
              <Button variant="outline" className="px-8">No</Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

// Skeleton components
const SkillsSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b">
        <div className="col-span-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="col-span-8 md:col-span-5">
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="hidden md:block md:col-span-3">
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    ))}
  </>
);

const CareerPathSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex-shrink-0 w-64 px-4">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    ))}
  </>
);

const AlternativeRolesSkeleton = () => (
  <>
    {[1, 2, 3].map((i) => (
      <Card key={i} className="bg-white">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </>
);

export default CareerPathway;