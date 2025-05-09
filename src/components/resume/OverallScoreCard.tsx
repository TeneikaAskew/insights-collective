import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Download, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Get user ID if authenticated - keep this outside component to avoid execution during render
const getUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
};

interface OverallScoreCardProps {
  letterGrade: string;
  resumePercent: number;
  elevatorPitch: string;
  themes: string[];
  explanation: string;
  onStartCareerChat: () => void;
  hasAnalysis?: boolean;
  userId?: string;
}

const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
  letterGrade,
  resumePercent,
  elevatorPitch,
  themes,
  explanation,
  onStartCareerChat,
  hasAnalysis = false,
  userId
}) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const [hasBeenClicked, setHasBeenClicked] = useState(false);
  const [hasRoast, setHasRoast] = useState(false);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [completedItems, setCompletedItems] = useState<boolean[]>([]);
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for roast (keep existing functionality)
  useEffect(() => {
    console.log("Checking if roast exists yet for: ", userId);
    if (userId) {
      const checkForRoast = async () => {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('initial_assessment')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log("user: ", userId, " - Roast data", data);
            
          if (!error && data?.initial_assessment) {
            setHasRoast(true);
          }
        } catch (error) {
          console.error("Error checking for roast:", error);
        }
      };
      
      checkForRoast();
    }
  }, [userId]);

  // Generate action items based on themes
  useEffect(() => {
    if (themes && themes.length > 0) {
      const generateActionItems = () => {
        const items = themes.map(theme => {
          if (theme.toLowerCase().includes('quantifiable')) {
            return 'Add at least 3 metrics to your top bullet points';
          } else if (theme.toLowerCase().includes('formatting')) {
            return 'Standardize formatting across all sections';
          } else if (theme.toLowerCase().includes('action verb')) {
            return 'Replace passive language with strong action verbs';
          } else if (theme.toLowerCase().includes('keyword')) {
            return 'Incorporate more industry-specific keywords';
          } else if (theme.toLowerCase().includes('skill')) {
            return 'Add a dedicated skills section with technical abilities';
          } else {
            return `Address: ${theme}`;
          }
        });
        
        setActionItems(items);
        setCompletedItems(new Array(items.length).fill(false));
      };
      
      generateActionItems();
    }
  }, [themes]);
  
  // Setup flashing effect with interval (keep existing functionality)
  useEffect(() => {
    console.log("Does the analysis exist? ", hasAnalysis);
    if (!hasAnalysis || hasBeenClicked) {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
      return;
    };

    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }

    flashIntervalRef.current = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1000);

    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, [hasAnalysis, hasBeenClicked]);
  
  const handleButtonClick = () => {
    setHasBeenClicked(true);
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      setIsFlashing(false);
    }
    onStartCareerChat();
  };

  const handleToggleComplete = (index: number) => {
    const newCompletedItems = [...completedItems];
    newCompletedItems[index] = !newCompletedItems[index];
    setCompletedItems(newCompletedItems);
  };

  const getLetterGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return "text-green-600";
      case 'B':
        return "text-emerald-600";
      case 'C':
        return "text-yellow-600";
      case 'D':
        return "text-orange-600";
      default:
        return "text-red-600";
    }
  };
  
  const getButtonClass = () => {
    if (hasAnalysis && hasBeenClicked) {
      return 'bg-green-600 hover:bg-green-700';
    } else if (hasAnalysis && isFlashing && !hasBeenClicked) {
      return 'bg-teal-600 hover:bg-teal-700';
    } else {
      return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  // Calculate completeness for action items
  const completedCount = completedItems.filter(Boolean).length;
  const completionPercentage = actionItems.length > 0 
    ? Math.round((completedCount / actionItems.length) * 100) 
    : 0;

  return (
    <Card className="border-t-2 border-t-[#9b87f5]">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <CardTitle>Resume Grade</CardTitle>
            <CardDescription>
              Overall assessment based on industry standards
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <Progress value={resumePercent} className="h-2 w-16" />
              <span className="text-xs text-muted-foreground">{resumePercent}%</span>
            </div>
            <div className={`text-4xl font-bold ${getLetterGradeColor(letterGrade)} bg-muted/20 h-16 w-16 rounded-full flex items-center justify-center`}>
              {letterGrade}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-accent/10 border-l-4 border-[#9b87f5] rounded-md p-4">
          <p className="font-medium mb-1">Professional Summary:</p>
          <p className="text-sm italic">{elevatorPitch}</p>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Improvement Action Plan</h3>
            <Badge variant="outline" className="font-normal">
              {completedCount}/{actionItems.length} Complete
            </Badge>
          </div>
          
          {actionItems.length > 0 ? (
            <div className="space-y-2">
              {actionItems.map((item, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    completedItems[index] 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-muted/20 border-muted'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="mr-3">
                      {completedItems[index] ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <span className={completedItems[index] ? 'text-sm line-through text-muted-foreground' : 'text-sm'}>
                      {item}
                    </span>
                  </div>
                  <Button 
                    variant={completedItems[index] ? "outline" : "secondary"} 
                    size="sm" 
                    onClick={() => handleToggleComplete(index)}
                  >
                    {completedItems[index] ? 'Undo' : 'Complete'}
                  </Button>
                </div>
              ))}
              
              <Progress value={completionPercentage} className="h-2 mt-1" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No action items available.
            </p>
          )}
        </div>
        
        <Separator />
        
        <div>
          <h3 className="font-medium mb-2">Expert Analysis:</h3>
          <p className="text-sm">{explanation}</p>
        </div>
        
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">Get Personalized Coaching</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Speak with our AI career coach for detailed guidance on how to address these improvement areas.
                </p>
                <Button 
                  onClick={handleButtonClick}
                  className={`w-full gap-2 transition-colors duration-300 ${getButtonClass()}`}
                >
                  <MessageSquare className="h-4 w-4" />
                  {hasAnalysis && hasBeenClicked ? 'Continue Career Chat' : 'Start Career Chat'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="bg-muted/20 pt-3 pb-3 px-6">
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString()} Analysis
          </p>
          <Button size="sm" variant="ghost" className="h-8 gap-1">
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs">Export Report</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default OverallScoreCard;
