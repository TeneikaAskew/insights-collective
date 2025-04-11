
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage } from './useResumeStorage';

export interface Resume {
  id: string;
  user_id: string;
  file_path: string;  // Database field
  file_name?: string; // UI field (derived from file_path)
  file_url?: string;  // UI field (generated)
  text: string;
  created_at?: string; // Optional since it's derived
  uploaded_at?: string; // Database field
  updated_at: string;
  career_alignment_score?: number;
  target_role?: string;
  analysis?: any;
}

// Helper function to ensure the resumes table exists
const ensureResumesTableExists = async () => {
  try {
    // We'll check if the table exists by performing a query
    const { error } = await supabase
      .from('resumes')
      .select('id')
      .limit(1);
    
    // If there's a PostgreSQL error specifically about relation not existing
    if (error && error.code === '42P01') {
      console.error("Resumes table does not exist:", error);
      throw new Error("Resumes table does not exist. Please create it using SQL migrations.");
    } else if (error) {
      console.error("Error checking resumes table:", error);
    } else {
      console.log("Resumes table exists");
    }
    
    return true;
  } catch (error) {
    console.error("Error ensuring resumes table exists:", error);
    throw error;
  }
};

export const useResume = () => {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadResumeFile, getResumeFileUrl } = useResumeStorage();

  // Load resume data when user changes
  useEffect(() => {
    if (user) {
      fetchResume();
    } else {
      setResume(null);
      setLoading(false);
    }
  }, [user]);

  // Fetch resume data from Supabase
  const fetchResume = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Verify the table exists
      await ensureResumesTableExists();
      
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        if (error.code !== 'PGRST116') { // No rows returned is not an error for us
          console.error('Error fetching resume:', error);
          toast({
            title: 'Error',
            description: 'Failed to load resume data.',
            variant: 'destructive',
          });
        }
        setResume(null);
      } else if (data) {
        // Transform database record to match Resume interface
        const fileName = data.file_path.split('/').pop() || '';
        
        // Get signed URL for the file
        const fileUrl = await getResumeFileUrl(user.id, data.file_path);
        
        setResume({
          ...data,
          file_name: fileName,
          file_url: fileUrl,
          created_at: data.uploaded_at // Use uploaded_at as created_at
        });
      } else {
        setResume(null);
      }
    } catch (error) {
      console.error('Error in fetchResume:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred loading your resume.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload resume file to Supabase storage and record in database
  const uploadResume = async (file: File): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to upload a resume.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setUploading(true);
      
      // Ensure table exists
      await ensureResumesTableExists();
      
      // Upload file to storage
      const uploadResult = await uploadResumeFile(file, user.id);
      
      if (!uploadResult.success) {
        throw new Error('Failed to upload resume file');
      }
      
      // Extract text from file for analysis
      let fileText = '';
      try {
        // This uses the extractTextFromFile function from useResumeStorage
        const textReader = new FileReader();
        textReader.readAsText(file);
        fileText = await new Promise((resolve) => {
          textReader.onload = () => resolve(textReader.result as string);
        });
      } catch (err) {
        console.warn('Could not extract text from file, continuing with upload');
      }
      
      // Check if user already has a resume record
      const { data: existingResume, error: fetchError } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let saveResult;
      
      if (existingResume?.id) {
        // Update existing record
        saveResult = await supabase
          .from('resumes')
          .update({
            file_path: uploadResult.filePath,
            text: fileText,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResume.id);
      } else {
        // Insert new record
        saveResult = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_path: uploadResult.filePath,
            text: fileText,
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      if (saveResult.error) {
        console.error('Error saving resume record:', saveResult.error);
        throw new Error('Failed to save resume information to database');
      }
      
      // Refresh resume data
      await fetchResume();
      
      toast({
        title: 'Success',
        description: 'Resume uploaded successfully.',
      });
      
      return true;
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload resume.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Delete resume from storage and database
  const deleteResume = async (): Promise<boolean> => {
    if (!user || !resume) return false;

    try {
      // Delete file from storage (using the storage hook)
      const { deleteResumeFile } = useResumeStorage();
      const storageResult = await deleteResumeFile(user.id, resume.file_path);
      
      if (!storageResult) {
        console.warn('Could not delete file from storage, continuing with database deletion');
      }
      
      // Delete record from database
      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resume.id);
      
      if (dbError) {
        console.error('Error deleting resume record:', dbError);
        throw new Error('Failed to delete resume information from database');
      }
      
      // Clear the resume state
      setResume(null);
      
      toast({
        title: 'Success',
        description: 'Resume deleted successfully.',
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete resume.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    resume,
    loading,
    uploading,
    uploadResume,
    deleteResume,
    refreshResume: fetchResume
  };
};
