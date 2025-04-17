import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResumeStorage, deleteResumeFile } from './useResumeStorage';

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
  career_alignment_score?: number;
  target_role?: string;
  analysis?: any;
  initial_assessment?: string;
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
  const uploadResume = async (file: File): Promise<boolean> => {
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
      
      // Extract text from file for analysis
      let fileText = '';
      try {
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
      
      // Upload file to storage with a unique path
      const timestamp = Date.now();
      const uploadResult = await uploadResumeFile(file, user.id, `resume_${timestamp}`);
      
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
    if (!user || !resume) return false;

    try {
      try {
        const storageResult = await deleteResumeFile(user.id, resume.file_path);
        if (!storageResult) {
          console.warn('Could not delete file from storage, continuing with database deletion');
        }
      } catch (storageError) {
        console.warn('Error deleting from storage, continuing with database deletion:', storageError);
      }
      
      // Delete record from database
      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resume.id);
      
      if (dbError) {
        console.error('Error deleting resume record:', dbError);
        throw new Error('Failed to delete resume information from database');
      }
      
      // Clear the resume state
      setResume(null);
      
      // Also clear any cached analysis data
      localStorage.removeItem(`resume_analysis_${user.id}`);
      localStorage.removeItem(`resume_text_${user.id}`);
      
      toast({
        title: 'Success',
        description: 'Resume deleted successfully.',
      });
      
      // Refresh to get the next most recent resume if one exists
      await fetchResume();
      
      return true;
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete resume.',
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
    deleteResume,
    refreshResume: fetchResume
  };
};
// import { useState, useEffect, useRef } from 'react';
// import { supabase } from '@/integrations/supabase/client';
// import { useAuth } from '@/contexts/AuthContext';
// import { useToast } from '@/hooks/use-toast';
// import { useResumeStorage, deleteResumeFile } from './useResumeStorage';

// // Create cache outside of hook
// const signedUrlCache = new Map<string, string>();

// export interface Resume {
//   id: string;
//   user_id: string;
//   file_path: string;  // Database field
//   file_name?: string; // UI field (derived from file_path)
//   file_url?: string;  // UI field (generated)
//   text: string;
//   created_at?: string; // Optional since it's derived
//   uploaded_at?: string; // Database field
//   updated_at: string;
//   career_alignment_score?: number;
//   target_role?: string;
//   analysis?: any;
//   initial_assessment?: string;
// }

// // Helper function to check if the resumes table exists
// const checkResumesTableExists = async () => {
//   try {
//     // We'll check if the table exists by performing a query
//     const { error } = await supabase
//       .from('resumes')
//       .select('id')
//       .limit(1);
    
//     // If there's a PostgreSQL error specifically about relation not existing
//     if (error && error.code === '42P01') {
//       console.error("Resumes table does not exist:", error);
//       return false;
//     } else if (error) {
//       console.error("Error checking resumes table:", error);
//       return false;
//     } else {
//       console.log("Resumes table exists");
//       return true;
//     }
//   } catch (error) {
//     console.error("Error checking if resumes table exists:", error);
//     return false;
//   }
// };

// export const useResume = () => {
//   const [resume, setResume] = useState<Resume | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [uploading, setUploading] = useState(false);
//   const { user } = useAuth();
//   const { toast } = useToast();
//   const signedUrlCacheRef = useRef<Map<string, string>>(signedUrlCache);
//   const hasFetchedUrlRef = useRef<boolean>(false);
//   const hasFetchedResume = useRef(false);
  
//   // Import the storage functions directly rather than using the hook again
//   // This fixes the React error #321 (hooks can't be used conditionally)
//   const { uploadResumeFile, getResumeFileUrl, extractTextFromFile } = useResumeStorage();

//   // Load resume data when user changes
//   useEffect(() => {
//     if (user) {
//       fetchResume();
//     } else {
//       setResume(null);
//       setLoading(false);
//       hasFetchedResume.current = false; // Reset if user logs out or changes
//     }
//   }, [user]);

//   // Fetch resume data from Supabase
//   const fetchResume = async () => {
//     if (!user || hasFetchedResume.current) return;
//     hasFetchedResume.current = true;

//     try {
//       setLoading(true);
      
//       // Verify the table exists
//       const tableExists = await checkResumesTableExists();
//       if (!tableExists) {
//         console.error("Resumes table does not exist");
//         setResume(null);
//         setLoading(false);
//         return;
//       }
      
