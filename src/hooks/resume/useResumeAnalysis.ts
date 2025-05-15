// This is a modification to ensure the useResumeAnalysis hook exports the needed state setter
// Add the setIsPollingForImprovements state setter to the returned object

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CareerAlignment, ResumeAnalysis } from '@/types/resume';

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [careerAlignments, setCareerAlignments] = useState<CareerAlignment[]>([]);
  
  // Add the isPollingForImprovements state
  const [isPollingForImprovements, setIsPollingForImprovements] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const analyzeResume = useCallback(async (resumeText: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to analyze your resume.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('analyze-resume', {
        body: { resumeText, userId: user.id }
      });

      if (functionError) {
        console.error("Function invocation failed:", functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (functionData?.success && functionData.data) {
        const newAnalysis = functionData.data as ResumeAnalysis;
        setAnalysis(newAnalysis);
        setCareerAlignments(newAnalysis.career_alignments || []);
        toast({
          title: "Resume Analyzed",
          description: "Your resume has been successfully analyzed!",
        });
      } else {
        console.error("Analysis failed or returned invalid data.", functionData);
        throw new Error(functionData?.error || "Failed to analyze resume.");
      }
    } catch (error) {
      console.error("Error in analyzeResume:", error);
      toast({
        title: "Analysis Failed",
        description: `We couldn't analyze your resume. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, supabase, toast]);
  
  // Add the setter to the return object so it can be used in Resume.tsx
  return {
    analysis,
    isAnalyzing,
    analyzeResume,
    careerAlignments,
    setAnalysis,
    isPollingForImprovements,
    setIsPollingForImprovements,
    // ... any other values you're already returning
  };
}
