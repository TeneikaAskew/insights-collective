import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage, deleteResumeFile } from './useResumeStorage';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
// Create cache outside of hook
const signedUrlCache = new Map<string, string>();

export interface Resume {
  id: string;
  user_id: string;
  file_path: string;  // Database field
  file_name?: string; // UI field (derived from file_path)
  file_url?: string;  // UI field (generated)
  text: string;
  created_at?: string; // Optional since it's derived
  uploaded_at?: string; // Database field
  updated_at: string;
  analysis?: any;
  resume_roast?: string;
}

// Helper function to check if the resumes table exists
const checkResumesTableExists = async () => {
  try {
    // We'll check if the table exists by performing a query
    const { error } = await supabase
      .from('resumes')
      .select('id')
      .limit(1);
    
    // If there's a PostgreSQL error specifically about relation not existing
    if (error && error.code === '42P01') {
      console.error("Resumes table does not exist:", error);
      return false;
    } else if (error) {
      console.error("Error checking resumes table:", error);
      return false;
    } else {
      console.log("Resumes table exists");
      return true;
    }
  } catch (error) {
    console.error("Error checking if resumes table exists:", error);
    return false;
  }
};

export const useResume = () => {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const signedUrlCacheRef = useRef<Map<string, string>>(signedUrlCache);
  const hasFetchedUrlRef = useRef<boolean>(false);
  const hasFetchedResume = useRef(false);
  
  // Import the storage functions directly rather than using the hook again
  // This fixes the React error #321 (hooks can't be used conditionally)
  const { uploadResumeFile, getResumeFileUrl, extractTextFromFile } = useResumeStorage();

  const {
    analysis,
    isAnalyzing,
    analyzeResume,
    careerAlignments,
    setAnalysis,
    isPollingForImprovements,
    setIsPollingForImprovements,
    pollingStatus,
    setPollingStatus,
    pollingAttempt
  } = useResumeAnalysis();

  // Load resume data when user changes
  useEffect(() => {
    if (user) {
      fetchResume();
    } else {
      setResume(null);
      setLoading(false);
      hasFetchedResume.current = false; // Reset if user logs out or changes
    }
  }, [user]);

  // Fetch resume data from Supabase - always get the latest record
  const fetchResume = async () => {
    if (!user) return;
    
    // Reset the fetch status to allow refetching
    hasFetchedResume.current = true;

    try {
      setLoading(true);
      
      // Verify the table exists
      const tableExists = await checkResumesTableExists();
      if (!tableExists) {
        console.error("Resumes table does not exist");
        setResume(null);
        setLoading(false);
        return;
      }
      
      // Get the latest resume record for this user
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false }) // Order by latest
        .limit(1) // Only take the latest one
        .maybeSingle();
      
      if (error) {
        if (error.code !== 'PGRST116') { // No rows returned is not an error for us
          console.error('Error fetching resume:', error);
          toast({
            title: 'Error',
            description: 'Failed to load resume data.',
            variant: 'destructive',
          });
        }
        setResume(null);
      } else if (data) {
        // Transform database record to match Resume interface
        const fileName = data.file_path.split('/').pop() || '';
        
        // Get signed URL for the file
        let fileUrl = null;
        const fullPath = data.file_path;
        
        if (signedUrlCacheRef.current.has(fullPath)) {
          fileUrl = signedUrlCacheRef.current.get(fullPath)!;
          console.log("Using cached signed URL:", fileUrl);
        } else {
          try {
            // Reset the fetch flag since we're fetching a new URL
            hasFetchedUrlRef.current = false;
            fileUrl = await getResumeFileUrl(user.id, fullPath);
            if (fileUrl) {
              signedUrlCacheRef.current.set(fullPath, fileUrl);
              console.log("Cached new signed URL for:", fullPath);
            }
          } catch (urlError) {
            console.error('Error getting file URL:', urlError);
          }
        }
        
        setResume({
          ...data,
          file_name: fileName,
          file_url: fileUrl,
          created_at: data.uploaded_at // Use uploaded_at as created_at
        });
        
        console.log("Resume loaded successfully:", {
          id: data.id,
          hasText: !!data.text,
          hasUrl: !!fileUrl,
          hasAnalysis: !!data.analysis
        });
      } else {
        setResume(null);
      }
    } catch (error) {
      console.error('Error in fetchResume:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred loading your resume.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload resume file to Supabase storage and ALWAYS create a new record
  const uploadResume = async (file: File, preExtractedText?: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to upload a resume.',
        variant: 'destructive',
      });
      return false;
    }
  
    try {
      setUploading(true);
      
      // Check if table exists
      const tableExists = await checkResumesTableExists();
      if (!tableExists) {
        toast({
          title: 'Setup Required',
          description: 'Resume system is not properly configured. Please contact support.',
          variant: 'destructive',
        });
        return false;
      }
      
      // // Extract text from file for analysis
      // let fileText = '';
      // try {
      //   fileText = await extractTextFromFile(file);
      //   console.log("Successfully extracted text, length:", fileText.length);
      // } catch (extractError) {
      //   console.warn('Could not extract text from file:', extractError);
      //   try {
      //     // Fallback to basic text extraction
      //     const textReader = new FileReader();
      //     textReader.readAsText(file);
      //     fileText = await new Promise((resolve) => {
      //       textReader.onload = () => resolve(textReader.result as string);
      //     });
      //     console.log("Used fallback text extraction, length:", fileText.length);
      //   } catch (err) {
      //     console.warn('Fallback text extraction also failed:', err);
      //     // Continue with empty text - at least we can store the file
      //     fileText = 'Text extraction failed. Please try again with a different file format.';
      //   }
      // }
        // Extract text from file for analysis (only if not provided)
        let fileText = preExtractedText || '';
        
        if (!fileText) {
          try {
            console.log("No pre-extracted text provided, extracting now...");
            fileText = await extractTextFromFile(file);
            console.log("Successfully extracted text, length:", fileText.length);
          } catch (extractError) {
            console.warn('Could not extract text from file:', extractError);
            try {
              // Fallback to basic text extraction
              const textReader = new FileReader();
              textReader.readAsText(file);
              fileText = await new Promise((resolve) => {
                textReader.onload = () => resolve(textReader.result as string);
              });
              console.log("Used fallback text extraction, length:", fileText.length);
            } catch (err) {
              console.warn('Fallback text extraction also failed:', err);
              // Continue with empty text - at least we can store the file
              fileText = 'Text extraction failed. Please try again with a different file format.';
            }
          }
        } else {
          console.log("Using pre-extracted text, length:", fileText.length);
        }

      // Upload file to storage with a unique path
      const timestamp = Date.now();
      const uploadResult = await uploadResumeFile(file, user.id);
      
      if (!uploadResult.success) {
        throw new Error('Failed to upload resume file to storage');
      }
      
      // ALWAYS create a new record
      console.log("Creating new resume record");
      const { data: newResume, error: insertError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_path: uploadResult.filePath,
          text: fileText,
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating new resume record:', insertError);
        throw new Error('Failed to save resume information to database');
      }
      
      console.log("Successfully created new resume record:", newResume?.id);
      
      // Clear any cached analysis data since we have a new resume
      localStorage.removeItem(`resume_analysis_${user.id}`);
      localStorage.removeItem(`resume_text_${user.id}`);
      
      // Verify the record was created and wait for it to be available
      const verifyNewRecord = async (): Promise<boolean> => {
        try {
          const { data: verifyData, error: verifyError } = await supabase
            .from('resumes')
            .select('id, text')
            .eq('id', newResume.id)
            .single();
          
          if (verifyError) {
            console.error("Verification error:", verifyError);
            return false;
          }
          
          console.log("Record verified with text length:", verifyData?.text?.length || 0);
          return !!verifyData && !!verifyData.text;
        } catch (error) {
          console.error("Verification failed:", error);
          return false;
        }
      };
      
      // Wait for record to be available with retry
      let verified = false;
      for (let i = 0; i < 3; i++) {
        verified = await verifyNewRecord();
        if (verified) break;
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between retries
      }
      
      if (!verified) {
        console.warn("Could not verify new record was created properly");
      }
      
      // Refresh resume data to get the latest record
      await fetchResume();
      
      toast({
        title: 'Success',
        description: 'Resume uploaded successfully.',
      });
      
      return true;
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload resume.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Delete resume from storage and database
  const deleteResume = async (): Promise<boolean> => {
    if (!user || !resume) {
      console.error("Cannot delete: missing user or resume");
      return false;
    }
  
    try {
      console.log(`=== RESUME DELETION STARTED ===`);
      console.log(`Resume ID: ${resume.id}`);
      console.log(`User ID: ${user.id}`);
      console.log(`File path: ${resume.file_path}`);
      
      // First, clear local storage caches associated with this resume
      console.log(`Clearing localStorage cache for user ${user.id}...`);
      localStorage.removeItem(`resume_analysis_${user.id}`);
      localStorage.removeItem(`resume_text_${user.id}`);
      localStorage.removeItem(`resume_data_${user.id}`);
  
      // Also clear any URL cache
      signedUrlCacheRef.current.clear();
      console.log(`Cleared URL cache`);
  
      // First try to delete the file from storage
      try {
        console.log(`Attempting to delete file from storage: ${resume.file_path}`);
        // Fix here: deleteResumeFile expects 2 args, but 3 were provided causing TS error.
        // So ensure only 2 args are passed: userId and filePath
        const storageResult = await deleteResumeFile(user.id, resume.file_path);
        if (!storageResult) {
          console.warn(`Could not delete file from storage: ${resume.file_path}`);
        } else {
          console.log(`Successfully deleted file from storage: ${resume.file_path}`);
        }
      } catch (storageError) {
        console.warn(`Error deleting file from storage: ${resume.file_path}`, storageError);
      }
      
      // Delete record from database using ID rather than user_id
      // console.log(`Deleting resume with ID: ${resume.id} from database...`);
      // const { data, error: dbError } = await supabase
      //   .from('resumes')
      //   .delete()
      //   .eq('id', resume.id)
      //   .select();

      console.log(`Deleting all resumes for user ID: ${user.id} from database...`);
      const { data, error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('user_id', user.id)  // Changed to delete all resume records
        .select();
      
      if (dbError) {
        console.error(`Database error deleting resume ID ${resume.id}:`, dbError);
        throw new Error(`Failed to delete resume from database: ${dbError.message}`);
      }
      
      console.log(`Database response:`, data);
      console.log(`Successfully deleted resume record from database. Resume ID: ${resume.id}`);
      
      // Clear the resume state
      setResume(null);
      console.log(`Reset resume state to null`);
      
      // Reset fetching flags to allow refetching
      hasFetchedResume.current = false;
      hasFetchedUrlRef.current = false;
      
      toast({
        title: 'Success',
        description: 'Resume deleted successfully.',
      });
      
      console.log(`=== RESUME DELETION COMPLETED SUCCESSFULLY ===`);
      
      // Refresh to get the next most recent resume if one exists
      console.log(`Fetching next most recent resume if available...`);
      await fetchResume();
      
      return true;
    } catch (error) {
      console.error(`=== RESUME DELETION FAILED ===`);
      console.error('Error details:', error);
      
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete resume.',
        variant: 'destructive',
      });
      
      // Even on error, let's still clear localStorage and attempt to refresh
      try {
        localStorage.removeItem(`resume_analysis_${user.id}`);
        localStorage.removeItem(`resume_text_${user.id}`);
        hasFetchedResume.current = false;
        await fetchResume();
      } catch (cleanupError) {
        console.error('Error during cleanup after failed deletion:', cleanupError);
      }
      
      return false;
    }
  };

  return {
    resume,
    loading,
    uploading,
    uploadResume,
    deleteResume,
    refreshResume: fetchResume
  };
};