//       const { data, error } = await supabase
//         .from('resumes')
//         .select('*')
//         .eq('user_id', user.id)
//         .order('uploaded_at', { ascending: false }) // Order by latest
//         .limit(1) // Only take the latest one
//         .maybeSingle();
      
//       if (error) {
//         if (error.code !== 'PGRST116') { // No rows returned is not an error for us
//           console.error('Error fetching resume:', error);
//           toast({
//             title: 'Error',
//             description: 'Failed to load resume data.',
//             variant: 'destructive',
//           });
//         }
//         setResume(null);
//       } else if (data) {
//         // Transform database record to match Resume interface
//         const fileName = data.file_path.split('/').pop() || '';
        
//         // Get signed URL for the file
//         // let fileUrl = null;
//         // try {
//         //   fileUrl = await getResumeFileUrl(user.id, data.file_path);
//         // } catch (urlError) {
//         //   console.error('Error getting file URL:', urlError);
//         //   // We'll continue without the URL
//         // }

//         let fileUrl = null;
//         const fullPath = data.file_path;
        
//         if (signedUrlCacheRef.current.has(fullPath)) {
//           fileUrl = signedUrlCacheRef.current.get(fullPath)!;
//           console.log("Using cached signed URL:", fileUrl);
//         } else if (!hasFetchedUrlRef.current) {
//           try {
//             hasFetchedUrlRef.current = true;
//             fileUrl = await getResumeFileUrl(user.id, fullPath);
//             if (fileUrl) {
//               signedUrlCacheRef.current.set(fullPath, fileUrl);
//             }
//           } catch (urlError) {
//             console.error('Error getting file URL:', urlError);
//           }
//         }
        
//         setResume({
//           ...data,
//           file_name: fileName,
//           file_url: fileUrl,
//           created_at: data.uploaded_at // Use uploaded_at as created_at
//         });
        
//         console.log("Resume loaded successfully:", {
//           id: data.id,
//           hasText: !!data.text,
//           hasUrl: !!fileUrl,
//           hasAnalysis: !!data.analysis
//         });
//       } else {
//         setResume(null);
//       }
//     } catch (error) {
//       console.error('Error in fetchResume:', error);
//       toast({
//         title: 'Error',
//         description: 'An unexpected error occurred loading your resume.',
//         variant: 'destructive',
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Upload resume file to Supabase storage and record in database
//   // const uploadResume = async (file: File): Promise<boolean> => {
//   //   if (!user) {
//   //     toast({
//   //       title: 'Authentication required',
//   //       description: 'Please log in to upload a resume.',
//   //       variant: 'destructive',
//   //     });
//   //     return false;
//   //   }

//   //   try {
//   //     setUploading(true);
      
//   //     // Check if table exists
//   //     const tableExists = await checkResumesTableExists();
//   //     if (!tableExists) {
//   //       toast({
//   //         title: 'Setup Required',
//   //         description: 'Resume system is not properly configured. Please contact support.',
//   //         variant: 'destructive',
//   //       });
//   //       return false;
//   //     }
      
//   //     // Extract text from file for analysis
//   //     let fileText = '';
//   //     try {
//   //       fileText = await extractTextFromFile(file);
//   //       console.log("Successfully extracted text, length:", fileText.length);
//   //     } catch (extractError) {
//   //       console.warn('Could not extract text from file:', extractError);
//   //       try {
//   //         // Fallback to basic text extraction
//   //         const textReader = new FileReader();
//   //         textReader.readAsText(file);
//   //         fileText = await new Promise((resolve) => {
//   //           textReader.onload = () => resolve(textReader.result as string);
//   //         });
//   //         console.log("Used fallback text extraction, length:", fileText.length);
//   //       } catch (err) {
//   //         console.warn('Fallback text extraction also failed:', err);
//   //         // Continue with empty text - at least we can store the file
//   //         fileText = 'Text extraction failed. Please try again with a different file format.';
//   //       }
//   //     }
      
//   //     // Upload file to storage
//   //     const uploadResult = await uploadResumeFile(file, user.id);
      
//   //     if (!uploadResult.success) {
//   //       throw new Error('Failed to upload resume file to storage');
//   //     }
      
//   //     // Check if user already has a resume record
//   //     const { data: existingResume, error: fetchError } = await supabase
//   //       .from('resumes')
//   //       .select('id')
//   //       .eq('user_id', user.id)
//   //       .maybeSingle();
      
//   //     if (fetchError && fetchError.code !== 'PGRST116') {
//   //       console.error('Error checking for existing resume:', fetchError);
//   //       throw new Error('Failed to check for existing resume');
//   //     }
      
