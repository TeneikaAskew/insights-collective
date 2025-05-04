
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  BookOpen, 
  Briefcase, 
  GraduationCap, 
  MessageSquare, 
  Target, 
  Calendar 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

const timeframeLabels = {
  "6_weeks": "6 Weeks",
  "9_weeks": "9 Weeks",
  "12_weeks": "12 Weeks",
  "6_months": "6 Months",
  "12_months": "12 Months"
};

const CareerActionPlan: React.FC = () => {
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<string>("6_weeks");
  const { toast } = useToast();
  const { user } = useAuth();

  // const generateActionPlan = async () => {
  //   if (!user) {
  //     toast({
  //       title: "Authentication Required",
  //       description: "Please log in to generate your career action plan.",
  //       variant: "destructive"
  //     });
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const { data, error } = await supabase.functions.invoke('generate-career-action-plan', {
  //       body: { userId: user.id }
  //     });

  //     // In your component where you fetch the data
  //     console.log('API Response:', data);
  //     console.log('Action Plan Data:', result.data);

  //     if (error) throw error;

  //     if (data?.success && data?.data) {
  //       console.log('Setting action plan:', data.data);
  //       setActionPlan(data.data);
  //       toast({
  //         title: "Action Plan Generated",
  //         description: "Your personalized career action plan is ready!",
  //       });
  //     } else {
  //       throw new Error("Failed to generate action plan");
  //     }
  //   } catch (error) {
  //     console.error("Error generating action plan:", error);
  //     toast({
  //       title: "Generation Failed",
  //       description: "We couldn't generate your action plan. Please try again later.",
  //       variant: "destructive"
  //     });
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };
    const generateActionPlan = async () => {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to generate your career action plan.",
          variant: "destructive"
        });
        return;
      }
    
      setIsLoading(true);
      try {
        // First, check if an action plan already exists
        const { data: existingPlans, error: fetchError } = await supabase
          .from('career_pathway_results')
          .select('action_plan')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
    
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw fetchError;
        }
    
        // If we have an existing plan, use it
        if (existingPlans?.action_plan) {
          console.log('Using existing action plan:', existingPlans.action_plan);
          setActionPlan(existingPlans.action_plan);
          toast({
            title: "Action Plan Loaded",
            description: "Your existing career action plan has been loaded.",
          });
          return;
        }
    
        // Otherwise generate a new one
        const { data, error } = await supabase.functions.invoke('generate-career-action-plan', {
          body: { userId: user.id }
        });
    
        // Add debugging logs
        console.log('API Response:', data);
        
        if (error) throw error;
    
        if (data?.success && data?.data) {
          console.log('Setting action plan:', data.data);
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
        setIsLoading(false);
      }
    };
  if (!actionPlan) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Personal Career Action Plan</CardTitle>
          <CardDescription>
            Generate a customized career action plan based on your resume and career assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Button 
            onClick={generateActionPlan} 
            disabled={isLoading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
                Generating...
              </>
            ) : (
              "Generate My Action Plan"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentTimeframeData = actionPlan[timeframeKey as keyof ActionPlan] //actionPlan[activeTimeframe as keyof ActionPlan];

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Your Career Action Plan</CardTitle>
        <CardDescription>
          A personalized roadmap to help you achieve your career goals
        </CardDescription>
        <Tabs value={activeTimeframe} onValueChange={setActiveTimeframe}>
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(timeframeLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        {Object.entries(timeframeLabels).map(([timeframeKey, timeframeLabel]) => (
          <TabsContent key={timeframeKey} value={timeframeKey} className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg border">
              <p className="italic text-muted-foreground">
                {actionPlan[timeframeKey as keyof ActionPlan]?.narrative || 
                  "In this timeframe, focus on building your foundation and making initial progress toward your career goals."}
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="skills">
                <AccordionTrigger className="py-3">
                  <div className="flex items-center">
                    <GraduationCap className="mr-2 h-5 w-5 text-primary" />
                    <span>Skills to Acquire</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-7">
                    {currentTimeframeData?.skills?.map((skillItem, idx) => (
                      <div key={idx} className="space-y-2">
                        <h4 className="font-medium">{skillItem.name}</h4>
                        <ul className="space-y-1">
                          {skillItem.courses?.map((course, courseIdx) => (
                            <li key={courseIdx} className="text-sm pl-4 border-l-2 border-primary/30">
                              <span className="font-medium">{course.title}</span>
                              {course.provider && (
                                <span className="text-muted-foreground ml-1">
                                  by {course.provider}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="projects">
                <AccordionTrigger className="py-3">
                  <div className="flex items-center">
                    <Briefcase className="mr-2 h-5 w-5 text-primary" />
                    <span>Projects to Build</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-7">
                    {currentTimeframeData?.projects?.map((project, idx) => (
                      <div key={idx} className="space-y-1">
                        <h4 className="font-medium">{project.title}</h4>
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content">
                <AccordionTrigger className="py-3">
                  <div className="flex items-center">
                    <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                    <span>Content to Share</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-7">
                    {currentTimeframeData?.content?.map((contentItem, idx) => (
                      <div key={idx} className="space-y-1">
                        <h4 className="font-medium">{contentItem.platform}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {contentItem.topics?.map((topic, topicIdx) => (
                            <li key={topicIdx} className="text-sm">{topic}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="milestones">
                <AccordionTrigger className="py-3">
                  <div className="flex items-center">
                    <Target className="mr-2 h-5 w-5 text-primary" />
                    <span>Milestones to Achieve</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-7">
                    <ul className="list-disc pl-5 space-y-2">
                      {currentTimeframeData?.milestones?.map((milestone, idx) => (
                        <li key={idx} className="text-sm">{milestone}</li>
                      ))}
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setActionPlan(null)} className="mr-2">
                Reset
              </Button>
              <Button size="sm" onClick={generateActionPlan} disabled={isLoading}>
                {isLoading ? "Regenerating..." : "Regenerate Plan"}
              </Button>
            </div>
          </TabsContent>
        ))}
      </CardContent>
    </Card>
  );
};

export default CareerActionPlan;
