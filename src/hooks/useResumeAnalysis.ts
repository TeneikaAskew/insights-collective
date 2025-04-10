
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Force refresh the analysis data
  const refreshAnalysis = useCallback(() => {
    if (user) {
      console.log("Forcing analysis refresh for user:", user.id);
      const savedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
      if (savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          console.log("Retrieved analysis from localStorage:", parsedAnalysis);
          // Force a fresh state update
          setAnalysis(null);
          setTimeout(() => {
            console.log("Setting refreshed analysis");
            setAnalysis(parsedAnalysis);
          }, 0);
        } catch (error) {
          console.error('Error parsing saved analysis:', error);
        }
      } else {
        console.log("No saved analysis found for user");
      }
    }
  }, [user]);

  // Load saved analysis from localStorage on component mount with cache busting
  useEffect(() => {
    refreshAnalysis();
  }, [refreshAnalysis]);

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
      
      // Step 2: Try to first get the text from the database if it exists
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .select('text')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Use text from DB if available, otherwise use the extracted text
      const textToAnalyze = resumeData?.text || fileText;
      
      // Clear any previous analysis before starting new one
      localStorage.removeItem(`resume_analysis_${user.id}`);
      setAnalysis(null);
      
      // Step 3: Call the Edge Function with user ID and text
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText: textToAnalyze,
          userId: user.id,
          timestamp: Date.now() // Add timestamp to bust cache
        }
      });
      
      if (error) throw error;
      
      console.log("Analysis response received:", data);
      
      // Save the analysis to localStorage for persistence
      if (data && user) {
        const analysisJson = JSON.stringify(data);
        localStorage.setItem(`resume_analysis_${user.id}`, analysisJson);
        console.log("Saved analysis to localStorage");
      }
      
      // Force new state update with timeout to ensure React recognizes it as a new value
      setTimeout(() => {
        console.log("Setting analysis after processing");
        setAnalysis(data as ResumeAnalysis);
      }, 0);
      
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

  // Helper function to extract text from PDF
  const extractTextFromFile = async (file: File): Promise<string> => {
    try {
      // Check file type and use appropriate extraction method
      if (file.type === 'application/pdf') {
        const pdfjs = await import('pdfjs-dist');
        // Configure PDF.js worker
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfData = new Uint8Array(arrayBuffer);
        
        // Load the PDF document
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          fullText += pageText + '\n';
        }
        
        return fullText;
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For DOCX files
        const mammoth = await import('mammoth');
        
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      } else {
        throw new Error("Unsupported file type. Only PDF and DOCX are supported.");
      }
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    analyzeResume,
    refreshAnalysis
  };
}
