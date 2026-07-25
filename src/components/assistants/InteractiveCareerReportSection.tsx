import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Award, 
  Briefcase, 
  GraduationCap, 
  ArrowRightCircle, 
  LineChart, 
  ChevronRight, 
  User,
  BookOpen,
  Compass
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { useCareerCoach } from '@/hooks/useCareerCoach';
import { usePortfolio } from '@/hooks/usePortfolio';
import CareerActionPlan from './CareerActionPlan';
import { CareerReportData } from './utils/types';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('handleTakeQuiz');

// NOTE: the fabricated sample report (a fake person with invented match
// scores) was removed — this component now renders nothing without real data.

interface InteractiveCareerReportSectionProps {
  reportData?: CareerReportData;
}

const InteractiveCareerReportSection: React.FC<InteractiveCareerReportSectionProps> = ({
  reportData
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  const navigate = useNavigate();
  const { initiateCareerCoachChat } = useCareerCoach();
  const { addProject } = usePortfolio();
  const { toast } = useToast();

  const handleTakeQuiz = () => {
    navigate('/#quiz-section');
  };

  const startCareerChat = () => {
    initiateCareerCoachChat({}, {
      "AI/ML": 0,
      Analytics: 0,
      "Data Engineering": 0,
      "Business Intelligence": 0
    });
  };

  const handleExploreRole = (roleTitle: string) => {
    // Convert role title to URL-friendly format and navigate
    const roleSlug = roleTitle.toLowerCase().replace(/\s+/g, '-');
    navigate(`/explore-data-careers?role=${roleSlug}`);
  };

  const handleAddToPortfolio = async (type: 'milestone' | 'content' | 'project', item: any) => {
    try {
      let projectData;
      
      switch(type) {
        case 'milestone':
          projectData = {
            title: `Career Milestone: ${item}`,
            description: `Career pathway milestone: ${item}`,
            required_skills: [],
            effort_level: 'Medium',
            status: 'Idea'
          };
          break;
        
        case 'content':
          projectData = {
            title: `Content Creation: ${item.platform}`,
            description: `Create content about: ${item.topics.join(', ')}`,
            required_skills: item.topics,
            effort_level: 'Low',
            status: 'Idea'
          };
          break;
        
        case 'project':
          projectData = {
            title: item.title,
            description: item.description,
            required_skills: [],
            effort_level: 'Medium',
            status: 'Idea'
          };
          break;
      }

      await addProject.mutateAsync(projectData);
      
      toast({
        title: "Added to Portfolio",
        description: "Item has been added to your portfolio projects.",
      });
    } catch (error) {
      logger.error('Error adding to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add item to portfolio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePortfolioAction = () => {
    // If no portfolio data exists, navigate to portfolio explorer
    navigate('/portfolio-explorer');
  };

  // Without a real report there is nothing truthful to show.
  if (!reportData) {
    return null;
  }

  return (
    <Card className="w-full mt-6 shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl sm:text-2xl text-primary">
              Personalized Career Pathway Report
            </CardTitle>
            <CardDescription className="mt-1">
              For {reportData.userName}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTakeQuiz}>
              Retake Quiz
            </Button>
            <Button size="sm" onClick={startCareerChat}>
              Chat with Coach
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/40 p-0">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="roles" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Recommended Roles
            </TabsTrigger>
            <TabsTrigger 
              value="skills" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Skills & Learning
            </TabsTrigger>
            <TabsTrigger 
              value="career-path" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Career Path
            </TabsTrigger>
            <TabsTrigger 
              value="action-plan" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Action Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium flex items-center">
                  <User className="mr-2 h-5 w-5 text-primary" />
                  Summary
                </h3>
                <p className="text-muted-foreground">{reportData.summary}</p>
              </div>

              {reportData.recommendedRoles && reportData.recommendedRoles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium flex items-center">
                    <Award className="mr-2 h-5 w-5 text-primary" />
                    Top Career Match
                  </h3>
                  <div className="p-4 rounded-lg border border-primary/40 bg-primary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-primary">
                          {reportData.recommendedRoles[0].title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {reportData.recommendedRoles[0].description}
                        </p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-primary">
                          {reportData.recommendedRoles[0].matchPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">Match Score</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4" 
                      size="sm"
                      onClick={() => handleExploreRole(reportData.recommendedRoles[0].title)}
                    >
                      Explore This Career
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-medium flex items-center">
                  <BookOpen className="mr-2 h-5 w-5 text-primary" />
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {reportData.keyTakeaways.map((takeaway, index) => (
                    <li key={index} className="flex">
                      <ChevronRight className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 flex justify-center">
                <Button variant="outline" onClick={() => setActiveTab('roles')}>
                  See All Recommended Roles <ArrowRightCircle className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="p-6">
            <div className="space-y-6">
              <h3 className="text-lg font-medium flex items-center">
                <Briefcase className="mr-2 h-5 w-5 text-primary" />
                Recommended Roles Based on Your Profile
              </h3>
              
              <div className="grid gap-4 md:grid-cols-3">
                {reportData.recommendedRoles.map((role, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      index === 0 ? 'border-primary/50 bg-primary/5' : 'border-muted'
                    }`}
                  >
                    <div className="mb-3">
                      <h4 className="font-medium">{role.title}</h4>
                      <div className="mt-2 mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Match Score</span>
                          <span className="font-medium">{role.matchPercentage}%</span>
                        </div>
                        <Progress value={role.matchPercentage} className="h-2" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {role.description}
                    </p>
                    <div className="text-sm text-muted-foreground mb-3">
                      Salary Range: <span className="font-medium text-foreground">{role.salaryRange}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-between"
                      onClick={() => handleExploreRole(role.title)}
                    >
                      Explore Role <ArrowRightCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Accordion type="single" collapsible className="mt-6">
                <AccordionItem value="other-roles">
                  <AccordionTrigger className="text-primary">
                    Other Roles That Might Be Right for You
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 p-2">
                      {reportData.potentialRoles.map((role, index) => (
                        <div key={index} className="flex justify-between items-center p-2 rounded hover:bg-muted">
                          <span>{role}</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleExploreRole(role)}
                          >
                            <ArrowRightCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="p-6">
            <div className="space-y-6">
              <h3 className="text-lg font-medium flex items-center">
                <GraduationCap className="mr-2 h-5 w-5 text-primary" />
                Skills & Recommended Courses
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-medium">Skill</th>
                      <th className="text-left p-3 font-medium">Recommended Course</th>
                      <th className="text-left p-3 font-medium">Provider</th>
                      <th className="text-left p-3 font-medium">Level</th>
                      <th className="text-left p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.skillsAndCourses.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.skill}</td>
                        <td className="p-3">{item.course}</td>
                        <td className="p-3">{item.provider}</td>
                        <td className="p-3">
                          <span className={`
                            px-2 py-1 text-xs rounded-full
                            ${item.level === 'Beginner' ? 'bg-green-100 text-green-800' : 
                              item.level === 'Intermediate' ? 'bg-blue-100 text-blue-800' : 
                              'bg-purple-100 text-purple-800'}
                          `}>
                            {item.level}
                          </span>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-muted/20 p-4 rounded-lg border">
                <h4 className="font-medium">Course Recommendations Methodology</h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Our course recommendations are based on your existing skills, career goals, and the requirements 
                  of your recommended roles. Completing these courses will help strengthen your candidacy for these positions.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="career-path" className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium flex items-center">
                  <LineChart className="mr-2 h-5 w-5 text-primary" />
                  Your Career Path
                </h3>
                <p className="text-muted-foreground mt-1">
                  {reportData.nextStepRecommendations}
                </p>
              </div>
              
              <div className="relative">
                <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-primary/30"></div>
                
                <div className="space-y-8 relative">
                  {reportData.careerPathSteps.map((step, index) => (
                    <div key={index} className="ml-10 relative">
                      <div className="absolute -left-12 top-1 h-7 w-7 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      
                      <div className="p-4 rounded-lg border border-muted bg-muted/10">
                        <h4 className="font-medium">{step.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                        {step.timeframe && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Estimated time: {step.timeframe}
                          </div>
                        )}
                        <div className="mt-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAddToPortfolio('milestone', step.description)}
                          >
                            Add to Portfolio
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-lg">Take Action on Your Plan</CardTitle>
                  <CardDescription>
                    Start working on your career development by adding these items to your portfolio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">Suggested Projects</h4>
                      <div className="space-y-2">
                        {reportData.careerPathSteps.map((step, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg border">
                            <div className="flex-1">
                              <p className="font-medium">{step.title}</p>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAddToPortfolio('project', {
                                title: step.title,
                                description: step.description
                              })}
                            >
                              Add to Portfolio
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="text-center pt-4">
                      <Button onClick={handlePortfolioAction}>
                        Go to Portfolio Explorer
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Plan and track your career development projects
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center pt-6">
                <Button onClick={startCareerChat}>
                  Get Personalized Career Advice
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Chat with our career coach for customized guidance on your journey
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="action-plan" className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium flex items-center">
                  <Compass className="mr-2 h-5 w-5 text-primary" />
                  Your Personalized Action Plan
                </h3>
                <p className="text-muted-foreground mt-1">
                  Get a detailed roadmap with specific actions to take for your career advancement
                </p>
              </div>
              
              <CareerActionPlan />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InteractiveCareerReportSection;
