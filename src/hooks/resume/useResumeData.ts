
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage } from './useResumeStorage';

interface Resume {
  id: string;
  user_id: string;
  file_path: string;
  text: string | null;
  analysis: any;
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
}

// Interface for updating an existing resume record
interface UpdateResumeData {
  file_path?: string;
  text?: string | null;
  analysis?: any;
  updated_at?: string;
}

export function useResumeData() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { getResumeFileUrl } = useResumeStorage();

  const fetchResume = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log("Fetching resume for user:", user.id);
      
      // Get resume record
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false }) // Order by latest
        .limit(1) // Only take the latest one
        .maybeSingle();
        
      if (error) {
        console.error("Error fetching resume:", JSON.stringify(error));
        throw error;
      }
      
      if (data) {
        console.log("Found resume record with file path:", data.file_path);
        
        // Get download URL for the resume file using signed URL
        const fileUrl = await getResumeFileUrl(user.id, data.file_path);
        
        if (fileUrl) {
          console.log("Successfully generated signed URL for resume");
        } else {
          console.warn("Could not generate signed URL for resume");
        }
        
        setResume({
          ...data,
          file_url: fileUrl
        });
      } else {
        console.log("No resume found for user");
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
      const { error } = await supabase
        .from('resumes')
        .update(data)
        .eq('user_id', userId);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating resume record:', error);
      return false;
    }
  };
  
  const createResumeRecord = async (data: CreateResumeData) => {
    try {
      const { error } = await supabase
        .from('resumes')
        .insert(data);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating resume record:', error);
      return false;
    }
  };
  
  const deleteResumeRecord = async (resumeId: string) => {
    try {
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting resume record:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchResume();
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
