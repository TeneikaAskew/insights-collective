
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';

// PDF.js library to extract text from PDFs
import * as pdfjs from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load saved analysis from localStorage on component mount
  useEffect(() => {
    if (user) {
      const savedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
      if (savedAnalysis) {
        try {
          setAnalysis(JSON.parse(savedAnalysis));
        } catch (error) {
          console.error('Error parsing saved analysis:', error);
        }
      }
    }
  }, [user]);

  // Extract text from PDF file
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Load the PDF document
      const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
      
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
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };
  
  // Store resume text in Supabase
  const storeResumeText = async (userId: string, resumeText: string): Promise<boolean> => {
    try {
      // Check if user already has a resume record
      const { data: existingResume, error: fetchError } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (existingResume) {
        // Update existing record
        const { error } = await supabase
          .from('resumes')
          .update({ 
            file_path: 'resume_text',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResume.id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('resumes')
          .insert({
            user_id: userId,
            file_path: 'resume_text'
          });
          
        if (error) throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error storing resume text:', error);
      return false;
    }
  };

  const analyzeResume = async (file: File): Promise<boolean> => {
    if (!file || !user) return false;
    
    setIsAnalyzing(true);
    
    try {
      // Step 1: Extract text from PDF
      const resumeText = await extractTextFromPDF(file);
      
      // Step 2: Store the text in Supabase
      const storedSuccessfully = await storeResumeText(user.id, resumeText);
      
      if (!storedSuccessfully) {
        throw new Error('Failed to store resume text in database');
      }
      
      // Step 3: Call the Edge Function with user ID and resume text
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText,
          userId: user.id
        }
      });
      
      if (error) throw error;
      
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
