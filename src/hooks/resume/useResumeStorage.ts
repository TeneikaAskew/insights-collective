
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Extracts text content from PDF or DOCX files
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    // Check file type and use appropriate extraction method
    if (file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist');
      // Configure PDF.js worker
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfData = new Uint8Array(arrayBuffer);
      
      // Load the PDF document
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      return fullText;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX files
      const mammoth = await import('mammoth');
      
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else {
      throw new Error("Unsupported file type. Only PDF and DOCX are supported.");
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
};

// Define the return type for uploadResumeFile
interface UploadResult {
  fileName: string;
  filePath: string;
  success: boolean;
}

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadResumeFile = async (file: File, userId: string): Promise<UploadResult> => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload a resume",
        variant: "destructive",
      });
      return { fileName: '', filePath: '', success: false };
    }

    setUploading(true);

    try {
      // Create a unique file path for this user's resume
      const fileName = file.name;
      const filePath = `Resumes/${userId}/${fileName}`;
      
      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('Resumes')
        .upload(filePath, file, { upsert: true });
      
      if (error) throw error;
      
      // Get public URL for the file
      const { data: urlData } = supabase.storage
        .from('Resumes')
        .getPublicUrl(filePath);
      
      setDownloadUrl(urlData.publicUrl);
      
      toast({
        title: "Resume uploaded",
        description: "Your resume has been successfully uploaded.",
      });
      
      return {
        fileName,
        filePath,
        success: true
      };
    } catch (error) {
      console.error('Error uploading resume:', error);
      
      toast({
        title: "Upload failed",
        description: "Failed to upload your resume. Please try again.",
        variant: "destructive",
      });
      
      return {
        fileName: '',
        filePath: '',
        success: false
      };
    } finally {
      setUploading(false);
    }
  };

  const deleteResumeFile = async (userId: string, filePath: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const { error } = await supabase.storage
        .from('Resumes')
        .remove([filePath]);
      
      if (error) throw error;
      
      setDownloadUrl(null);
      
      toast({
        title: "Resume deleted",
        description: "Your resume has been removed from storage.",
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting resume:', error);
      
      toast({
        title: "Delete failed",
        description: "Failed to delete your resume. Please try again.",
        variant: "destructive",
      });
      
      return false;
    }
  };

  const getResumeFileUrl = async (userId: string, filePath: string): Promise<string> => {
    if (!userId || !filePath) return '';
    
    try {
      const { data } = supabase.storage
        .from('Resumes')
        .getPublicUrl(filePath);
      
      return data?.publicUrl || '';
    } catch (error) {
      console.error('Error getting resume URL:', error);
      return '';
    }
  };

  return {
    uploading,
    downloadUrl,
    uploadResumeFile,
    deleteResumeFile,
    getResumeFileUrl,
    extractTextFromFile
  };
}
