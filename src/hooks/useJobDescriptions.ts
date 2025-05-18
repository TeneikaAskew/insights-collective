
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { JobDescription, JobDescriptionParsedFields } from '@/types/interview';

export function useJobDescriptions() {
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const createJobDescription = async (
    rawText: string, 
    sourceType: 'manual' | 'url', 
    sourceUrl?: string
  ): Promise<JobDescription | null> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to save job descriptions',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .insert({
          user_id: user.id,
          source_type: sourceType,
          source_url: sourceUrl,
          raw_text: rawText
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: 'Job description saved',
        description: 'Your job description has been saved successfully',
      });
      
      return data;
      
    } catch (error) {
      console.error('Error creating job description:', error);
      toast({
        title: 'Error',
        description: 'Failed to save job description',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDescriptions = async (): Promise<JobDescription[]> => {
    if (!user) return [];

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      console.error('Error fetching job descriptions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load job descriptions',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getJobDescription = async (id: string): Promise<JobDescription | null> => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error fetching job description:', error);
      toast({
        title: 'Error',
        description: 'Failed to load job description details',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeJobDescription = async (
    jobDescriptionId: string, 
    modelProvider: 'together' | 'openai' = 'together'
  ): Promise<JobDescriptionParsedFields | null> => {
    setAnalyzing(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-job-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          jobDescriptionId,
          modelProvider
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze job description');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Analysis complete',
          description: 'Job description analyzed successfully',
        });
        return result.data;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
      
    } catch (error) {
      console.error('Error analyzing job description:', error);
      toast({
        title: 'Analysis failed',
        description: error.message || 'Failed to analyze job description',
        variant: 'destructive',
      });
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteJobDescription = async (id: string): Promise<boolean> => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('job_descriptions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Job description deleted',
        description: 'The job description has been deleted successfully',
      });
      
      return true;
      
    } catch (error) {
      console.error('Error deleting job description:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete job description',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const scrapeJobUrl = async (url: string): Promise<string | null> => {
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scrape-job-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scrape job description');
      }
      
      const result = await response.json();
      
      if (result.success) {
        return result.data.text;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
      
    } catch (error) {
      console.error('Error scraping job URL:', error);
      toast({
        title: 'Scraping failed',
        description: error.message || 'Failed to extract job description from URL',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    analyzing,
    createJobDescription,
    fetchJobDescriptions,
    getJobDescription,
    analyzeJobDescription,
    deleteJobDescription,
    scrapeJobUrl
  };
}
