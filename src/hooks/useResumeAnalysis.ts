
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';
import { extractTextFromFile } from '@/hooks/resume/useResumeStorage';

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load saved analysis from localStorage on component mount
  useEffect(() => {
    if (user) {
      const savedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
      console.log("Loading analysis from localStorage:", savedAnalysis ? "Found" : "Not found");
      if (savedAnalysis) {
        try {
          setAnalysis(JSON.parse(savedAnalysis));
        } catch (error) {
          console.error('Error parsing saved analysis:', error);
        }
      }
    }
  }, [user]);

  const analyzeResume = async (file: File): Promise<boolean> => {
    if (!file || !user) return false;
    
    setIsAnalyzing(true);
    console.log("Starting resume analysis for file:", file.name);
    
    try {
      // Extract text from the uploaded file first
      const fileText = await extractTextFromFile(file);
      
      if (!fileText) {
        throw new Error('Failed to extract text from the file');
      }
      
      console.log("Successfully extracted text from resume, length:", fileText.length);
      
      // Step 2: Try to first get the text from the database if it exists
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .select('text')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Use text from DB if available, otherwise use the extracted text
      const textToAnalyze = resumeData?.text || fileText;
      
      // Step 3: Call the Edge Function with user ID and text
      console.log("Calling resume-analyzer edge function");
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText: textToAnalyze,
          userId: user.id
        }
      });
      
      if (error) throw error;
      
      console.log("Resume analysis complete:", data ? "Success" : "No data returned");
      
      // Save the analysis to localStorage for persistence
      if (data && user) {
        localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(data));
      }
      
      setAnalysis(data as ResumeAnalysis);
      
      toast({
        title: "Resume Analysis Complete",
        description: `Your resume received a grade of ${data.letter_grade} (${data.resume_percent}%)`,
      });
      
      return true;
    } catch (error) {
      console.error('Error analyzing resume:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to analyze your resume. Please try again.',
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    analyzeResume
  };
}
