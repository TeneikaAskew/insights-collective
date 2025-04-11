
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

// Export the text extraction function so it can be imported elsewhere
export const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    if (file.type === 'application/pdf') {
      return await extractTextFromPDF(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(file);
    } else {
      throw new Error('Unsupported file type. Only PDF and DOCX are supported.');
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
};

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

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // const uploadResumeFile = async (file: File, userId: string) => {
  //   setUploading(true);
  //   try {
  //     // Use consistent naming format with timestamp
  //     const timestamp = Date.now();
  //     const fileName = `resume_${timestamp}.${file.name.split('.').pop()}`;
  //     const filePath = `${userId}/${fileName}`;
      
  //     // Upload file to Storage
  //     const { error: uploadError } = await supabase
  //       .storage
  //       .from('Resumes')
  //       .upload(filePath, file);
        
  //     if (uploadError) throw uploadError;
      
  //     // Check if user already has a resume record
  //     const { data: existingResume, error: fetchError } = await supabase
  //       .from('resumes')
  //       .select('id')
  //       .eq('user_id', userId)
  //       .maybeSingle();
      
  //     if (fetchError) throw fetchError;
      
  //     if (existingResume) {
  //       // Update existing record
  //       const { error } = await supabase
  //         .from('resumes')
  //         .update({ 
  //           file_path: fileName,
  //           updated_at: new Date().toISOString()
  //         })
  //         .eq('id', existingResume.id);
          
  //       if (error) throw error;
  //     } else {
  //       // Create new record
  //       const { error } = await supabase
  //         .from('resumes')
  //         .insert({
  //           user_id: userId,
  //           file_path: fileName
  //         });
          
  //       if (error) throw error;
  //     }
      
  //     return { fileName, filePath, timestamp, success: true };
  //   } catch (error) {
  //     console.error('Error uploading resume file:', error);
  //     toast({
  //       title: 'Error',
  //       description: 'Failed to upload resume file. Please try again.',
  //       variant: 'destructive',
  //     });
  //     return { success: false };
  //   } finally {
  //     setUploading(false);
  //   }
  // };
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
    console.log("Starting file upload process for user:", userId);
    
    // Create a unique file name (no nested paths)
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `resume_${Date.now()}.${fileExtension}`;
    
    console.log("Uploading to resumes bucket with file name:", fileName);
    
    // Upload file to Supabase Storage - using simpler path strategy and lowercase bucket name
    const { data, error } = await supabase.storage
      .from('resumes') // LOWERCASE 'r' - critical change!
      .upload(fileName, file, { upsert: true });
    
    if (error) {
      console.error("Upload error details:", JSON.stringify(error));
      throw error;
    }
    
    console.log("Upload successful, file path:", data?.path);
    
    return {
      fileName,
      filePath: fileName, // Using the simple file name as the path
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
  const getResumeFileUrl = async (userId: string, filePath: string) => {
    try {
      // Important: Use the correct bucket name (Resumes with capital R)
      // and construct the correct file path
      console.log("Getting signed URL for path:", `${userId}/${filePath}`);
      
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('resumes')  // Use the correct bucket name with capital R
        .createSignedUrl(`${userId}/${filePath}`, 3600); // 1 hour expiry
        
      if (fileError) {
        console.error("Error creating signed URL:", JSON.stringify(fileError));
        return null;
      }
      
      console.log("Successfully created signed URL:", fileData?.signedUrl);
      return fileData?.signedUrl;
    } catch (error) {
      console.error('Error getting resume file URL:', error);
      return null;
    }
  };
  
  const deleteResumeFile = async (userId: string, filePath: string) => {
    try {
      console.log("Deleting file at path:", `${userId}/${filePath}`);
      
      const { error: deleteFileError } = await supabase
        .storage
        .from('resumes')  // Use the correct bucket name with capital R
        .remove([`${userId}/${filePath}`]);
        
      if (deleteFileError) {
        console.error("Error deleting file:", JSON.stringify(deleteFileError));
        throw deleteFileError;
      }
      
      setDownloadUrl(null);
      return true;
    } catch (error) {
      console.error('Error deleting resume file:', error);
      return false;
    }
  };

  return {
    uploading,
    downloadUrl,
    uploadResumeFile,
    getResumeFileUrl,
    deleteResumeFile,
    extractTextFromFile  // Make sure to export this function in the returned object!
  };
}
