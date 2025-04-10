
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage } from './useResumeStorage';
import { useResumeData } from './useResumeData';
import { supabase } from '@/integrations/supabase/client';

export function useResume() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    uploading: fileUploading, 
    uploadResumeFile, 
    deleteResumeFile,
    extractTextFromFile
  } = useResumeStorage();
  
  const {
    resume,
    loading,
    fetchResume,
    updateResumeRecord,
    createResumeRecord,
    deleteResumeRecord
  } = useResumeData();

  const uploadResume = async (file: File) => {
    if (!user) return false;
    
    setUploading(true);
    try {
      console.log("Starting resume upload process");
      
      // 1. First extract text from file (PDF or DOCX)
      const resumeText = await extractTextFromFile(file);
      console.log("Text extracted from resume, length:", resumeText?.length || 0);
      
      // 2. Upload file to storage
      const { fileName, filePath, success: uploadSuccess } = await uploadResumeFile(file, user.id);
      
      if (!uploadSuccess) {
        console.error("File upload failed");
        throw new Error("Failed to upload file");
      }
      
      console.log("File uploaded successfully:", fileName);
      
      // 3. Store additional information in the database
      // Check if user already has a resume
      const { data: existingResume } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let operationSuccess = false;
      
      if (existingResume) {
        console.log("Updating existing resume:", existingResume.id);
        // Update existing resume with extracted text
        operationSuccess = await updateResumeRecord(user.id, {
          file_path: fileName,
          text: resumeText,
          updated_at: new Date().toISOString()
        });
      } else {
        console.log("Creating new resume record");
        // Insert new resume with text field
        operationSuccess = await createResumeRecord({
          user_id: user.id,
          file_path: fileName,
          text: resumeText,
          career_alignment_score: 72,
          target_role: 'Data Analyst'
        });
      }
      
      if (!operationSuccess) {
        throw new Error('Failed to update database record');
      }
      
      toast({
        title: "Upload successful",
        description: "Your resume has been uploaded and analyzed.",
      });
      
      // Refresh resume data
      await fetchResume();
      return true;
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload resume. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUploading(false);
    }
  };
  
  const deleteResume = async () => {
    if (!user || !resume) return false;
    
    try {
      console.log("Starting resume deletion process");
      
      // Delete file from storage
      const success = await deleteResumeFile(user.id, resume.file_path);
      
      if (!success) {
        throw new Error('Failed to delete file from storage');
      }
      
      // Delete record from database
      const recordDeleted = await deleteResumeRecord(resume.id);
      
      if (!recordDeleted) {
        throw new Error('Failed to delete database record');
      }
      
      toast({
        title: "Resume deleted",
        description: "Your resume has been removed.",
      });
      
      // Refresh resume data
      await fetchResume();
      return true;
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete resume. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    resume,
    loading,
    uploading: uploading || fileUploading,
    uploadResume,
    deleteResume,
    refreshResume: fetchResume
  };
}
