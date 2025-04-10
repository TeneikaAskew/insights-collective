
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage } from './useResumeStorage';
import { Json } from '@/integrations/supabase/types';

interface Resume {
  id: string;
  user_id: string;
  file_path: string;
  text: string | null;
  analysis: any;
  career_alignment_score: number;
  target_role: string;
  uploaded_at: string;
  updated_at: string;
  file_url?: string;
}

// Interface for creating a new resume record
interface CreateResumeData {
  user_id: string;
  file_path: string;
  text?: string | null;
  analysis?: any;
  career_alignment_score?: number;
  target_role?: string;
}

// Interface for updating an existing resume record
interface UpdateResumeData {
  file_path?: string;
  text?: string | null;
  analysis?: any;
  career_alignment_score?: number;
  target_role?: string;
  updated_at?: string;
}

export function useResumeData() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { getResumeFileUrl } = useResumeStorage();

  const fetchResume = async () => {
    if (!user) {
      setResume(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Add a cache-busting timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      
      // Use the explicit headers to prevent caching
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching resume:', error);
        throw error;
      }
      
      if (data) {
        // Get download URL for the resume file
        const fileUrl = await getResumeFileUrl(user.id, data.file_path);
        
        console.log("Fetched resume:", { ...data, file_url: fileUrl });
        
        setResume({
          ...data,
          file_url: fileUrl
        });
      } else {
        console.log("No resume found for user:", user.id);
        setResume(null);
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
      toast({
        title: 'Error',
        description: 'Could not load your resume. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const updateResumeRecord = async (userId: string, data: UpdateResumeData) => {
    try {
      console.log("Updating resume record:", data);
      
      const { error } = await supabase
        .from('resumes')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
        
      if (error) throw error;
      
      // Refresh the resume data after update
      await fetchResume();
      return true;
    } catch (error) {
      console.error('Error updating resume record:', error);
      return false;
    }
  };
  
  const createResumeRecord = async (data: CreateResumeData) => {
    try {
      console.log("Creating resume record:", data);
      
      const { error } = await supabase
        .from('resumes')
        .insert(data);
        
      if (error) throw error;
      
      // Refresh the resume data after creation
      await fetchResume();
      return true;
    } catch (error) {
      console.error('Error creating resume record:', error);
      return false;
    }
  };
  
  const deleteResumeRecord = async (resumeId: string) => {
    try {
      console.log("Deleting resume record:", resumeId);
      
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId);
        
      if (error) throw error;
      
      // Clear the resume state after deletion
      setResume(null);
      return true;
    } catch (error) {
      console.error('Error deleting resume record:', error);
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchResume();
    } else {
      setResume(null);
      setLoading(false);
    }
  }, [user]);

  return {
    resume,
    loading,
    fetchResume,
    updateResumeRecord,
    createResumeRecord,
    deleteResumeRecord
  };
}
