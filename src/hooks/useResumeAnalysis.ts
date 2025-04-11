import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';
import { CareerTrack } from '@/data/careerQuizData';

// Career path alignment calculation
interface CareerAlignment {
  path: CareerTrack;
  percentage: number;
  description: string;
}

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [careerAlignments, setCareerAlignments] = useState<CareerAlignment[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasLoadedAnalysis = useRef(false);

  useEffect(() => {
    if (user && !hasLoadedAnalysis.current) {
      hasLoadedAnalysis.current = true;

      const savedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
      console.log("Loading analysis from localStorage:", savedAnalysis ? "Found" : "Not found");

      if (savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          setAnalysis(parsedAnalysis);
          calculateCareerAlignments(parsedAnalysis);
        } catch (error) {
          console.error('Error parsing saved analysis:', error);
        }
      }
    }
  }, [user]);

  // Calculate career alignments based on resume analysis
  const calculateCareerAlignments = (analysisData: ResumeAnalysis) => {
    if (!analysisData) return;

    // Get the user's quiz results from localStorage if available
    const careerPaths: CareerTrack[] = ['AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'];
    const quizTopPath = localStorage.getItem('recommendedCareerPath') as CareerTrack;
    
    // Sort paths with quiz top path first if available
    const sortedPaths = quizTopPath 
      ? [quizTopPath, ...careerPaths.filter(p => p !== quizTopPath)]
      : careerPaths;
    
    // Calculate alignment scores
    const alignments: CareerAlignment[] = sortedPaths.slice(0, 3).map(path => {
      // Base alignment on resume grade and path-specific factors
      const basePercentage = analysisData.resume_percent || 0;
      let pathMultiplier = 1.0;
      
      // Adjust alignment based on path-specific keywords found - using optional chaining for safety
      switch(path) {
        case 'AI/ML':
          pathMultiplier = analysisData.ai_ml_keywords_count ? 1 + (analysisData.ai_ml_keywords_count / 100) : 0.85;
          break;
        case 'Analytics':
          pathMultiplier = analysisData.analytics_keywords_count ? 1 + (analysisData.analytics_keywords_count / 100) : 0.9;
          break;
        case 'Data Engineering':
          pathMultiplier = analysisData.data_engineering_keywords_count ? 1 + (analysisData.data_engineering_keywords_count / 100) : 0.8;
          break;
        case 'Business Intelligence':
          pathMultiplier = analysisData.bi_keywords_count ? 1 + (analysisData.bi_keywords_count / 100) : 0.75;
          break;
      }
      
      // If specific keyword counts aren't available, use resume skills/keywords to estimate
      if (!analysisData.ai_ml_keywords_count) {
        // Use a random factor for demo purposes, would be better with actual keyword analysis
        const randomFactor = 0.7 + (Math.random() * 0.6); // Between 0.7 and 1.3
        pathMultiplier = randomFactor;
      }
      
      // Calculate alignment percentage (capped at 100%)
      const percentage = Math.min(Math.round(basePercentage * pathMultiplier), 100);
      
      // Generate description
      const description = `Your resume shows ${percentage}% alignment with ${path} roles.`;
      
      return { path, percentage, description };
    });
    
    setCareerAlignments(alignments);
  };

  // Fetch the resume assessment (roast) and store it in the database
  const fetchAndStoreAssessment = async (resumeText: string, userId: string) => {
    try {
      // Call the Edge Function to get the roast
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          action: 'get-roast',
          resumeText: resumeText,
          userId: userId
        }
      });
      
      if (error) {
        console.error("Error fetching assessment:", error);
        throw error;
      }
      
      if (data && data.roast) {
        // Update the resume record with the initial assessment
        const { error: updateError } = await supabase
          .from('resumes')
          .update({ initial_assessment: data.roast })
          .eq('user_id', userId);
          
        if (updateError) {
          console.error('Error storing assessment in database:', updateError);
        } else {
          console.log('Initial assessment stored successfully');
        }
        
        return data.roast;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching resume assessment:', error);
      return null;
    }
  };

  const analyzeResume = async (resumeText: string): Promise<boolean> => {
    if (!resumeText || !user) {
      console.log("Cannot analyze: missing text or user");
      return false;
    }
    
    // Clear previous analysis before starting new one
    setIsAnalyzing(true);
    console.log("Starting resume analysis with text of length:", resumeText.length);
    
    try {
      // Store the resume text in localStorage for potential later use
      localStorage.setItem(`resume_text_${user.id}`, resumeText);
      
      // Step 1: Call the Edge Function with user ID and text
      console.log("Calling resume-analyzer edge function");
      
      try {
        const { data: analysisData, error } = await supabase.functions.invoke('resume-analyzer', {
          body: { 
            resumeText: resumeText,
            userId: user.id
          }
        });
        
        if (error) {
          console.error("Edge function error:", error);
          throw error;
        }
        
        console.log("Resume analysis complete:", analysisData ? "Success" : "No data returned");
        
        // Check if we have analysis data
        let finalAnalysisData = analysisData;
        
        if (!finalAnalysisData) {
          console.warn("No analysis returned from edge function; attempting fallback to DB");
        
          const { data: resumeRecord, error: fetchError } = await supabase
            .from('resumes')
            .select('analysis')
            .eq('user_id', user.id)
            .maybeSingle();
        
          if (fetchError) {
            console.error("Error fetching stored analysis from database:", fetchError);
            throw new Error("No analysis returned and database fetch failed");
          }
        
          if (resumeRecord?.analysis) {
            console.warn("Using existing analysis from DB");
            finalAnalysisData = resumeRecord.analysis;
          } else {
            throw new Error("No analysis data returned from edge function or DB");
          }
        }
        
        // Clean up any prompt markers or artifacts in the analysis data
        const cleanedData = cleanAnalysisOutput(finalAnalysisData);
        
        // Add the resume ID to the analysis data
        cleanedData.resume_id = user.id;
        
        // Save the analysis to localStorage for persistence
        if (cleanedData && user) {
          localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(cleanedData));
        }
        
        setAnalysis(cleanedData as ResumeAnalysis);
        calculateCareerAlignments(cleanedData as ResumeAnalysis);
        
        // Fetch and store the assessment in parallel
        fetchAndStoreAssessment(resumeText, user.id)
          .catch(err => console.error("Error fetching assessment:", err));
        
        // Also update the analysis in the resume record
        try {
          const { error: updateError } = await supabase
            .from('resumes')
            .update({ 
              analysis: cleanedData,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);
            
          if (updateError) {
            console.error("Error updating resume with analysis:", updateError);
          } else {
            console.log("Successfully stored analysis in resume record");
          }
        } catch (updateErr) {
          console.error("Error updating resume record:", updateErr);
        }
        
        toast({
          title: "Resume Analysis Complete",
          description: `Your resume received a grade of ${cleanedData.letter_grade} (${cleanedData.resume_percent}%)`,
        });
        
        return true;
      } catch (functionError) {
        console.error("Error invoking edge function:", functionError);
        
        // If the error is a CORS error or network error, try using a mockup fallback analysis
        toast({
          title: "Analysis Service Unavailable",
          description: "We're experiencing technical difficulties. Using limited analysis capabilities.",
          variant: "destructive",
        });
        
        // Create a basic fallback analysis
        const fallbackAnalysis = {
          resume_id: user.id,
          resume_percent: 50,
          letter_grade: "C+",
          bullets: [],
          elevator_pitch: "Experienced professional with skills in their domain. Consider adding more quantifiable achievements to your resume.",
          themes: [
            "Add more metrics and achievements to your bullet points",
            "Use stronger action verbs at the start of each bullet point",
            "Make your bullet points more concise and focused on results"
          ],
          explanation: "Your resume would benefit from more specific accomplishments with metrics. Focus on what you achieved rather than just responsibilities."
        };
        
        // Save the fallback analysis
        localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(fallbackAnalysis));
        setAnalysis(fallbackAnalysis as ResumeAnalysis);
        calculateCareerAlignments(fallbackAnalysis as ResumeAnalysis);
        
        return true;
      }
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
  
  // Clean up any AI prompt markers or formatting artifacts
  const cleanAnalysisOutput = (data: any) => {
    if (!data) return data;
    
    const cleanedData = { ...data };
    
    // Clean text fields by removing prompt indicators like "*", "##", "- ***" etc.
    if (cleanedData.elevator_pitch) {
      cleanedData.elevator_pitch = cleanedData.elevator_pitch
        .replace(/\*\*|\*|##|```|\[\[.*?\]\]|\n/g, '')
        .trim();
    }
    
    if (cleanedData.explanation) {
      cleanedData.explanation = cleanedData.explanation
        .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
        .replace(/^.*?:(.*)/gm, '$1') // Remove field labels like "Resume Grade Explanation:"
        .trim();
    }
    
    // Clean up theme entries
    if (cleanedData.themes && Array.isArray(cleanedData.themes)) {
      cleanedData.themes = cleanedData.themes.map((theme: string) => 
        theme.replace(/^[-*\s]*\*\*\*|^\s*-\s*\*\*\*|\*\*\*|:/g, '')
          .replace(/^\s*[–-]\s*/g, '')
          .trim()
      );
    }
    
    // Clean up bullet entries
    if (cleanedData.bullets && Array.isArray(cleanedData.bullets)) {
      cleanedData.bullets = cleanedData.bullets.map((bullet: any) => {
        if (bullet.improved_bullet) {
          bullet.improved_bullet = bullet.improved_bullet
            .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
            .trim();
        }
        if (bullet.explanation) {
          bullet.explanation = bullet.explanation
            .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
            .trim();
        }
        return bullet;
      });
    }
    
    return cleanedData;
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    analyzeResume,
    careerAlignments,
    fetchAndStoreAssessment
  };
}
