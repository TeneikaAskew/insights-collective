import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import ResumeChat from '@/components/resume/ResumeChat';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
import { extractTextFromFile } from '@/hooks/resume/useResumeStorage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Resume = () => {
  // Add a debug helper function
  const logDebug = (area, message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][${area}] ${message}`, data || '');
  };

  const {
    user,
    isAuthenticated
  } = useAuth();
  const {
    toast
  } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const {
    resume,
    loading: resumeLoading,
    uploading,
    uploadResume,
    deleteResume,
    refreshResume
  } = useResume();
  const {
    analysis,
    isAnalyzing,
    analyzeResume,
    careerAlignments,
    setAnalysis
  } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingEnhancedBullets, setIsLoadingEnhancedBullets] = useState(false);
  const subscriptionRef = useRef(null);
  const currentResumeIdRef = useRef(null);
  const hasLoadedEnhancedRef = useRef(false);

  // Set up and clean up real-time subscription with better logging
  useEffect(() => {
    if (!user || !resume) {
      logDebug('Subscription', 'Missing user or resume data for subscription', { hasUser: !!user, hasResume: !!resume });
      return;
    }
    
    if (subscriptionRef.current) {
      logDebug('Subscription', 'Subscription already exists, not creating a new one');
      return;
    }

    // Store the current resume ID to filter updates
    if (resume.id) {
      currentResumeIdRef.current = resume.id;
      logDebug('Subscription', `Setting current resume ID: ${resume.id}`);
    } else {
      logDebug('Subscription', 'Resume object has no ID!', resume);
    }

    logDebug('Subscription', `Setting up subscription for user ${user.id} and resume ${currentResumeIdRef.current}`);

    // Set up real-time subscription with proper filters
    const channel = supabase
      .channel('enhanced-analysis-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'resumes',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          logDebug('Subscription', 'Received update event:', payload);
          
          // If we have a current resume ID, check that we're processing the right resume
          if (currentResumeIdRef.current && payload.new.id !== currentResumeIdRef.current) {
            logDebug('Subscription', `Ignoring update for different resume: ${payload.new.id} vs current ${currentResumeIdRef.current}`);
            return;
          }
          
          // Only process if enhanced_analysis has been updated
          if (payload.new && payload.new.enhanced_analysis) {
            logDebug('Subscription', 'Enhanced analysis update received', payload.new.enhanced_analysis);
            handleEnhancedAnalysisUpdate(payload.new.enhanced_analysis);
          } else {
            logDebug('Subscription', 'Update received but no enhanced_analysis found in payload', payload.new);
          }
        }
      )
      .subscribe((status) => {
        logDebug('Subscription', `Subscription status: ${status}`);
      });

    subscriptionRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      logDebug('Subscription', 'Cleaning up subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, resume]);

  // Handle updates to enhanced_analysis with better logging
  const handleEnhancedAnalysisUpdate = (enhancedAnalysis) => {
    logDebug('EnhancedUpdate', 'Starting handleEnhancedAnalysisUpdate');
    
    if (!enhancedAnalysis) {
      logDebug('EnhancedUpdate', 'No enhanced analysis data provided');
      return;
    }
    
    if (!analysis) {
      logDebug('EnhancedUpdate', 'No analysis object to update');
      return;
    }
    
    if (hasLoadedEnhancedRef.current) {
      logDebug('EnhancedUpdate', 'Enhanced bullets already loaded, skipping update');
      return;
    }

    logDebug('EnhancedUpdate', 'Processing enhanced analysis update', enhancedAnalysis);
    
    try {
      // Check if the enhanced analysis has rewritten bullets and is an array
      if (Array.isArray(enhancedAnalysis) && enhancedAnalysis.length > 0) {
        logDebug('EnhancedUpdate', `Found ${enhancedAnalysis.length} enhanced bullets`);
        
        // Debug original bullets
        logDebug('EnhancedUpdate', 'Original bullets', analysis.bullets);
        
        // Update the analysis with enhanced bullets
        const updatedBullets = analysis.bullets.map(bullet => {
          // Find matching enhanced bullet
          const enhanced = enhancedAnalysis.find(item => item.original === bullet.original);
          if (enhanced) {
            logDebug('EnhancedUpdate', `Found match for bullet: ${bullet.original.substring(0, 30)}...`);
            return {
              ...bullet,
              rewritten: enhanced.rewritten || bullet.original,
              tips: enhanced.tips || []
            };
          }
          logDebug('EnhancedUpdate', `No enhanced match found for bullet: ${bullet.original.substring(0, 30)}...`);
          return bullet;
        });

        logDebug('EnhancedUpdate', 'Updated bullets', updatedBullets);

        setAnalysis({
          ...analysis,
          bullets: updatedBullets
        });

        logDebug('EnhancedUpdate', 'Setting hasLoadedEnhancedRef to true');
        hasLoadedEnhancedRef.current = true;
        
        toast({
          title: 'Resume Bullet Improvements Ready',
          description: 'Your resume bullets have been enhanced with AI improvements.',
          variant: 'default'
        });
      } else {
        logDebug('EnhancedUpdate', 'Enhanced analysis is not an array or is empty', enhancedAnalysis);
      }
    } catch (err) {
      logDebug('EnhancedUpdate', 'Error processing enhanced bullets:', err);
      console.error("Error processing enhanced bullets:", err);
    }

    // Done loading enhanced bullets
    logDebug('EnhancedUpdate', 'Setting isLoadingEnhancedBullets to false');
    setIsLoadingEnhancedBullets(false);
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      logDebug('InitialData', 'Starting loadInitialData');
      if (initialLoadComplete || !user) {
        logDebug('InitialData', 'Skipping initial load', { initialLoadComplete, hasUser: !!user });
        return;
      }
      try {
        logDebug('InitialData', 'Clearing storage error and refreshing resume');
        setStorageError(null);
        await refreshResume();
        setInitialLoadComplete(true);
        logDebug('InitialData', 'Initial data load complete');
      } catch (err) {
        logDebug('InitialData', 'Error in initial data load:', err);
        console.error("Error in initial data load:", err);
        if (err.message?.includes('bucket') || err.message?.includes('storage')) {
          setStorageError("Resume storage is not properly configured. Please contact support.");
          logDebug('InitialData', 'Setting storage error');
        }
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
      logDebug('InitialData', 'Component unmounted, setting isMounted to false');
    };
  }, [user, initialLoadComplete, refreshResume]);

  useEffect(() => {
    logDebug('AnalysisLoader', 'Checking if analysis should be loaded from resume', {
      hasResumeAnalysis: !!resume?.analysis,
      hasAnalysis: !!analysis,
      hasLoadedAnalysis,
      hasUser: !!user
    });
    
    if (resume?.analysis && !analysis && !hasLoadedAnalysis && user) {
      try {
        logDebug('AnalysisLoader', 'Setting analysis from resume', resume.analysis);
        setAnalysis(resume.analysis);
        setHasLoadedAnalysis(true);
        
        // If resume has an ID, store it
        if (resume.id) {
          currentResumeIdRef.current = resume.id;
          logDebug('AnalysisLoader', `Setting current resume ID: ${resume.id}`);
        } else {
          logDebug('AnalysisLoader', 'Resume has no ID!');
        }
        
        // Reset enhanced bullets flag when loading a new analysis
        hasLoadedEnhancedRef.current = false;
        logDebug('AnalysisLoader', 'Reset hasLoadedEnhancedRef to false');
      } catch (err) {
        logDebug('AnalysisLoader', 'Error setting analysis from resume:', err);
        console.error("Error setting analysis from resume:", err);
      }
    }
  }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

  // Initial load of enhanced analysis
  useEffect(() => {
    const loadEnhancedAnalysis = async () => {
      logDebug('InitialLoad', 'Starting loadEnhancedAnalysis check');
      
      if (!user) {
        logDebug('InitialLoad', 'No user, skipping enhanced analysis load');
        return;
      }
      
      if (!analysis) {
        logDebug('InitialLoad', 'No analysis, skipping enhanced analysis load');
        return;
      }
      
      if (!resume || !resume.id) {
        logDebug('InitialLoad', 'No resume or resume ID, skipping enhanced analysis load', resume);
        return;
      }
      
      if (hasLoadedEnhancedRef.current) {
        logDebug('InitialLoad', 'Enhanced bullets already loaded, skipping load');
        return;
      }

      logDebug('InitialLoad', `Loading enhanced analysis for resume ID: ${resume.id}`);
      
      try {
        setIsLoadingEnhancedBullets(true);
        
        // Query specifically by resume ID to ensure we get the right one
        logDebug('InitialLoad', `Querying Supabase for enhanced_analysis with resume ID: ${resume.id}`);
        const { data, error } = await supabase
          .from('resumes')
          .select('enhanced_analysis')
          .eq('id', resume.id)
          .maybeSingle();

        if (error) {
          logDebug('InitialLoad', 'Error fetching enhanced analysis:', error);
          console.error("Error fetching enhanced analysis:", error);
          setIsLoadingEnhancedBullets(false);
          return;
        }

        if (data?.enhanced_analysis) {
          logDebug('InitialLoad', 'Found enhanced analysis data', data.enhanced_analysis);
          handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        } else {
          // No enhanced analysis yet
          logDebug('InitialLoad', `No enhanced bullets yet for resume ${resume.id}`);
          console.log("No enhanced bullets yet for resume", resume.id);
          setIsLoadingEnhancedBullets(false);
        }
      } catch (err) {
        logDebug('InitialLoad', 'Error loading enhanced analysis:', err);
        console.error("Error loading enhanced analysis:", err);
        setIsLoadingEnhancedBullets(false);
      }
    };

    loadEnhancedAnalysis();
  }, [user, analysis, resume]);

  useEffect(() => {
    logDebug('FileHandler', 'File change detected', { hasFile: !!resumeFile });
    
    if (!resumeFile) {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
        logDebug('FileHandler', 'Revoked PDF preview URL');
      }
      setExtractedText(null);
      logDebug('FileHandler', 'Cleared extracted text');
      return;
    }

    logDebug('FileHandler', `Processing file of type ${resumeFile.type}`);
    
    let blobUrl: string | null = null;
    if (resumeFile.type === 'application/pdf') {
      blobUrl = URL.createObjectURL(resumeFile);
      setPdfPreviewUrl(blobUrl);
      logDebug('FileHandler', 'Created PDF preview URL');
    } else {
      setPdfPreviewUrl(null);
      logDebug('FileHandler', 'No PDF preview URL needed for this file type');
    }

    if (!extractedText) {
      logDebug('FileHandler', 'No extracted text, starting extraction');
      (async () => {
        try {
          logDebug('FileHandler', 'Extracting text from file');
          const text = await extractTextFromFile(resumeFile);
          setExtractedText(text);
          logDebug('FileHandler', 'Text extraction successful', { textLength: text?.length });
        } catch (err) {
          logDebug('FileHandler', 'Error extracting text:', err);
          console.error(err);
          toast({
            title: 'Extraction failed',
            description: 'Could not extract text from your resume.',
            variant: 'destructive'
          });
        }
      })();
    }

    return () => {
      if (pdfPreviewUrl && resumeFile?.type === 'application/pdf' && blobUrl) { // Added blobUrl check
        URL.revokeObjectURL(blobUrl);
        setPdfPreviewUrl(null);
        logDebug('FileHandler', 'Cleanup: Revoked PDF preview URL');
      }
    };
  }, [resumeFile, toast, extractedText, pdfPreviewUrl]); // Added extractedText and pdfPreviewUrl to dependencies

  useEffect(() => {
    logDebug('AnalysisRunner', 'Checking if analysis needs to be run', {
      hasResumeText: !!resume?.text,
      hasAnalysis: !!analysis,
      isAnalyzing,
      hasLoadedAnalysis,
      initialLoadComplete
    });
    
    if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
      logDebug('AnalysisRunner', 'Starting analysis of resume text');
      analyzeResume(resume.text).then(success => {
        if (success) {
          logDebug('AnalysisRunner', 'Analysis completed successfully');
          setHasLoadedAnalysis(true);
          setIsLoadingEnhancedBullets(true); // Start waiting for enhanced bullets
          logDebug('AnalysisRunner', 'Set isLoadingEnhancedBullets to true');
          
          // Reset enhanced bullets flag when loading a new analysis
          hasLoadedEnhancedRef.current = false;
          logDebug('AnalysisRunner', 'Reset hasLoadedEnhancedRef to false');
        } else {
          logDebug('AnalysisRunner', 'Analysis did not complete successfully');
        }
      }).catch(err => {
        logDebug('AnalysisRunner', 'Error analyzing resume:', err);
        console.error("Error analyzing resume:", err);
      });
    }
  }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    logDebug('UserAction', 'File input changed', { hasFile: !!file, fileType: file?.type });
    
    if (!file) return;
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      logDebug('UserAction', 'Setting valid resume file');
      setResumeFile(file);
      setHasLoadedAnalysis(false); // Reset analysis loaded flag
      setAnalysis(null); // Clear current analysis
      setExtractedText(null); // Clear extracted text to trigger re-extraction
      
      // Reset enhanced bullets flag when uploading a new file
      hasLoadedEnhancedRef.current = false;
      logDebug('UserAction', 'Reset hasLoadedEnhancedRef due to new file');
    } else {
      logDebug('UserAction', 'Invalid file type rejected');
      toast({
        title: 'Invalid type',
        description: 'Only PDF or DOCX allowed.',
        variant: 'destructive'
      });
    }
  };

  const handleUpload = async () => {
    logDebug('UserAction', 'Upload requested', { hasFile: !!resumeFile, hasText: !!extractedText });
    
    if (!resumeFile || !extractedText) {
      logDebug('UserAction', 'Cannot upload - missing file or text');
      toast({
        title: 'Wait',
        description: 'Still extracting text or no file selected.',
        variant: 'destructive'
      });
      return;
    }
    
    logDebug('UserAction', 'Starting upload process');
    setHasLoadedAnalysis(false);
    setAnalysis(null); // Clear current analysis before upload
    setStorageError(null);
    
    // Reset enhanced bullets flag
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for upload');
    
    try {
      logDebug('UserAction', 'Calling uploadResume');
      const ok = await uploadResume(resumeFile, extractedText);
      
      if (ok) {
        logDebug('UserAction', 'Upload successful');
        
        // The resume state should be updated by useResume hook after upload
        // We expect 'resume' to be the new resume here.
        // The currentResumeIdRef will be updated by the subscription effect if 'resume' changes.
        
        try {
          logDebug('UserAction', 'Starting analysis after upload with newly uploaded resume text');
          // Ensure we are using the text from the *newly uploaded* resume, which should be in `resume.text`
          // The `resume` object itself is updated by `uploadResume` -> `fetchResume`
          // So, `resume.text` should be the correct one to analyze.
          // However, `analyzeResume` is called with `extractedText` which might be from the *previous* file if not careful.
          // Let's rely on the `resume` object being up-to-date from `uploadResume` via `fetchResume`.
          // The useEffect for AnalysisRunner will pick up the new `resume.text`.
          // Forcing analysis here might be redundant or use stale `extractedText`.
          // Let's ensure `resume` is updated and then AnalysisRunner handles it.
          // For now, we can still trigger analysis if `resume.text` is available.
          if (resume?.text) {
             await analyzeResume(resume.text); // Use text from the potentially new resume object
             logDebug('UserAction', 'Analysis completed after upload');
             setHasLoadedAnalysis(true);
             setIsLoadingEnhancedBullets(true); 
             logDebug('UserAction', 'Set isLoadingEnhancedBullets to true after upload');
          } else {
            logDebug('UserAction', 'Resume text not available immediately after upload for analysis trigger.');
          }

        } catch (error) {
          logDebug('UserAction', 'Analysis error after upload:', error);
          toast({
            title: 'Analysis Error',
            description: 'Resume was uploaded but analysis failed. You can try again later.',
            variant: 'destructive'
          });
        }
      } else {
        logDebug('UserAction', 'Upload returned not OK');
      }
    } catch (error) {
      logDebug('UserAction', 'Upload error:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
        logDebug('UserAction', 'Setting storage error');
      } else {
        toast({ // Generic error for other upload failures
            title: 'Upload Failed',
            description: error.message || 'An unexpected error occurred during upload.',
            variant: 'destructive'
        });
      }
    }
  };

  const handleDelete = async () => {
    logDebug('UserAction', 'Delete requested');
    
    try {
      if (resume) {
        logDebug('UserAction', 'Calling deleteResume');
        await deleteResume(); // This will also clear relevant caches in useResume
      }
      
      logDebug('UserAction', 'Resetting all resume-related state');
      setResumeFile(null);
      // pdfPreviewUrl is handled by resumeFile useEffect cleanup
      setExtractedText(null);
      setShowCareerChat(false);
      setAnalysis(null);
      setHasLoadedAnalysis(false);
      setIsLoadingEnhancedBullets(false);
      
      // Reset enhanced bullets flag and resume ID
      hasLoadedEnhancedRef.current = false;
      currentResumeIdRef.current = null; // Important to clear this
      logDebug('UserAction', 'Reset hasLoadedEnhancedRef and currentResumeIdRef after delete');

      // No need to manually clear cache here, deleteResume in useResume handles it.
    } catch (error) {
      logDebug('UserAction', 'Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete resume. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = () => {
    logDebug('UserAction', 'Download requested', { hasFileUrl: !!resume?.file_url });
    if (resume?.file_url) window.open(resume.file_url, '_blank');
  };

  const handleStartCareerChat = () => {
    logDebug('UserAction', 'Career chat requested');
    setShowCareerChat(true);
  };

  const handleRefreshData = async () => {
    logDebug('UserAction', 'Refresh data requested');
    setIsRefreshing(true);
    setHasLoadedAnalysis(false); // This will re-trigger analysis if resume text exists
    setAnalysis(null); // Clear current analysis to ensure it's re-fetched or re-analyzed
    setStorageError(null);
    
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for refresh');

    if (user) {
      logDebug('UserAction', 'Clearing local storage cache for refresh');
      localStorage.removeItem(`resume_analysis_${user.id}`);
      localStorage.removeItem(`resume_text_${user.id}`);
      localStorage.removeItem(`resume_data_${user.id}`); // Ensure this key is consistent if used elsewhere
    }
    
    try {
      logDebug('UserAction', 'Calling refreshResume');
      await refreshResume(); // This fetches the latest resume record
      
      // After refreshResume, the `resume` state variable will update.
      // The useEffect for 'AnalysisLoader' will try to load analysis from `resume.analysis`.
      // The useEffect for 'AnalysisRunner' will try to run analysis if `resume.text` exists and no analysis loaded.
      // The useEffect for 'InitialLoad of enhanced analysis' will try to load enhanced bullets.

      // Explicitly check for enhanced analysis after refresh if resume object is available
      if (resume && resume.id) { // Check if resume object itself is populated by refreshResume
        logDebug('UserAction', `Post-refresh: Checking for enhanced analysis for resume ID: ${resume.id}`);
        const { data, error } = await supabase
          .from('resumes')
          .select('enhanced_analysis')
          .eq('id', resume.id)
          .maybeSingle();
          
        if (error) {
          logDebug('UserAction', 'Post-refresh: Error fetching enhanced analysis:', error);
        } else if (data?.enhanced_analysis) {
          logDebug('UserAction', 'Post-refresh: Found enhanced analysis');
          handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        } else {
          logDebug('UserAction', 'Post-refresh: No enhanced analysis found, will wait for subscription or manual check');
          // If no enhanced_analysis, but we have basic analysis, we might still be waiting for it.
          // Set isLoadingEnhancedBullets if we expect them.
          if (analysis && !hasLoadedEnhancedRef.current) {
            setIsLoadingEnhancedBullets(true);
          }
        }
      } else {
        logDebug('UserAction', 'Post-refresh: No resume ID available for enhanced analysis check');
      }
      
      logDebug('UserAction', 'Refresh completed successfully');
      toast({
        title: 'Refreshed',
        description: 'Resume data has been refreshed.'
      });
    } catch (error) {
      logDebug('UserAction', 'Refresh error:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
        logDebug('UserAction', 'Setting storage error during refresh');
      }
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh resume data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
      logDebug('UserAction', 'Finished refresh, set isRefreshing to false');
    }
  };

  const handleCheckEnhancements = async () => {
    if (!user || !resume || !resume.id) {
      logDebug('CheckEnhancements', 'Missing user, resume or resume ID', { 
        hasUser: !!user, 
        hasResume: !!resume, 
        resumeId: resume?.id 
      });
      toast({ title: 'Cannot Check', description: 'No active resume to check for improvements.', variant: 'default'});
      return;
    }
    
    logDebug('CheckEnhancements', `Manually checking enhancements for resume ID: ${resume.id}`);
    setIsLoadingEnhancedBullets(true);
    hasLoadedEnhancedRef.current = false; // Allow re-processing if new data comes
    
    try {
      // Query specifically by resume ID
      logDebug('CheckEnhancements', 'Querying Supabase for enhanced_analysis');
      const { data, error } = await supabase
        .from('resumes')
        .select('enhanced_analysis')
        .eq('id', resume.id)
        .maybeSingle();

      if (error) {
        logDebug('CheckEnhancements', 'Error querying enhanced_analysis:', error);
        throw error;
      }

      logDebug('CheckEnhancements', 'Received response from Supabase', { 
        hasData: !!data, 
        hasEnhancedAnalysis: !!(data?.enhanced_analysis),
        enhancedAnalysisType: data?.enhanced_analysis ? typeof data.enhanced_analysis : 'none',
        isArray: data?.enhanced_analysis ? Array.isArray(data.enhanced_analysis) : false,
        length: data?.enhanced_analysis && Array.isArray(data.enhanced_analysis) ? data.enhanced_analysis.length : 0
      });

      if (data?.enhanced_analysis) {
        logDebug('CheckEnhancements', 'Found enhanced analysis, passing to handler');
        handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        
        // Only show "Loaded" if hasLoadedEnhancedRef became true
        if(hasLoadedEnhancedRef.current) {
          toast({
            title: 'Improvements Loaded',
            description: 'Your resume bullet improvements have been applied.',
            variant: 'default'
          });
        } else {
           toast({
            title: 'Processing Improvements',
            description: 'Found new improvement data, applying now...',
            variant: 'default'
          });
          // handleEnhancedAnalysisUpdate should set isLoadingEnhancedBullets to false once done
        }
      } else {
        logDebug('CheckEnhancements', 'No enhanced analysis found in response');
        toast({
          title: 'No New Improvements',
          description: 'No improved bullets found yet. They may still be processing or already applied.',
          variant: 'default'
        });
        setIsLoadingEnhancedBullets(false);
      }
    } catch (err) {
      logDebug('CheckEnhancements', 'Error checking for enhancements:', err);
      console.error("Error checking for enhancements:", err);
      toast({
        title: 'Error Loading Improvements',
        description: 'Could not load enhanced bullets. Please try again later.',
        variant: 'destructive'
      });
      setIsLoadingEnhancedBullets(false);
    }
  };

  if (!isAuthenticated) {
    logDebug('Render', 'User not authenticated, showing login wall');
    return <ResumeLoginWall />;
  }

  const loading = resumeLoading || isRefreshing; // Removed isAnalyzing from here, as it's handled by ResumeAnalysisSection
  logDebug('Render', 'Rendering main component', { 
    loading, 
    resumeLoading, 
    isAnalyzing, 
    isRefreshing,
    isLoadingEnhancedBullets,
    hasAnalysis: !!analysis,
    hasResume: !!resume,
    hasLoadedAnalysis
  });

  return (
    <AppLayout fullWidth>
      <div className="mx-auto py-6 space-y-6 px-6 max-w-full">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Resume Management</h1>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCheckEnhancements} 
              disabled={loading || isAnalyzing || isLoadingEnhancedBullets || !resume} // Disable if no resume
            >
              {isLoadingEnhancedBullets ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading Improvements...
                </>
              ) : (
                <>Check for Improvements</>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshData} 
              disabled={loading || isAnalyzing} // Disable if analyzing too
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>

        {storageError && <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Storage Error</AlertTitle>
            <AlertDescription>
              {storageError}
            </AlertDescription>
          </Alert>}

        {careerAlignments && careerAlignments.length > 0 && (
          <div className="space-y-2">
            {careerAlignments.map((alignment, index) => (
              <Alert
                key={index}
                className={`${index === 0 ? "bg-accent/20 border border-accent" : "bg-slate-50 border border-slate-200"}`}
              >
                <AlertDescription>
                  {alignment.description}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Single section layout with the analysis section */}
        <ResumeAnalysisSection
          loading={loading} // Pass overall loading state
          isAnalyzing={isAnalyzing} // Pass specific isAnalyzing state
          isLoadingEnhancedBullets={isLoadingEnhancedBullets} // Pass enhanced bullets loading state
          analysis={analysis}
          resume={resume}
          handleStartCareerChat={handleStartCareerChat}
          handleFileChange={handleFileChange}
          hasAnalysis={!!analysis && hasLoadedAnalysis} // Ensure analysis is loaded
          resumeFile={resumeFile}
          pdfPreviewUrl={pdfPreviewUrl}
          uploading={uploading}
          handleUpload={handleUpload}
          handleDelete={handleDelete}
          handleDownload={handleDownload}
          fileError={storageError}
        />

        {showCareerChat && analysis && <ResumeChat resumeAnalysis={analysis} />}

      </div>
    </AppLayout>
  );
};

export default Resume;
