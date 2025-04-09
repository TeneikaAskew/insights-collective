
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

interface Resume {
  id: string;
  user_id: string;
  file_path: string;
  analysis: any;
  career_alignment_score: number;
  target_role: string;
  uploaded_at: string;
  updated_at: string;
  file_url?: string;
}

export function useResume() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchResume = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get resume record
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      
      if (data) {
        // Get download URL for the resume file
        const { data: fileData, error: fileError } = await supabase
          .storage
          .from('resumes')
          .createSignedUrl(`${user.id}/${data.file_path}`, 3600); // 1 hour expiry
          
        if (fileError) throw fileError;
        
        setResume({
          ...data,
          file_url: fileData?.signedUrl
        });
      } else {
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

  useEffect(() => {
    fetchResume();
  }, [user, toast]);

  const uploadResume = async (file: File) => {
    if (!user) return null;
    
    setUploading(true);
    try {
      const fileName = `resume_${Date.now()}.pdf`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload file to Storage
      const { error: uploadError } = await supabase
        .storage
        .from('resumes')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Mock analysis - in a real app this would be done by an AI service
      const mockAnalysis = {
        strengths: [
          'Strong technical skill presentation',
          'Relevant project experience',
          'Clear educational background'
        ],
        improvements: [
          'Add more quantifiable achievements',
          'Highlight data analysis tools more prominently',
          'Consider adding a skills section'
        ],
        careerAlignment: 'Your resume is well-aligned with the Data Analyst role, but could be improved by highlighting SQL skills and data visualization experience more prominently.'
      };
      
      // Check if user already has a resume
      const { data: existingResume } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existingResume) {
        // Update existing resume
        const { error: updateError } = await supabase
          .from('resumes')
          .update({
            file_path: fileName,
            analysis: mockAnalysis,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResume.id);
          
        if (updateError) throw updateError;
      } else {
        // Insert new resume
        const { error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_path: fileName,
            analysis: mockAnalysis,
            career_alignment_score: 72,
            target_role: 'Data Analyst'
          });
          
        if (insertError) throw insertError;
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
      const { error: deleteFileError } = await supabase
        .storage
        .from('resumes')
        .remove([`${user.id}/${resume.file_path}`]);
        
      if (deleteFileError) throw deleteFileError;
      
      // Delete record from database
      const { error: deleteRecordError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resume.id);
        
      if (deleteRecordError) throw deleteRecordError;
      
      setResume(null);
      
      toast({
        title: "Resume deleted",
        description: "Your resume has been removed.",
      });
      
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
    uploading,
    uploadResume,
    deleteResume
  };
}
