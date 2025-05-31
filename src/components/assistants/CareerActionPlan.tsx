
import React, { useState, useEffect } from 'react';
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
  Loader2,
  ArrowRightCircle,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '@/hooks/usePortfolio';

interface CourseData {
  title: string;
  provider: string;
  url?: string;
}

interface SkillData {
  name: string;
  courses: CourseData[];
}

interface ProjectData {
  title: string;
  description: string;
}

interface ContentData {
  platform: string;
  topics: string[];
}

interface ActionPlanTimeframe {
  skills: SkillData[];
  projects: ProjectData[];
  content: ContentData[];
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

const timeframeLabels: Record<keyof ActionPlan, string> = {
  "6_weeks": "6 Weeks",
  "9_weeks": "9 Weeks",
  "12_weeks": "12 Weeks",
  "6_months": "6 Months",
  "12_months": "12 Months"
};

interface CareerActionPlanProps {
  initialActionPlan?: ActionPlan | null;
}

// Helper function to validate action plan data
const isValidActionPlan = (plan: any): plan is ActionPlan => {
  if (!plan || typeof plan !== 'object') return false;
  
  // Check if at least one timeframe key exists
  const hasAnyTimeframe = ["6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"]
    .some(key => plan.hasOwnProperty(key));
  
  return hasAnyTimeframe;
};

// Helper to check if a timeframe is valid
const isValidTimeframe = (data: any): data is ActionPlanTimeframe => {
  return data && typeof data === 'object' &&
    (Array.isArray(data.skills) || Array.isArray(data.projects) || 
     Array.isArray(data.content) || Array.isArray(data.milestones));
};

const CareerActionPlan: React.FC<CareerActionPlanProps> = ({ initialActionPlan }) => {
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<keyof ActionPlan>("6_weeks");
  
  // Track added items to manage button states
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects } = usePortfolio();

  // Effect to update internal state when the prop changes
  useEffect(() => {
    console.log('CAP Debug: useEffect triggered. initialActionPlan:', initialActionPlan);
    if (isValidActionPlan(initialActionPlan)) {
      console.log('CAP Debug: Setting internal actionPlan state from initialActionPlan prop.');
      setActionPlan(initialActionPlan);
      // Ensure active timeframe is valid if the plan just loaded
      const validKeys = Object.keys(initialActionPlan).filter(key => 
        timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(initialActionPlan[key as keyof ActionPlan])
      ) as Array<keyof ActionPlan>;
      
      if (validKeys.length > 0) {
         // Set default tab only if the current one isn't valid or doesn't exist in the new plan
         if (!validKeys.includes(activeTimeframe) || !initialActionPlan[activeTimeframe]) {
             console.log(`CAP Debug: Setting active timeframe to default ${validKeys[0]}.`);
             setActiveTimeframe(validKeys[0]);
         }
      } else {
         console.warn("CAP Warn: initialActionPlan received but seems to have no valid timeframe keys.");
         setActionPlan(null); // Treat as no plan if keys are invalid
         setActiveTimeframe("6_weeks"); // Reset tab if plan becomes invalid
      }
    } else {
      console.log('CAP Debug: initialActionPlan is null or invalid, clearing internal state.');
      // If the prop becomes null/invalid, clear the internal state
      setActionPlan(null);
      setActiveTimeframe("6_weeks"); // Reset tab
    }
  }, [initialActionPlan]); // Depend only on the prop


