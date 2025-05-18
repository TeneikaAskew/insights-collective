
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StudyGuide } from '@/types/interview';

export function useStudyGuides() {
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchStudyGuides = async (): Promise<StudyGuide[]> => {
    if (!user) return [];

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      console.error('Error fetching study guides:', error);
      toast({
        title: 'Error',
        description: 'Failed to load study guides',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getStudyGuide = async (id: string): Promise<StudyGuide | null> => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error fetching study guide:', error);
      toast({
        title: 'Error',
        description: 'Failed to load study guide details',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateStudyGuide = async (
    jobDescriptionId: string,
    modelProvider: 'together' | 'openai' = 'together'
  ): Promise<StudyGuide | null> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to generate study guides',
        variant: 'destructive',
      });
      return null;
    }

    setGenerating(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-study-guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          jobDescriptionId,
          userId: user.id,
          modelProvider
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate study guide');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Study guide generated',
          description: 'Your interview preparation guide is ready',
        });
        return result.data;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
      
    } catch (error) {
      console.error('Error generating study guide:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate study guide',
        variant: 'destructive',
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };
  
  const getStudyGuideForJobDescription = async (jobDescriptionId: string): Promise<StudyGuide | null> => {
    if (!user) return null;

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('job_description_id', jobDescriptionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error fetching study guide for job description:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateStudyGuideChecklist = async (id: string, checklist: any[]): Promise<boolean> => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('study_guides')
        .update({ technical_checklist: checklist })
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
      
    } catch (error) {
      console.error('Error updating study guide checklist:', error);
      toast({
        title: 'Error',
        description: 'Failed to update checklist progress',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    generating,
    fetchStudyGuides,
    getStudyGuide,
    generateStudyGuide,
    getStudyGuideForJobDescription,
    updateStudyGuideChecklist
  };
}
