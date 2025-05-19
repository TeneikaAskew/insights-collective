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
    console.log("Starting PDF text extraction");
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Load the PDF document
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    console.log(`PDF loaded, pages: ${pdf.numPages}`);
    
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
    
    console.log(`PDF text extraction complete, total length: ${fullText.length}`);
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

// Extract text from DOCX file
const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    console.log("Starting DOCX text extraction");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    console.log(`DOCX text extraction complete, total length: ${result.value.length}`);
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

// Simplified bucket check that doesn't try to create the bucket if it doesn't exist
const checkBucketExists = async (): Promise<boolean> => {
  try {
    // Instead of listing all buckets, try to get details of the specific bucket
    // This is more reliable and avoids permission issues with listing all buckets
    const { data, error } = await supabase
      .storage
      .from('resumes')
      .list('', { limit: 1 });
      
    // If we can list files, the bucket exists and we have access
    if (!error) {
      console.log('Successfully accessed resumes bucket');
      return true;
    }
    
    // Check for specific error messages that indicate the bucket doesn't exist
    if (error.message.includes('bucket') && error.message.toLowerCase().includes('not found')) {
      console.log('Resumes bucket not found');
      return false;
    }
    
    // Log any other errors but assume the bucket might exist
    console.error('Error checking bucket access:', error);
    return false;
  } catch (error) {
    console.error('Unexpected error checking bucket access:', error);
    return false;
  }
};


// Export this function directly so it can be imported elsewhere
export const deleteResumeFile = async (userId: string, filePath: string) => {
  try {
    // Ensure path is correctly formatted
    const fullPath = filePath.includes(userId) ? filePath : `${userId}/${filePath}`;
    console.log("Deleting file at path:", fullPath);
    
    // Check if bucket exists but don't try to create it
    const bucketExists = await checkBucketExists();
    if (!bucketExists) {
      console.error('Storage bucket does not exist');
      return false;
    }
    
    const { error: deleteFileError } = await supabase
      .storage
      .from('resumes')
      .remove([fullPath]);
      
    if (deleteFileError) {
      console.error("Error deleting file:", deleteFileError);
      throw deleteFileError;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting resume file:', error);
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
      
      // Check if bucket exists but don't try to create it
      const bucketExists = await checkBucketExists();
      if (!bucketExists) {
        toast({
          title: "Storage Setup Required",
          description: "Resume storage is not configured properly. Please contact support.",
          variant: "destructive",
        });
        throw new Error("Storage bucket does not exist");
      }
      
      // Create a unique file name with user ID folder structure
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${userId}/resume_${Date.now()}.${fileExtension}`;
      
      console.log("Uploading file to path:", fileName);
      
      // Upload the file
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, file, { 
          upsert: true,
          // Fix for Firefox auto-downloading: set content-type correctly and cacheControl
          contentType: file.type,
          cacheControl: '3600'
        });
      
      if (error) {
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
      
      // Check if bucket exists but don't try to create it
      const bucketExists = await checkBucketExists();
      if (!bucketExists) {
        console.error('Storage bucket does not exist');
        return null;
      }
      
      // Try to get a signed URL with proper headers to fix Firefox downloading
      try {
        // Use the correct options for createSignedUrl
        const { data: fileData, error: fileError } = await supabase
          .storage
          .from('resumes')
          .createSignedUrl(fullPath, 3600, { 
            download: false,  // Don't force download
            transform: {} // Empty transform object
          });
          
        if (fileError) {
          console.error("Error creating signed URL:", fileError);
          return null;
        }
        
        // Add the content-disposition inline parameter to the URL
        const signedUrl = fileData?.signedUrl;
        const updatedUrl = signedUrl ? 
          signedUrl + (signedUrl.includes('?') ? '&' : '?') + 'response-content-disposition=inline' 
          : null;
        
        console.log("Successfully created signed URL:", updatedUrl);
        return updatedUrl;
      } catch (urlError) {
        console.error("Error creating signed URL:", urlError);
        return null;
      }
    } catch (error) {
      console.error('Error getting resume file URL:', error);
      return null;
    }
  };
  
  // Keep the function in the hook for backward compatibility
  const deleteResumeFileHook = async (userId: string, filePath: string) => {
    const result = await deleteResumeFile(userId, filePath);
    if (result) {
      setDownloadUrl(null);
    }
    return result;
  };

  return {
    uploading,
    downloadUrl,
    uploadResumeFile,
    getResumeFileUrl,
    deleteResumeFile: deleteResumeFileHook,
    extractTextFromFile
  };
}