  // Function to regenerate the action plan
  const regenerateActionPlan = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to regenerate your career action plan.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    console.log('CAP Debug: Starting regeneration...');

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-career-action-plan', {
        body: { userId: user.id }
      });

      console.log('CAP Debug: Regeneration API Response:', functionData);

      if (functionError) {
        console.error("CAP Error: Regeneration function invocation failed:", functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (functionData?.success && isValidActionPlan(functionData.data)) {
        const newPlan = functionData.data as ActionPlan;
        console.log('CAP Debug: Setting regenerated action plan:', newPlan);
        setActionPlan(newPlan); // Update internal state directly

        // Find the first valid timeframe key to set as active
        const validKeys = Object.keys(newPlan).filter(key => 
          timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(newPlan[key as keyof ActionPlan])
        ) as Array<keyof ActionPlan>;
        
        const defaultTimeframe = validKeys.length > 0 ? validKeys[0] : "6_weeks";
        setActiveTimeframe(defaultTimeframe);
        console.log('CAP Debug: Resetting active timeframe to:', defaultTimeframe);

        toast({
          title: "Action Plan Regenerated",
          description: "Your updated career action plan is ready!",
        });
      } else {
        console.error("CAP Error: Regeneration failed or returned invalid data.", functionData);
        throw new Error(functionData?.error || "Failed to generate a valid action plan.");
      }
    } catch (error) {
      console.error("CAP Error: Error in regenerateActionPlan:", error);
      toast({
        title: "Regeneration Failed",
        description: `We couldn't regenerate your action plan. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
        duration: 7000
      });
      // Do not clear the existing plan on failure, keep the old one
    } finally {
      setIsGenerating(false);
      console.log('CAP Debug: Regeneration finished.');
    }
  };

  // Function to add items to portfolio using direct Supabase call
  const handleAddToPortfolio = async (type: 'project' | 'content' | 'milestone', data: any, timeframe: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add items to your portfolio.",
        variant: "destructive"
      });
      return;
    }

    // Create unique identifier for this item
    const itemId = `${type}-${timeframe}-${typeof data === 'string' ? data : data.title}`;
    
    // Check if already added
    if (addedItems.has(itemId)) {
      return;
    }

    // Set loading state
    setLoadingItems(prev => new Set(prev).add(itemId));

    try {
      let projectData;
      
      switch(type) {
        case 'project':
          projectData = {
            user_id: user.id,
            title: data.title,
            description: data.description,
            required_skills: [],
            effort_level: 'Medium',
            status: 'Idea'
          };
          break;
        
        case 'content':
          projectData = {
            user_id: user.id,
            title: `Content: ${data.platform}`,
            description: `Create content about: ${data.topics.join(', ')}`,
            required_skills: data.topics,
            effort_level: 'Low',
            status: 'Idea'
          };
          break;
        
        case 'milestone':
          projectData = {
            user_id: user.id,
            title: `Milestone: ${data}`,
            description: `Career milestone to achieve: ${data}`,
            required_skills: [],
            effort_level: 'Medium',
            status: 'Idea'
          };
          break;
      }

      // Add project directly to Supabase
      const { data: insertedProject, error } = await supabase
        .from('portfolio_projects')
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;

      // Mark as added
      setAddedItems(prev => new Set(prev).add(itemId));

      toast({
        title: "Added to Portfolio",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} has been added to your portfolio tracker.`,
      });

      console.log('Successfully added to portfolio:', insertedProject);
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add item to portfolio. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Remove loading state
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handlePortfolioAction = () => {
    navigate('/portfolio-explorer');
  };

  // Helper function to get button state - checks both local state and existing portfolio projects
  const getButtonState = (type: 'project' | 'content' | 'milestone', data: any, timeframe: string) => {
    const itemId = `${type}-${timeframe}-${typeof data === 'string' ? data : data.title}`;
    const isLoading = loadingItems.has(itemId);
    const isLocallyAdded = addedItems.has(itemId);
    
    // Check if item already exists in portfolio projects
    let isAlreadyInPortfolio = false;
    if (projects && Array.isArray(projects)) {
      const itemTitle = typeof data === 'string' ? `${type.charAt(0).toUpperCase() + type.slice(1)}: ${data}` : 
                       type === 'content' ? `Content: ${data.platform}` : data.title;
      
      isAlreadyInPortfolio = projects.some(project => 
        project.title === itemTitle || 
        (project.title && itemTitle && project.title.toLowerCase().includes(itemTitle.toLowerCase()))
      );
    }
    
    const isAdded = isLocallyAdded || isAlreadyInPortfolio;
    
    return { itemId, isLoading, isAdded };
  };

  // Render generate button if no plan
  if (!actionPlan) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Personal Career Action Plan</CardTitle>
          <CardDescription>
            Your action plan is not available. You can try generating one or regenerating it if it failed previously.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Button
            onClick={regenerateActionPlan}
            disabled={isGenerating}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate / Regenerate Plan"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const validTimeframeKeys = Object.keys(actionPlan).filter(key =>
    timeframeLabels[key as keyof ActionPlan] && isValidTimeframe(actionPlan[key as keyof ActionPlan])
  ) as Array<keyof ActionPlan>;

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your Career Action Plan</CardTitle>
            <CardDescription>
              A personalized roadmap to help you achieve your career goals. Select a timeframe below.
            </CardDescription>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionPlan(null)}>
              Clear Plan
            </Button>
            <Button
              size="sm"
              onClick={regenerateActionPlan}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Plan"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTimeframe} onValueChange={(value) => setActiveTimeframe(value as keyof ActionPlan)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {validTimeframeKeys.map((key) => (
              <TabsTrigger key={key} value={key}>
                {timeframeLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>

          {validTimeframeKeys.map((timeframeKey) => {
            const timeframeData = actionPlan[timeframeKey];
            if (!isValidTimeframe(timeframeData)) return null;

            return (
              <TabsContent key={timeframeKey} value={timeframeKey} className="mt-6 space-y-6">
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h3 className="font-semibold text-lg mb-2">{timeframeLabels[timeframeKey]} Overview</h3>
                  <p className="italic text-muted-foreground">
                    {timeframeData.narrative || "No specific narrative provided for this period."}
                  </p>
                </div>

                <Accordion type="multiple" defaultValue={["skills", "projects", "content", "milestones"]}>
                  {/* Skills Section - No Portfolio Integration */}
                  <AccordionItem value="skills">
                    <AccordionTrigger>
                      <div className="flex items-center">
                        <GraduationCap className="mr-2 h-5 w-5 text-primary" />
                        Skills to Acquire
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-8 pt-2">
                        {Array.isArray(timeframeData.skills) && timeframeData.skills.length > 0 ? (
                          timeframeData.skills.map((skillItem, idx) => (
                            <div key={`skill-${timeframeKey}-${idx}`} className="space-y-2 pb-4 border-b border-border/30 last:border-b-0">
                              <div>
                                <h4 className="font-semibold text-primary/90">{skillItem.name}</h4>
                                {Array.isArray(skillItem.courses) && skillItem.courses.map((course, courseIdx) => (
                                  <div key={courseIdx} className="mt-1">
                                    <p className="text-sm">{course.title}</p>
                                    <p className="text-xs text-muted-foreground">{course.provider}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">No skills defined for this timeframe.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Projects Section */}
                  <AccordionItem value="projects">
                    <AccordionTrigger>
                      <div className="flex items-center">
                        <Briefcase className="mr-2 h-5 w-5 text-primary" />
                        Projects to Build
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-8 pt-2">
                        {Array.isArray(timeframeData.projects) && timeframeData.projects.length > 0 ? (
                          timeframeData.projects.map((project, idx) => {
                            const { isLoading, isAdded } = getButtonState('project', project, timeframeLabels[timeframeKey]);
                            
                            return (
                              <div key={`project-${timeframeKey}-${idx}`} className="flex justify-between items-start pb-4 border-b border-border/30 last:border-b-0">
                                <div>
                                  <h4 className="font-semibold">{project.title}</h4>
                                  <p className="text-sm text-muted-foreground">{project.description}</p>
                                </div>
                                <Button
                                  variant={isAdded ? "secondary" : "outline"}
                                  size="sm"
                                  disabled={isLoading || isAdded}
                                  onClick={() => handleAddToPortfolio('project', project, timeframeLabels[timeframeKey])}
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Adding...
                                    </>
                                  ) : isAdded ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      Added
                                    </>
                                  ) : (
                                    "Add to Portfolio"
                                  )}
                                </Button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground">No projects defined for this timeframe.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Content Section */}
                  <AccordionItem value="content">
                    <AccordionTrigger>
                      <div className="flex items-center">
                        <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                        Content to Share
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-8 pt-2">
                        {Array.isArray(timeframeData.content) && timeframeData.content.length > 0 ? (
                          timeframeData.content.map((contentItem, idx) => {
                            const { isLoading, isAdded } = getButtonState('content', contentItem, timeframeLabels[timeframeKey]);
                            
                            return (
                              <div key={`content-${timeframeKey}-${idx}`} className="flex justify-between items-start pb-4 border-b border-border/30 last:border-b-0">
                                <div>
                                  <h4 className="font-semibold">{contentItem.platform}</h4>
                                  <ul className="list-disc pl-5 mt-2">
                                    {contentItem.topics.map((topic, topicIdx) => (
                                      <li key={topicIdx} className="text-sm">{topic}</li>
                                    ))}
                                  </ul>
                                </div>
                                <Button
                                  variant={isAdded ? "secondary" : "outline"}
                                  size="sm"
                                  disabled={isLoading || isAdded}
                                  onClick={() => handleAddToPortfolio('content', contentItem, timeframeLabels[timeframeKey])}
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Adding...
                                    </>
                                  ) : isAdded ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      Added
                                    </>
                                  ) : (
                                    "Add to Portfolio"
                                  )}
                                </Button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground">No content sharing goals defined for this timeframe.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Milestones Section */}
                  <AccordionItem value="milestones">
                    <AccordionTrigger>
                      <div className="flex items-center">
                        <Target className="mr-2 h-5 w-5 text-primary" />
                        Milestones to Achieve
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-8 pt-2">
                        {Array.isArray(timeframeData.milestones) && timeframeData.milestones.length > 0 ? (
                          timeframeData.milestones.map((milestone, idx) => {
                            const { isLoading, isAdded } = getButtonState('milestone', milestone, timeframeLabels[timeframeKey]);
                            
                            return (
                              <div key={`milestone-${timeframeKey}-${idx}`} className="flex justify-between items-start pb-4 border-b border-border/30 last:border-b-0">
                                <p className="text-sm">{milestone}</p>
                                <Button
                                  variant={isAdded ? "secondary" : "outline"}
                                  size="sm"
                                  disabled={isLoading || isAdded}
                                  onClick={() => handleAddToPortfolio('milestone', milestone, timeframeLabels[timeframeKey])}
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Adding...
                                    </>
                                  ) : isAdded ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      Added
                                    </>
                                  ) : (
                                    "Add to Portfolio"
                                  )}
                                </Button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground">No milestones defined for this timeframe.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex justify-center pt-6">
                  <Button onClick={handlePortfolioAction} className="gap-2">
                    Go to Portfolio Explorer
                    <ArrowRightCircle className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CareerActionPlan;
