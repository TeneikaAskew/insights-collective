
// import { useState } from 'react';
// import { supabase } from '@/integrations/supabase/client';
// import { useToast } from '@/hooks/use-toast';
// import { useAuth } from '@/contexts/AuthContext';

// /**
//  * Extracts text content from PDF or DOCX files
//  */
// export const extractTextFromFile = async (file: File): Promise<string> => {
//   try {
//     // Check file type and use appropriate extraction method
//     if (file.type === 'application/pdf') {
//       const pdfjs = await import('pdfjs-dist');
//       // Configure PDF.js worker
//       pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
      
//       const arrayBuffer = await file.arrayBuffer();
//       const pdfData = new Uint8Array(arrayBuffer);
      
//       // Load the PDF document
//       const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      
//       let fullText = '';
      
//       // Extract text from each page
//       for (let i = 1; i <= pdf.numPages; i++) {
//         const page = await pdf.getPage(i);
//         const textContent = await page.getTextContent();
//         const pageText = textContent.items
//           .map((item: any) => item.str)
//           .join(' ');
        
//         fullText += pageText + '\n';
//       }
      
//       return fullText;
//     } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
//       // For DOCX files
//       const mammoth = await import('mammoth');
      
//       const arrayBuffer = await file.arrayBuffer();
//       const result = await mammoth.extractRawText({ arrayBuffer });
//       return result.value;
//     } else {
//       throw new Error("Unsupported file type. Only PDF and DOCX are supported.");
//     }
//   } catch (error) {
//     console.error('Error extracting text from file:', error);
//     throw new Error(`Failed to extract text from file: ${error.message}`);
//   }
// };

// // Define the return type for uploadResumeFile
// interface UploadResult {
//   fileName: string;
//   filePath: string;
//   success: boolean;
// }

// export function useResumeStorage() {
//   const [uploading, setUploading] = useState(false);
//   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
//   const { toast } = useToast();
//   const { user } = useAuth();

//   const uploadResumeFile = async (file: File, userId: string): Promise<UploadResult> => {
//     if (!userId) {
//       toast({
//         title: "Authentication required",
//         description: "Please log in to upload a resume",
//         variant: "destructive",
//       });
//       return { fileName: '', filePath: '', success: false };
//     }

//     setUploading(true);

//     try {
//       console.log("Starting file upload process for user:", userId);
      
//       // Create a unique file name (no nested paths)
//       const fileExtension = file.name.split('.').pop() || '';
//       const fileName = `resume_${Date.now()}.${fileExtension}`;
      
//       console.log("Uploading to Resumes bucket with file name:", fileName);
      
//       // Upload file to Supabase Storage - using simpler path strategy
//       const { data, error } = await supabase.storage
//         .from('Resumes') // Note the capital 'R'
//         .upload(fileName, file, { upsert: true });
      
//       if (error) {
//         console.error("Upload error details:", JSON.stringify(error));
//         throw error;
//       }
      
//       console.log("Upload successful, file path:", data?.path);
      
//       return {
//         fileName,
//         filePath: fileName, // Using the simple file name as the path
//         success: true
//       };
//     } catch (error) {
//       console.error('Error uploading resume:', error);
      
//       toast({
//         title: "Upload failed",
//         description: "Failed to upload your resume. Please try again.",
//         variant: "destructive",
//       });
      
//       return {
//         fileName: '',
//         filePath: '',
//         success: false
//       };
//     } finally {
//       setUploading(false);
//     }
//   };

//   const deleteResumeFile = async (userId: string, filePath: string): Promise<boolean> => {
//     if (!userId) return false;
    
//     try {
//       console.log("Deleting file from Resumes bucket:", filePath);
      
//       const { error } = await supabase.storage
//         .from('Resumes') // Note the capital 'R'
//         .remove([filePath]);
      
//       if (error) {
//         console.error("Delete error details:", JSON.stringify(error));
//         throw error;
//       }
      
//       setDownloadUrl(null);
      
//       toast({
//         title: "Resume deleted",
//         description: "Your resume has been removed from storage.",
//       });
      
//       return true;
//     } catch (error) {
//       console.error('Error deleting resume:', error);
      
//       toast({
//         title: "Delete failed",
//         description: "Failed to delete your resume. Please try again.",
//         variant: "destructive",
//       });
      
//       return false;
//     }
//   };

//   const getResumeFileUrl = async (userId: string, filePath: string): Promise<string> => {
//     if (!userId || !filePath) return '';
    
//     try {
//       console.log("Getting signed URL from Resumes bucket for:", filePath);
      
//       // Use createSignedUrl instead of getPublicUrl for better security
//       const { data, error } = await supabase.storage
//         .from('Resumes') // Note the capital 'R'
//         .createSignedUrl(filePath, 3600); // URL valid for 1 hour (3600 seconds)
      
//       if (error) {
//         console.error("Error creating signed URL:", JSON.stringify(error));
//         return '';
//       }
      
//       console.log("Retrieved signed URL:", data?.signedUrl);
//       return data?.signedUrl || '';
//     } catch (error) {
//       console.error('Error getting resume URL:', error);
//       return '';
//     }
//   };

//   return {
//     uploading,
//     downloadUrl,
//     uploadResumeFile,
//     deleteResumeFile,
//     getResumeFileUrl,
//     extractTextFromFile
//   };
// }



import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';

export function useResumeStorage() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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
  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf') {
      return extractTextFromPDF(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return extractTextFromDOCX(file);
    } else {
      throw new Error('Unsupported file type. Only PDF and DOCX are supported.');
    }
  };

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
        .from('Resumes')
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