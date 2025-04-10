
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';

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

  const analyzeResume = async (file: File): Promise<boolean> => {
    if (!file || !user) return false;
    
    setIsAnalyzing(true);
    
    try {
      // Step 1: Extract text from the PDF file
      // We'll use the text directly from the file rather than fetching from the database
      const fileBuffer = await file.arrayBuffer();
      const fileText = await extractTextFromPDF(new Uint8Array(fileBuffer));
      
      if (!fileText) {
        throw new Error('Failed to extract text from the PDF file');
      }
      
      // Step 2: Call the Edge Function with user ID and extracted text
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText: fileText,
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

  // Helper function to extract text from PDF
  const extractTextFromPDF = async (pdfData: Uint8Array): Promise<string> => {
    try {
      const pdfjs = await import('pdfjs-dist');
      // Configure PDF.js worker
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
      
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
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    analyzeResume
  };
}
