
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './use-toast.tsx';
import { ResumeAnalysis } from '@/components/assistants/types';
import { ResumeData } from '@/types/resume';

export const useResumeAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [careerAlignments, setCareerAlignments] = useState<any[]>([]);
  const [isPollingForImprovements, setIsPollingForImprovements] = useState(false);
  const [improvedBullets, setImprovedBullets] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const analyzeResume = useCallback(async (resumeText: string): Promise<boolean> => {
    if (!user) {
      toast({ 
        title: "Authentication required", 
        description: "Please log in to analyze your resume.",
        variant: "destructive" 
      });
      return false;
    }

    try {
      setIsAnalyzing(true);
      
      // Make the API call to analyze the resume
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText,
          userId: user.id 
        }
      });

      if (error) {
        throw new Error(`Error analyzing resume: ${error.message}`);
      }

      if (!data || !data.analysis) {
        throw new Error("No analysis data returned");
      }

      // Cache the analysis locally
      setAnalysis(data.analysis);
      localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify({
        ...data.analysis,
        updated_at: new Date().toISOString()
      }));

      if (data.careerAlignments) {
        setCareerAlignments(data.careerAlignments);
      }

      toast({
        title: "Analysis Complete",
        description: "Your resume has been successfully analyzed.",
      });

      return true;
    } catch (error) {
      console.error("Resume analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze your resume. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, toast]);

  const pollForImprovedBullets = async (): Promise<boolean> => {
    if (!user) {
      return false;
    }
    
    setIsPollingForImprovements(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          action: 'improve-bullets',
          userId: user.id,
        }
      });
      
      if (error) throw error;
      
      if (data?.improved_bullets && data.improved_bullets.length > 0) {
        setImprovedBullets(data.improved_bullets);
        
        // Also update the full analysis object
        setAnalysis(prevAnalysis => {
          if (!prevAnalysis) return prevAnalysis;
          
          return {
            ...prevAnalysis,
            bullets: data.improved_bullets
          };
        });
        
        setIsPollingForImprovements(false);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Error polling for improved bullets:", err);
      setIsPollingForImprovements(false);
      return false;
    }
  };

  return {
    isAnalyzing,
    analysis,
    careerAlignments,
    improvedBullets,
    analyzeResume,
    setAnalysis,
    isPollingForImprovements,
    setIsPollingForImprovements,
    improvedBullets,
    setImprovedBullets,
    pollForImprovedBullets
  };
};
