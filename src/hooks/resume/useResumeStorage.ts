
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const uploadResumeFile = async (file: File, userId: string) => {
    setUploading(true);
    try {
      // Use consistent naming format with timestamp
      const timestamp = Date.now();
      const fileName = `resume_${timestamp}.pdf`;
      const filePath = `${userId}/${fileName}`;
      
      // Upload file to Storage
      const { error: uploadError } = await supabase
        .storage
        .from('resumes')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      return { fileName, filePath, timestamp, success: true };
    } catch (error) {
      console.error('Error uploading resume file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload resume file. Please try again.',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setUploading(false);
    }
  };
  
  const getResumeFileUrl = async (userId: string, filePath: string) => {
    try {
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('resumes')
        .createSignedUrl(`${userId}/${filePath}`, 3600); // 1 hour expiry
        
      if (fileError) throw fileError;
      return fileData?.signedUrl;
    } catch (error) {
      console.error('Error getting resume file URL:', error);
      return null;
    }
  };
  
  const deleteResumeFile = async (userId: string, filePath: string) => {
    try {
      const { error: deleteFileError } = await supabase
        .storage
        .from('resumes')
        .remove([`${userId}/${filePath}`]);
        
      if (deleteFileError) throw deleteFileError;
      return true;
    } catch (error) {
      console.error('Error deleting resume file:', error);
      return false;
    }
  };

  return {
    uploading,
    uploadResumeFile,
    getResumeFileUrl,
    deleteResumeFile
  };
}
