
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ResumeAnalysis {
  text?: string;
  sentences?: Array<{
    text: string;
    category: string;
    feedback: string;
    improved_version: string;
  }>;
  analysis?: {
    strengths: string[];
    improvements: string[];
    keywords: string[];
    ats_score: number;
    role_alignment: number;
  };
  career_alignment_score?: number;
  enhanced_analysis?: {
    overall_score: number;
    sections: Array<{
      section: string;
      score: number;
      feedback: string;
      suggestions: string[];
    }>;
    keywords: {
      present: string[];
      missing: string[];
      suggestions: string[];
    };
    ats_compatibility: {
      score: number;
      issues: string[];
      improvements: string[];
    };
  };
  resume_roast?: string;
  fallback_analysis?: {
    summary: string;
    strengths: string[];
    areas_for_improvement: string[];
    recommendations: string[];
  };
}

export function useResume() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<ResumeAnalysis>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPollingForImprovements, setIsPollingForImprovements] = useState(false);

  const uploadResume = async (file: File, targetRole?: string, careerGoals?: string) => {
    if (!user) throw new Error('User not authenticated');

    setIsAnalyzing(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save resume record to database
      const { data: resumeData, error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_path: filePath,
          target_role: targetRole,
          career_goals: careerGoals,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast({
        title: 'Resume uploaded successfully',
        description: 'Your resume is being analyzed...',
      });

      return resumeData;
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pollForImprovedBullets = async (userId: string) => {
    setIsPollingForImprovements(true);
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setIsPollingForImprovements(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('resumes')
          .select('sentences, sentences_updated_at')
          .eq('user_id', userId)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        if (data?.sentences) {
          setAnalysis(prev => ({
            ...prev,
            sentences: data.sentences as ResumeAnalysis['sentences']
          }));
          setIsPollingForImprovements(false);
          toast({
            title: 'Resume improvements ready!',
            description: 'Your improved resume bullets are now available.',
          });
          return;
        }

        attempts++;
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('Error polling for improvements:', error);
        setIsPollingForImprovements(false);
      }
    };

    poll();
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    isPollingForImprovements,
    uploadResume,
    pollForImprovedBullets,
  };
}
