
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
      // 1. First extract text from file (PDF or DOCX)
      const resumeText = await extractTextFromFile(file);
      
      // 2. Upload file to storage
      const { fileName, filePath, success: uploadSuccess } = await uploadResumeFile(file, user.id);
      
      if (!uploadSuccess) {
        return false;
      }
      
      // 3. Store additional information in the database
      let resumeId = null;
      
      // Check if user already has a resume
      const { data: existingResume } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let operationSuccess = false;
      
      // Mock analysis - in a real app this would be done by an AI service
      const mockAnalysis = {
        resume_percent: 78,
        letter_grade: "B",
        themes: [
          'Add more quantifiable achievements',
          'Highlight data analysis tools more prominently',
          'Consider adding a skills section'
        ],
        elevator_pitch: "Experienced professional with a strong track record in data analysis and visualization, demonstrating expertise in transforming raw data into actionable insights that drive business decisions.",
        explanation: "Your resume shows strong technical skills but could benefit from more quantifiable achievements to demonstrate your impact. Consider adding specific metrics and results from your past roles.",
        bullets: []
      };
      
      if (existingResume) {
        // Update existing resume with extracted text
        operationSuccess = await updateResumeRecord(user.id, {
          file_path: fileName,
          text: resumeText,
          analysis: mockAnalysis,
          updated_at: new Date().toISOString()
        });
      } else {
        // Insert new resume with text field
        operationSuccess = await createResumeRecord({
          user_id: user.id,
          file_path: fileName,
          text: resumeText,
          analysis: mockAnalysis,
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
    extractTextFromFile
  };
}
