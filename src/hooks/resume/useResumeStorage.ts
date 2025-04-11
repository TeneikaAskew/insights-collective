
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

// Interface for upload result
export interface UploadResult {
  fileName: string;
  filePath: string;
  success: boolean;
}

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

// Check if storage bucket exists and create it if not
const ensureStorageBucketExists = async () => {
  try {
    // Try to get bucket
    const { data: bucket, error } = await supabase.storage.getBucket('resumes');
    
    if (error && error.message.includes('The resource was not found')) {
      console.log('Resumes bucket not found, creating it...');
      
      // Create bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket('resumes', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('Error creating resumes bucket:', createError);
        throw new Error('Failed to create storage bucket for resumes');
      }
      
      console.log('Successfully created resumes bucket');
    } else if (error) {
      console.error('Error checking resumes bucket:', error);
      throw error;
    } else {
      console.log('Resumes bucket exists');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
};

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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
      
      // Ensure bucket exists
      await ensureStorageBucketExists();
      
      // Create a unique file name with user ID folder structure
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${userId}/resume_${Date.now()}.${fileExtension}`;
      
      console.log("Uploading file to path:", fileName);
      
      // Try to upload the file directly without checking for bucket existence
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, file, { upsert: true });
      
      if (error) {
        // If bucket doesn't exist, this is likely the issue
        console.error("Upload error details:", error);
        
        if (error.message?.includes("Bucket not found")) {
          toast({
            title: "Storage Setup Required",
            description: "Resume storage is not configured. Please contact support.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Upload Failed",
            description: "There was an error uploading your file. Please try again.",
            variant: "destructive",
          });
        }
        
        throw error;
      }
      
      console.log("Upload successful, file path:", data?.path);
      
      return {
        fileName: fileName.split('/').pop() || '',
        filePath: fileName,
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
      // Make sure the path is correctly formed
      const fullPath = filePath.includes(userId) ? filePath : `${userId}/${filePath}`;
      console.log("Getting signed URL for path:", fullPath);
      
      // Ensure storage bucket exists
      await ensureStorageBucketExists();
      
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('resumes')
        .createSignedUrl(fullPath, 3600); // 1 hour expiry
        
      if (fileError) {
        console.error("Error creating signed URL:", fileError);
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
      // Ensure path is correctly formatted
      const fullPath = filePath.includes(userId) ? filePath : `${userId}/${filePath}`;
      console.log("Deleting file at path:", fullPath);
      
      // Ensure storage bucket exists
      await ensureStorageBucketExists();
      
      const { error: deleteFileError } = await supabase
        .storage
        .from('resumes')
        .remove([fullPath]);
        
      if (deleteFileError) {
        console.error("Error deleting file:", deleteFileError);
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
    extractTextFromFile
  };
}