//   //     // let saveResult;
      
//   //     if (existingResume?.id) {
//   //       // console.log("Updating existing resume record");
//   //       console.log("Deleting existing resume record");

//   //        // Delete the old file from storage if it exists
//   //     if (existingResume.file_path) {
//   //       try {
//   //         await deleteResumeFile(user.id, existingResume.file_path);
//   //       } catch (storageError) {
//   //         console.warn('Error deleting old file from storage:', storageError);
//   //         // Continue with database deletion even if storage deletion fails
//   //       }
//   //     }
      
//   //     // Delete the record from the database
//   //     const { error: deleteError } = await supabase
//   //       .from('resumes')
//   //       .delete()
//   //       .eq('id', existingResume.id);
      
//   //     if (deleteError) {
//   //       console.error('Error deleting resume record:', deleteError);
//   //       throw new Error('Failed to delete existing resume');
//   //     }
      
//   //     // Clear any cached analysis data
//   //     localStorage.removeItem(`resume_analysis_${user.id}`);
//   //     localStorage.removeItem(`resume_text_${user.id}`);
//   //   }
//   //     //   // Update existing record
//   //     //   saveResult = await supabase
//   //     //     .from('resumes')
//   //     //     .update({
//   //     //       file_path: uploadResult.filePath,
//   //     //       text: fileText,
//   //     //       updated_at: new Date().toISOString()
//   //     //     })
//   //     //     .eq('id', existingResume.id);
//   //     // } else {
//   //     //   console.log("Creating new resume record");
//   //     //   // Insert new record
//   //     //   saveResult = await supabase
//   //     //     .from('resumes')
//   //     //     .insert({
//   //     //       user_id: user.id,
//   //     //       file_path: uploadResult.filePath,
//   //     //       text: fileText,
//   //     //       uploaded_at: new Date().toISOString(),
//   //     //       updated_at: new Date().toISOString()
//   //     //     });
//   //     // }
//   //     // Insert new record
//   //     console.log("Creating new resume record");
//   //     const saveResult = await supabase
//   //       .from('resumes')
//   //       .insert({
//   //         user_id: user.id,
//   //         file_path: uploadResult.filePath,
//   //         text: fileText,
//   //         uploaded_at: new Date().toISOString(),
//   //         updated_at: new Date().toISOString()
//   //       });
      
//   //     if (saveResult.error) {
//   //       console.error('Error saving resume record:', saveResult.error);
//   //       throw new Error('Failed to save resume information to database');
//   //     }
      
//   //     // Refresh resume data
//   //     await fetchResume();
      
//   //     toast({
//   //       title: 'Success',
//   //       description: 'Resume uploaded successfully.',
//   //     });
      
//   //     return true;
//   //   } catch (error) {
//   //     console.error('Error uploading resume:', error);
//   //     toast({
//   //       title: 'Upload Failed',
//   //       description: error.message || 'Failed to upload resume.',
//   //       variant: 'destructive',
//   //     });
//   //     return false;
//   //   } finally {
//   //     setUploading(false);
//   //   }
//   // };
//   const uploadResume = async (file: File): Promise<boolean> => {
//     if (!user) {
//       toast({
//         title: 'Authentication required',
//         description: 'Please log in to upload a resume.',
//         variant: 'destructive',
//       });
//       return false;
//     }
  
//     try {
//       setUploading(true);
      
//       // Check if table exists
//       const tableExists = await checkResumesTableExists();
//       if (!tableExists) {
//         toast({
//           title: 'Setup Required',
//           description: 'Resume system is not properly configured. Please contact support.',
//           variant: 'destructive',
//         });
//         return false;
//       }
      
//       // Extract text from file for analysis
//       let fileText = '';
//       try {
//         fileText = await extractTextFromFile(file);
//         console.log("Successfully extracted text, length:", fileText.length);
//       } catch (extractError) {
//         console.warn('Could not extract text from file:', extractError);
//         try {
//           // Fallback to basic text extraction
//           const textReader = new FileReader();
//           textReader.readAsText(file);
//           fileText = await new Promise((resolve) => {
//             textReader.onload = () => resolve(textReader.result as string);
//           });
//           console.log("Used fallback text extraction, length:", fileText.length);
//         } catch (err) {
//           console.warn('Fallback text extraction also failed:', err);
//           // Continue with empty text - at least we can store the file
//           fileText = 'Text extraction failed. Please try again with a different file format.';
//         }
//       }
      
//       // Upload file to storage
//       const uploadResult = await uploadResumeFile(file, user.id);
      
