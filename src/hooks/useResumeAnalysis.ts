import { useState, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { ResumeAnalysis, BulletAnalysis } from '@/components/assistants/types';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { rewriteBullet, generateTips, generateThemes } from './supabase/functions/resume-analyzer/bulletSuggestions';
import { analyzeWordBalance, xyzCheck } from '@/supabase/functions/resume-analyzer/bulletAnalysis';

interface UseResumeAnalysisReturn {
  analysis: ResumeAnalysis | null;
  isAnalyzing: boolean;
  isUploading: boolean;
  analysisError: string | null;
  uploadError: string | null;
  analyzeResume: (resumeText: string, userId: string) => Promise<void>;
  uploadResume: (file: File, userId: string) => Promise<string | null>;
  resetState: () => void;
}

export const useResumeAnalysis = (): UseResumeAnalysisReturn => {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setAnalysis(null);
    setIsAnalyzing(false);
    setIsUploading(false);
    setAnalysisError(null);
    setUploadError(null);
  }, []);

  const uploadResume = useCallback(async (file: File, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setUploadError(null);
    const resume_id = uuidv4();

    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(`${userId}/${resume_id}-${file.name}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Error uploading resume:", error);
        setUploadError(error.message);
        toast({
          title: "Upload Failed ❌",
          description: "There was an error uploading your resume. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      const filePath = data.path;
      toast({
        title: "Upload Successful ✅",
        description: "Your resume has been successfully uploaded.",
      });
      return resume_id;
    } catch (error: any) {
      console.error("Unexpected error uploading resume:", error);
      setUploadError(error.message || 'An unexpected error occurred');
      toast({
        title: "Upload Failed ❌",
        description: "An unexpected error occurred during upload. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const analyzeResume = useCallback(async (resumeText: string, userId: string): Promise<void> => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Split the resume text into bullet points
      const bulletRegex = /(?:•|\u2022|\u2023|[*-])\s+([^\n]+)/g;
      let match;
      const bullets: string[] = [];
      while ((match = bulletRegex.exec(resumeText)) !== null) {
        bullets.push(match[1]);
      }

      if (bullets.length === 0) {
        setAnalysisError("No bullet points found in the resume. Please format your resume with bullet points.");
        toast({
          title: "Analysis Failed ❌",
          description: "No bullet points found. Please format your resume with bullet points.",
          variant: "destructive",
        });
        return;
      }

      // Analyze each bullet point
      const bulletAnalyses: BulletAnalysis[] = bullets.map(bullet => {
        const wordBalance = analyzeWordBalance(bullet);
        const xyz_scores = xyzCheck(bullet);
        const bullet_total = wordBalance.word_balance_score + xyz_scores.xyz_total;

        return {
          original: bullet,
          word_balance: wordBalance,
          word_balance_score: wordBalance.word_balance_score,
          xyz_scores: xyz_scores,
          bullet_total: bullet_total,
          rewritten: '', // Initialize as empty string
          tips: '' // Initialize as empty string
        };
      });

      // Get suggestions and tips for each bullet point
      const bulletSuggestionsPromises = bulletAnalyses.map(async (bulletAnalysis) => {
        try {
          const rewritten = await rewriteBullet(bulletAnalysis.original, bulletAnalysis);
          const tips = await generateTips(bulletAnalysis.original, bulletAnalysis);
          return { ...bulletAnalysis, rewritten, tips };
        } catch (suggestionError: any) {
          console.error("Error generating suggestion for bullet:", bulletAnalysis.original, suggestionError);
          return { ...bulletAnalysis, rewritten: 'Failed to generate suggestion.', tips: 'No tips available.' };
        }
      });

      const updatedBulletAnalyses = await Promise.all(bulletSuggestionsPromises);

      // Calculate overall resume score
      let totalScore = 0;
      updatedBulletAnalyses.forEach(bullet => {
        totalScore += bullet.bullet_total;
      });
      const resume_average = totalScore / updatedBulletAnalyses.length;
      const resume_percent = Math.round((resume_average / 45) * 100);

      // Generate themes
      const themes = generateThemes(updatedBulletAnalyses);

      // Determine letter grade
      let letter_grade = 'C';
      if (resume_percent >= 90) {
        letter_grade = 'A';
      } else if (resume_percent >= 80) {
        letter_grade = 'B';
      }

      // Generate elevator pitch
      const elevator_pitch = "This resume showcases a highly skilled and experienced professional with a strong track record of achievements.";

      // Generate explanation
      const explanation = "The resume demonstrates a good balance of skills, action, and quantifiable results.";

      const resumeAnalysisResult: ResumeAnalysis = {
        bullets: updatedBulletAnalyses,
        resume_average,
        resume_percent,
        letter_grade,
        themes,
        elevator_pitch,
        explanation,
      };

      setAnalysis(resumeAnalysisResult);
      toast({
        title: "Analysis Complete ✅",
        description: "Your resume has been successfully analyzed.",
      });

    } catch (error: any) {
      console.error("Error analyzing resume:", error);
      setAnalysisError(error.message || 'An unexpected error occurred');
      toast({
        title: "Analysis Failed ❌",
        description: "There was an error analyzing your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  return {
    analysis,
    isAnalyzing,
    isUploading,
    analysisError,
    uploadError,
    analyzeResume,
    uploadResume,
    resetState
  };
};
