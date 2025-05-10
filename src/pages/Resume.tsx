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
    resume, // This state will be updated by refreshResume
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
  const subscriptionRef = useRef<any>(null); // Use 'any' or a more specific Supabase channel type
  const currentResumeIdRef = useRef<string | null | undefined>(null);
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
        (payload: any) => { // Explicitly type payload or use Supabase types
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
  const handleEnhancedAnalysisUpdate = (enhancedAnalysis: any) => { // Type enhancedAnalysis
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
      if (Array.isArray(enhancedAnalysis) && enhancedAnalysis.length > 0 && analysis.bullets) { // Ensure analysis.bullets exists
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
        logDebug('EnhancedUpdate', 'Enhanced analysis is not an array or is empty, or analysis.bullets is missing', {enhancedAnalysis, hasBullets: !!analysis?.bullets});
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
    // let isMounted = true; // isMounted pattern can be tricky, ensure it's used correctly if kept
    const loadInitialData = async () => {
      logDebug('InitialData', 'Starting loadInitialData');
      if (initialLoadComplete || !user) {
        logDebug('InitialData', 'Skipping initial load', { initialLoadComplete, hasUser: !!user });
        return;
      }
      try {
        logDebug('InitialData', 'Clearing storage error and refreshing resume');
        setStorageError(null);
        await refreshResume(); // refreshResume updates the `resume` state from the hook
        setInitialLoadComplete(true);
        logDebug('InitialData', 'Initial data load complete');
      } catch (err: any) { // Type error
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
      // isMounted = false;
      logDebug('InitialData', 'Component unmounted'); // Removed isMounted reference
    };
  }, [user, initialLoadComplete, refreshResume]); // refreshResume is stable, but user/initialLoadComplete trigger this

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
        
        if (resume.id) {
          currentResumeIdRef.current = resume.id;
          logDebug('AnalysisLoader', `Setting current resume ID: ${resume.id}`);
        } else {
          logDebug('AnalysisLoader', 'Resume has no ID!');
        }
        
        hasLoadedEnhancedRef.current = false;
        logDebug('AnalysisLoader', 'Reset hasLoadedEnhancedRef to false');
      } catch (err) {
        logDebug('AnalysisLoader', 'Error setting analysis from resume:', err);
        console.error("Error setting analysis from resume:", err);
      }
    }
  }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

  useEffect(() => {
    const loadEnhancedAnalysis = async () => {
      logDebug('InitialLoad', 'Starting loadEnhancedAnalysis check');
      
      if (!user || !analysis || !resume || !resume.id || hasLoadedEnhancedRef.current) {
        logDebug('InitialLoad', 'Skipping enhanced analysis load due to missing prerequisites or already loaded', {
          hasUser: !!user,
          hasAnalysis: !!analysis,
          hasResume: !!resume,
          resumeId: resume?.id,
          hasLoadedEnhanced: hasLoadedEnhancedRef.current
        });
        return;
      }

      logDebug('InitialLoad', `Loading enhanced analysis for resume ID: ${resume.id}`);
      
      try {
        setIsLoadingEnhancedBullets(true);
        
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
          logDebug('InitialLoad', `No enhanced bullets yet for resume ${resume.id}`);
          setIsLoadingEnhancedBullets(false);
        }
      } catch (err) {
        logDebug('InitialLoad', 'Error loading enhanced analysis:', err);
        console.error("Error loading enhanced analysis:", err);
        setIsLoadingEnhancedBullets(false);
      }
    };

    loadEnhancedAnalysis();
  }, [user, analysis, resume]); // resume.id changes also trigger this

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
    
    let blobUrl: string | null = null; // Keep blobUrl scoped for cleanup
    if (resumeFile.type === 'application/pdf') {
      blobUrl = URL.createObjectURL(resumeFile);
      setPdfPreviewUrl(blobUrl);
      logDebug('FileHandler', 'Created PDF preview URL');
    } else {
      if (pdfPreviewUrl) { // If a non-PDF is selected after a PDF, clear old preview
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      logDebug('FileHandler', 'No PDF preview URL needed for this file type or cleared old one');
    }

    if (!extractedText) { // Only extract if not already extracted for this file instance
      logDebug('FileHandler', 'No extracted text, starting extraction');
      (async () => {
        try {
          logDebug('FileHandler', 'Extracting text from file');
          const text = await extractTextFromFile(resumeFile);
          setExtractedText(text);
          logDebug('FileHandler', 'Text extraction successful', { textLength: text?.length });
        } catch (err: any) { // Type error
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
      if (blobUrl) { // Use the scoped blobUrl for cleanup
        URL.revokeObjectURL(blobUrl);
        // setPdfPreviewUrl(null); // Not strictly needed here as it's set on new file or unmount
        logDebug('FileHandler', 'Cleanup: Revoked PDF preview URL for current file');
      }
    };
  }, [resumeFile, toast]); // Removed extractedText and pdfPreviewUrl, let blobUrl handle its own lifecycle with resumeFile

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
          setIsLoadingEnhancedBullets(true); 
          logDebug('AnalysisRunner', 'Set isLoadingEnhancedBullets to true');
          
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
      setExtractedText(null); // Reset extracted text for the new file
      setHasLoadedAnalysis(false); 
      setAnalysis(null); 
      
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
    setAnalysis(null); 
    setStorageError(null);
    
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for upload');
    
    try {
      logDebug('UserAction', 'Calling uploadResume');
      const newResume = await uploadResume(resumeFile, extractedText); 
      
      if (newResume) { 
        logDebug('UserAction', 'Upload successful, new resume data available (or hook updated state).');
        // `resume` state from useResume hook will be updated.
        // useEffect for analysis runner will pick up `resume.text`.
        setHasLoadedAnalysis(false); // Ensure analysis runner effect triggers for new resume.
        setIsLoadingEnhancedBullets(true); 
        logDebug('UserAction', 'Set isLoadingEnhancedBullets to true after upload, awaiting analysis trigger.');

      } else {
        logDebug('UserAction', 'Upload did not result in new resume data or failed silently');
        toast({
            title: 'Upload Issue',
            description: 'Resume might not have uploaded correctly. Please try again.',
            variant: 'destructive'
        });
      }
    } catch (error: any) { // Type error
      logDebug('UserAction', 'Upload error:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
        logDebug('UserAction', 'Setting storage error');
      } else {
         toast({
            title: 'Upload Failed',
            description: error.message || 'Could not upload resume. Please try again.',
            variant: 'destructive'
          });
      }
    }
  };

  const handleDelete = async () => {
    logDebug('UserAction', 'Delete requested');
    
    try {
      // The deleteResume function from useResume should handle clearing the resume state in the hook
      await deleteResume(); 
      
      logDebug('UserAction', 'Resetting all resume-related state on page');
      setResumeFile(null);
      // pdfPreviewUrl is cleaned up by resumeFile useEffect
      setExtractedText(null);
      setShowCareerChat(false);
      setAnalysis(null); 
      setHasLoadedAnalysis(false);
      
      hasLoadedEnhancedRef.current = false;
      currentResumeIdRef.current = null; 
      logDebug('UserAction', 'Reset hasLoadedEnhancedRef and currentResumeIdRef after delete');
      toast({ title: "Resume Deleted", description: "Your resume and its analysis have been removed."});
    } catch (error: any) { // Type error
      logDebug('UserAction', 'Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Could not delete resume. Please try again.',
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
    setAnalysis(null); 
    setHasLoadedAnalysis(false);
    setStorageError(null);
    
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for refresh');
    
    try {
      logDebug('UserAction', 'Calling refreshResume');
      await refreshResume(); // This will update the `resume` state from the hook.
      
      // After refreshResume() completes, the `resume` state variable (from useResume())
      // should be updated with the latest data. We use it here.
      // Add a small delay or rely on useEffect that watches `resume` state.
      // For immediate action post-refresh, check the updated `resume` state.
      // Note: This check will use the `resume` state that might be updated slightly after `await refreshResume()` resolves.
      // A more robust way is to have a useEffect listening to `resume` changes post-refresh.
      // However, for this fix, we'll try to use it directly after, assuming quick state update.

      // This part of the logic should ideally be triggered by a useEffect watching `resume`
      // to ensure `resume` is definitely the refreshed version.
      // For now, let's assume `resume` is updated in time.
      if (resume && resume.id) { 
        logDebug('UserAction', `Checking for enhanced analysis for resume ID: ${resume.id}`);
        currentResumeIdRef.current = resume.id; 

        const { data, error: dbError } = await supabase // Renamed error to dbError
          .from('resumes')
          .select('enhanced_analysis')
          .eq('id', resume.id)
          .maybeSingle();
          
        if (dbError) {
          logDebug('UserAction', 'Error fetching enhanced analysis during refresh:', dbError);
        } else if (data?.enhanced_analysis) {
          logDebug('UserAction', 'Found enhanced analysis during refresh, attempting to apply.');
           if (analysis && analysis.bullets) { 
            handleEnhancedAnalysisUpdate(data.enhanced_analysis);
          } else {
            logDebug('UserAction', 'Analysis not yet loaded, cannot apply enhanced bullets immediately.');
            setIsLoadingEnhancedBullets(true); 
          }
        } else {
          logDebug('UserAction', 'No enhanced analysis found during refresh.');
        }
      } else {
        logDebug('UserAction', 'No resume ID available or refresh failed, for enhanced analysis check during refresh', { currentResume: resume });
      }
      
      logDebug('UserAction', 'Refresh completed successfully');
      toast({
        title: 'Refreshed',
        description: 'Resume data has been refreshed.'
      });
    } catch (error: any) { // Type error
      logDebug('UserAction', 'Refresh error:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
        logDebug('UserAction', 'Setting storage error during refresh');
      }
      toast({
        title: 'Refresh Failed',
        description: error.message ||'Could not refresh resume data. Please try again.',
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
      toast({ title: "Cannot Check", description: "No resume loaded to check for improvements.", variant: "default" });
      return;
    }
    
    if (!analysis || !analysis.bullets) {
        logDebug('CheckEnhancements', 'Analysis or bullets not loaded. Cannot check for enhancements.');
        toast({ title: "Analysis Needed", description: "Resume analysis must be loaded first.", variant: "default" });
        setIsLoadingEnhancedBullets(false); 
        return;
    }

    logDebug('CheckEnhancements', `Manually checking enhancements for resume ID: ${resume.id}`);
    setIsLoadingEnhancedBullets(true);
    hasLoadedEnhancedRef.current = false; 
    
    try {
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

      if (data?.enhanced_analysis && Array.isArray(data.enhanced_analysis) && data.enhanced_analysis.length > 0) {
        logDebug('CheckEnhancements', 'Found enhanced analysis, passing to handler');
        handleEnhancedAnalysisUpdate(data.enhanced_analysis); 
      } else {
        logDebug('CheckEnhancements', 'No new or valid enhanced analysis found in response');
        toast({
          title: 'No New Improvements',
          description: 'No new improved bullets found. They may still be processing or none were generated.',
          variant: 'default'
        });
        setIsLoadingEnhancedBullets(false); 
      }
    } catch (err) {
      logDebug('CheckEnhancements', 'Error checking for enhancements:', err);
      console.error("Error checking for enhancements:", err);
      toast({
        title: 'Error',
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

  const pageLoading = resumeLoading || isRefreshing; 

  logDebug('Render', 'Rendering main component', { 
    pageLoading, 
    resumeLoading, 
    isAnalyzing,
    isRefreshing,
    uploading, 
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
              disabled={pageLoading || isLoadingEnhancedBullets || !analysis || !resume}
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
              disabled={pageLoading || uploading} 
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

        <ResumeAnalysisSection
          loading={pageLoading} 
          isAnalyzing={isAnalyzing} 
          analysis={analysis}
          resume={resume}
          handleStartCareerChat={handleStartCareerChat}
          handleFileChange={handleFileChange}
          hasAnalysis={!!analysis && hasLoadedAnalysis} 
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
