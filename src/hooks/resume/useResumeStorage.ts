import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

// Extract text from PDF file
const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Load the PDF document
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    
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
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

// Extract text from DOCX file
const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

// Extract text from either PDF or DOCX file
export const extractTextFromFile = async (file: File): Promise<string> => {
  if (file.type === 'application/pdf') {
    return extractTextFromPDF(file);
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDOCX(file);
  } else {
    throw new Error('Unsupported file type. Only PDF and DOCX are supported.');
  }
};

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const uploadResumeFile = async (file: File, userId: string) => {
    setUploading(true);
    try {
      // Use consistent naming format with timestamp
      const timestamp = Date.now();
      const fileName = `resume_${timestamp}.${file.name.split('.').pop()}`;
      const filePath = `${userId}/${fileName}`;
      
      // Upload file to Storage
      const { error: uploadError } = await supabase
        .storage
        .from('resumes')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Check if user already has a resume record
      const { data: existingResume, error: fetchError } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (existingResume) {
        // Update existing record
        const { error } = await supabase
          .from('resumes')
          .update({ 
            file_path: fileName,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResume.id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('resumes')
          .insert({
            user_id: userId,
            file_path: fileName
          });
          
        if (error) throw error;
      }
      
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
    deleteResumeFile,
    extractTextFromFile
  };
}
