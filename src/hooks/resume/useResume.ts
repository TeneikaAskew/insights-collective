
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Resume {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  text: string; // Added text property
  created_at: string;
  updated_at: string;
  career_alignment_score?: number;
  target_role?: string;
}

export const useResume = () => {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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
      
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
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
      } else {
        setResume(data);
      }
    } catch (error) {
      console.error('Error in fetchResume:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
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
      
      // Extract text from file
      let fileText = '';
      try {
        // This assumes we have a helper function elsewhere that extracts text
        // We'll store this text in the database for easier access
        const textReader = new FileReader();
        textReader.readAsText(file);
        fileText = await new Promise((resolve) => {
          textReader.onload = () => resolve(textReader.result as string);
        });
      } catch (err) {
        console.warn('Could not extract text from file, continuing with upload');
      }

      // Create folder for user if it doesn't exist
      const filePath = `${user.id}/${file.name}`;
      
      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error('Failed to upload resume file');
      }
      
      // Get public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);
      
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
            file_name: file.name,
            file_url: publicUrl,
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
            file_name: file.name,
            file_url: publicUrl,
            text: fileText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      if (saveResult.error) {
        console.error('Error saving resume record:', saveResult.error);
        throw new Error('Failed to save resume information');
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
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([`${user.id}/${resume.file_name}`]);
      
      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }
      
      // Delete record from database
      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resume.id);
      
      if (dbError) {
        console.error('Error deleting resume record:', dbError);
        throw new Error('Failed to delete resume information');
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