//       if (!uploadResult.success) {
//         throw new Error('Failed to upload resume file to storage');
//       }
      
//       // Check if user already has a resume record
//       const { data: existingResume, error: fetchError } = await supabase
//         .from('resumes')
//         .select('id, file_path')
//         .eq('user_id', user.id)
//         .maybeSingle();
      
//       if (fetchError && fetchError.code !== 'PGRST116') {
//         console.error('Error checking for existing resume:', fetchError);
//         throw new Error('Failed to check for existing resume');
//       }
      
//       // Handle existing resume case
//       if (existingResume?.id) {
//         console.log("Updating existing resume record");
        
//         // Delete the old file from storage if it exists and is different from the new one
//         if (existingResume.file_path && existingResume.file_path !== uploadResult.filePath) {
//           try {
//             await deleteResumeFile(user.id, existingResume.file_path);
//             console.log("Deleted old resume file from storage");
//           } catch (storageError) {
//             console.warn('Error deleting old file from storage:', storageError);
//             // Continue with database update even if storage deletion fails
//           }
//         }
        
//         // Update the existing record instead of deleting and reinserting
//         // Reset all analysis-related fields to null to ensure fresh analysis
//         const { error: updateError } = await supabase
//           .from('resumes')
//           .update({
//             file_path: uploadResult.filePath,
//             text: fileText,
//             updated_at: new Date().toISOString(),
//             uploaded_at: new Date().toISOString(),
//             analysis: null,
//             career_alignment_score: null,
//             target_role: null,
//             initial_assessment: null
//           })
//           .eq('id', existingResume.id);
        
//         if (updateError) {
//           console.error('Error updating resume record:', updateError);
//           throw new Error('Failed to update resume information in database');
//         }
        
//         console.log("Successfully updated existing resume record");
//       } else {
//         // Insert new record if no existing resume
//         console.log("Creating new resume record");
//         const { error: insertError } = await supabase
//           .from('resumes')
//           .insert({
//             user_id: user.id,
//             file_path: uploadResult.filePath,
//             text: fileText,
//             uploaded_at: new Date().toISOString(),
//             updated_at: new Date().toISOString()
//           });
        
//         if (insertError) {
//           console.error('Error saving resume record:', insertError);
//           throw new Error('Failed to save resume information to database');
//         }
        
//         console.log("Successfully created new resume record");
//       }
      
//       // Clear any cached analysis data since we have a new resume
//       localStorage.removeItem(`resume_analysis_${user.id}`);
//       localStorage.removeItem(`resume_text_${user.id}`);
      
//       // Refresh resume data
//       await fetchResume();
      
//       toast({
//         title: 'Success',
//         description: 'Resume uploaded successfully.',
//       });
      
//       return true;
//     } catch (error) {
//       console.error('Error uploading resume:', error);
//       toast({
//         title: 'Upload Failed',
//         description: error.message || 'Failed to upload resume.',
//         variant: 'destructive',
//       });
//       return false;
//     } finally {
//       setUploading(false);
//     }
//   };
//   // Delete resume from storage and database
//   const deleteResume = async (): Promise<boolean> => {
//     if (!user || !resume) return false;

//     try {
//       try {
//         const storageResult = await deleteResumeFile(user.id, resume.file_path);
//         if (!storageResult) {
//           console.warn('Could not delete file from storage, continuing with database deletion');
//         }
//       } catch (storageError) {
//         console.warn('Error deleting from storage, continuing with database deletion:', storageError);
//       }
      
//       // Delete record from database
//       const { error: dbError } = await supabase
//         .from('resumes')
//         .delete()
//         .eq('id', resume.id);
      
//       if (dbError) {
//         console.error('Error deleting resume record:', dbError);
//         throw new Error('Failed to delete resume information from database');
//       }
      
//       // Clear the resume state
//       setResume(null);
      
//       // Also clear any cached analysis data
//       localStorage.removeItem(`resume_analysis_${user.id}`);
//       localStorage.removeItem(`resume_text_${user.id}`);
      
//       toast({
//         title: 'Success',
//         description: 'Resume deleted successfully.',
//       });
      
//       return true;
//     } catch (error) {
//       console.error('Error deleting resume:', error);
//       toast({
//         title: 'Delete Failed',
//         description: error.message || 'Failed to delete resume.',
//         variant: 'destructive',
//       });
//       return false;
//     }
//   };

//   return {
//     resume,
//     loading,
//     uploading,
//     uploadResume,
//     deleteResume,
//     refreshResume: fetchResume
//   };
// };
