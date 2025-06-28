import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
import { ResumeAnalysisOverlay } from '@/components/resume/ResumeAnalysisOverlay';
import { extractTextFromFile } from '@/hooks/resume/useResumeStorage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import BulletPointChart from '@/components/resume/BulletPointChart';

const AnalysisProgress: React.FC<{
  isAnalyzing: boolean;
  isPollingForImprovements: boolean;
  pollingStatus: 'idle' | 'polling' | 'completed' | 'error';
  pollingAttempt: number;
}> = ({ isAnalyzing, isPollingForImprovements, pollingStatus, pollingAttempt }) => {
  if (!isAnalyzing && !isPollingForImprovements) return null;

  return (
    <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
          <span className="font-medium text-sm">
            {isAnalyzing ? "Analyzing Resume..." : "Generating Improvements..."}
          </span>
        </div>
        {pollingStatus === 'polling' && (
          <span className="text-xs text-slate-500">
            Attempt {pollingAttempt + 1}
          </span>
        )}
      </div>
      
      <div className="mt-2">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-in-out"
            style={{ 
              width: `${isAnalyzing ? '50%' : Math.min((pollingAttempt + 1) * 5, 100)}%`
            }}
          />
        </div>
      </div>
      
      <p className="mt-2 text-sm text-slate-600">
        {isAnalyzing 
          ? "We're analyzing your resume content and structure..."
          : pollingStatus === 'polling'
          ? "We're using AI to enhance your bullet points for maximum impact..."
          : pollingStatus === 'error'
          ? "Taking longer than expected. You can continue using other features while we work on improvements."
          : "Almost done! Finalizing your improvements..."}
      </p>
    </div>
  );
};

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
    setAnalysis,
    isPollingForImprovements,
    setIsPollingForImprovements,
    pollingStatus,
    setPollingStatus,
    pollingAttempt
  } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingEnhancedBullets, setIsLoadingEnhancedBullets] = useState(false);
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
  const subscriptionRef = useRef(null);
  const currentResumeIdRef = useRef(null);
  const hasLoadedEnhancedRef = useRef(false);

  // Set up and clean up real-time subscription with better logging
  useEffect(() => {
    if (!user || !resume) {
      logDebug('Subscription', 'Missing user or resume data for subscription', {
        hasUser: !!user,
        hasResume: !!resume
      });
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
    const channel = supabase.channel('enhanced-analysis-changes').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'resumes',
      filter: `user_id=eq.${user.id}`
    }, payload => {
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
    }).subscribe(status => {
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

  // Update the useEffect that controls overlay visibility
  useEffect(() => {
    // Show overlay during initial analysis (when first analyzing resume text)
    if (isAnalyzing && !hasLoadedAnalysis) {
      setShowAnalysisOverlay(true);
    } else {
      setShowAnalysisOverlay(false);
    }
  }, [isAnalyzing, hasLoadedAnalysis]);

  // Handle updates to enhanced_analysis with better state management
  const handleEnhancedAnalysisUpdate = enhancedAnalysis => {
    // If we've already loaded enhanced bullets for this analysis, ignore the update
    if (hasLoadedEnhancedRef.current) {
      logDebug('EnhancedUpdate', 'Ignoring update - enhanced bullets already loaded');
      return;
    }

    logDebug('EnhancedUpdate', 'Processing enhanced analysis update', enhancedAnalysis);

    try {
      if (Array.isArray(enhancedAnalysis) && enhancedAnalysis.length > 0) {
        logDebug('EnhancedUpdate', `Found ${enhancedAnalysis.length} enhanced bullets`);

        // Update the analysis with enhanced bullets
        const updatedBullets = analysis.bullets.map(bullet => {
          const enhanced = enhancedAnalysis.find(item => item.original === bullet.original);
          if (enhanced) {
            return {
              ...bullet,
              rewritten: enhanced.rewritten || bullet.original,
              tips: enhanced.tips || [],
              improved_xyz_scores: enhanced.xyz_scores,
              improved_word_balance: enhanced.word_balance,
              improved_bullet_total: enhanced.bullet_total,
              // add any other improved fields you want to preserve
            };
          }
          return bullet;
        });

        logDebug('EnhancedUpdate', 'Updated bullets', updatedBullets);
        const updatedAnalysis = {
          ...analysis,
          bullets: updatedBullets
        };
        setAnalysis(updatedAnalysis);
        if (user?.id) {
          localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(updatedAnalysis));
        }

        // Mark as loaded and update states
        hasLoadedEnhancedRef.current = true;
        setIsPollingForImprovements(false);
        setPollingStatus('completed');
        
        toast({
          title: 'Resume Bullet Improvements Ready',
          description: 'Your resume bullets have been enhanced with AI improvements.',
          variant: 'default'
        });
      } else {
        logDebug('EnhancedUpdate', 'Enhanced analysis is not an array or is empty', enhancedAnalysis);
        setIsPollingForImprovements(false);
        setPollingStatus('error');
      }
    } catch (err) {
      logDebug('EnhancedUpdate', 'Error processing enhanced bullets:', err);
      console.error("Error processing enhanced bullets:", err);
      setIsPollingForImprovements(false);
      setPollingStatus('error');
    }
  };
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      logDebug('InitialData', 'Starting loadInitialData');
      if (initialLoadComplete || !user) {
        logDebug('InitialData', 'Skipping initial load', {
          initialLoadComplete,
          hasUser: !!user
        });
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
        // Only load from resume.analysis if we don't have cached data
        // or if the cached data is stale
        const cachedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
        if (cachedAnalysis) {
          // If we have cached data, check if resume data is newer
          const parsedCachedAnalysis = JSON.parse(cachedAnalysis);
          // If no updated_at field exists, always prefer the resume data
          if (!parsedCachedAnalysis.updated_at || resume.analysis.updated_at && new Date(resume.analysis.updated_at) > new Date(parsedCachedAnalysis.updated_at)) {
            // Resume data is newer, use it
            logDebug('AnalysisLoader', 'Setting analysis from resume (newer than cache)', resume.analysis);
            setAnalysis(resume.analysis);
            // Update the cache with newer data
            localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(resume.analysis));
          } else {
            // Cache is newer, use it
            logDebug('AnalysisLoader', 'Using cached analysis (newer than resume data)', parsedCachedAnalysis);
            setAnalysis(parsedCachedAnalysis);
          }
        } else {
          // No cache, use resume data
          logDebug('AnalysisLoader', 'Setting analysis from resume (no cache)', resume.analysis);
          setAnalysis(resume.analysis);
          // Initialize cache
          localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(resume.analysis));
        }
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
        // On error, reset states to allow retry
        setHasLoadedAnalysis(false);
        setAnalysis(null);
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
        const {
          data,
          error
        } = await supabase.from('resumes').select('enhanced_analysis').eq('id', resume.id).maybeSingle();
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
    logDebug('FileHandler', 'File change detected', {
      hasFile: !!resumeFile
    });
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
          logDebug('FileHandler', 'Text extraction successful', {
            textLength: text?.length
          });
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
      if (pdfPreviewUrl && resumeFile?.type === 'application/pdf') {
        URL.revokeObjectURL(blobUrl);
        setPdfPreviewUrl(null);
        logDebug('FileHandler', 'Cleanup: Revoked PDF preview URL');
      }
    };
  }, [resumeFile, toast]);
  useEffect(() => {
    logDebug('AnalysisRunner', 'Checking if analysis needs to be run', {
      hasResumeText: !!resume?.text,
      hasAnalysis: !!analysis,
      isAnalyzing,
      hasLoadedAnalysis,
      initialLoadComplete
    });

    // Only run analysis if we have resume text, no analysis yet, and not currently analyzing
    if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
      logDebug('AnalysisRunner', 'Starting analysis of resume text');
      analyzeResume(resume.text).then(success => {
        if (success) {
          logDebug('AnalysisRunner', 'Analysis completed successfully');
          setHasLoadedAnalysis(true);
          // Don't set isLoadingEnhancedBullets here since it will be handled by the polling logic
        } else {
          logDebug('AnalysisRunner', 'Analysis did not complete successfully');
          setHasLoadedAnalysis(false);
          setAnalysis(null);
        }
      }).catch(err => {
        logDebug('AnalysisRunner', 'Error analyzing resume:', err);
        console.error("Error analyzing resume:", err);
        setHasLoadedAnalysis(false);
        setAnalysis(null);
      });
    }
  }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    logDebug('UserAction', 'File input changed', {
      hasFile: !!file,
      fileType: file?.type
    });
    if (!file) return;
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      logDebug('UserAction', 'Setting valid resume file');
      setResumeFile(file);
      setHasLoadedAnalysis(false);

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
    logDebug('UserAction', 'Upload requested', {
      hasFile: !!resumeFile,
      hasText: !!extractedText
    });
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
    setStorageError(null);

    // Show analysis overlay before starting the process
    setShowAnalysisOverlay(true);

    // Reset enhanced bullets flag
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for upload');
    try {
      logDebug('UserAction', 'Calling uploadResume');
      const ok = await uploadResume(resumeFile, extractedText);
      if (ok) {
        logDebug('UserAction', 'Upload successful');

        // Store the current resume ID after upload
        if (resume && resume.id) {
          currentResumeIdRef.current = resume.id;
          logDebug('UserAction', `Setting currentResumeIdRef to ${resume.id} after upload`);
        } else {
          logDebug('UserAction', 'Resume has no ID after upload!', resume);
        }
        try {
          logDebug('UserAction', 'Starting analysis after upload');
          await analyzeResume(extractedText);
          logDebug('UserAction', 'Analysis completed after upload');
          setHasLoadedAnalysis(true);
          setShowAnalysisOverlay(false); // Hide overlay after analysis is complete
          setIsLoadingEnhancedBullets(true); // Start waiting for enhanced bullets
          logDebug('UserAction', 'Set isLoadingEnhancedBullets to true after upload');
        } catch (error) {
          logDebug('UserAction', 'Analysis error after upload:', error);
          toast({
            title: 'Analysis Error',
            description: 'Resume was uploaded but analysis failed. You can try again later.',
            variant: 'destructive'
          });
          setShowAnalysisOverlay(false);
        }
      } else {
        logDebug('UserAction', 'Upload returned not OK');
        setShowAnalysisOverlay(false);
      }
    } catch (error) {
      logDebug('UserAction', 'Upload error:', error);
      setShowAnalysisOverlay(false);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
        logDebug('UserAction', 'Setting storage error');
      }
    }
  };
  const handleDelete = async () => {
    logDebug('UserAction', 'Delete requested');
    try {
      if (resume) {
        logDebug('UserAction', 'Calling deleteResume');
        await deleteResume();
      }
      logDebug('UserAction', 'Resetting all resume-related state');
      setResumeFile(null);
      setPdfPreviewUrl(null);
      setExtractedText(null);
      setShowCareerChat(false);
      setAnalysis(null);
      setHasLoadedAnalysis(false);

      // Reset enhanced bullets flag and resume ID
      hasLoadedEnhancedRef.current = false;
      currentResumeIdRef.current = null;
      logDebug('UserAction', 'Reset hasLoadedEnhancedRef and currentResumeIdRef after delete');
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
    logDebug('UserAction', 'Download requested', {
      hasFileUrl: !!resume?.file_url
    });
    if (resume?.file_url) window.open(resume.file_url, '_blank');
  };
  const handleStartCareerChat = () => {
    logDebug('UserAction', 'Career chat requested');
    setShowCareerChat(true);
  };
  const handleRefreshData = async () => {
    logDebug('UserAction', 'Refresh data requested');
    setIsRefreshing(true);
    setHasLoadedAnalysis(false);
    setStorageError(null);

    // Reset enhanced bullets flag
    hasLoadedEnhancedRef.current = false;
    logDebug('UserAction', 'Reset hasLoadedEnhancedRef for refresh');

    // Clear localStorage items related to resume, analysis, and job
    if (user) {
      // Clear all existing cached data for the user
      localStorage.removeItem(`resume_analysis_${user.id}`);
      logDebug('UserAction', 'Cleared localStorage cache for user');
      
      // Clear all items containing "resume", "analysis", or "job"
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (
          key.toLowerCase().includes('resume') || 
          key.toLowerCase().includes('analysis') || 
          key.toLowerCase().includes('job')
        )) {
          logDebug('UserAction', `Removing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      }
      
      // // Clear specific job-related keys
      // const jobKeys = [
      //   'job_description_url',
      //   'job_description_text',
      //   'job_analyzer_active_tab',
      //   'job_analysis_result',
      //   'job_analyzer_use_filtering'
      // ];
      
      // jobKeys.forEach(key => {
      //   localStorage.removeItem(key);
      //   logDebug('UserAction', `Removed job-related key: ${key}`);
      // });
    }

    try {
      logDebug('UserAction', 'Calling refreshResume');
      await refreshResume();

      // Check for enhanced analysis
      if (resume && resume.id) {
        logDebug('UserAction', `Checking for enhanced analysis for resume ID: ${resume.id}`);
        setIsLoadingEnhancedBullets(true);
        
        // Check for enhanced analysis for the specific resume
        const { data, error } = await supabase
          .from('resumes')
          .select('enhanced_analysis')
          .eq('id', resume.id)
          .maybeSingle();

        if (error) {
          logDebug('UserAction', 'Error fetching enhanced analysis during refresh:', error);
        } else if (data?.enhanced_analysis) {
          logDebug('UserAction', 'Found enhanced analysis during refresh');
          handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        } else {
          logDebug('UserAction', 'No enhanced analysis found during refresh');
          // If no enhanced analysis found, try to get it
          try {
            const { data: enhancedData, error: enhancedError } = await supabase.functions.invoke('resume-analyzer', {
              body: { 
                action: 'improve-bullets',
                userId: user?.id
              }
            });

            if (enhancedError) {
              throw enhancedError;
            }

            if (enhancedData?.improved_bullets && enhancedData.improved_bullets.length > 0) {
              handleEnhancedAnalysisUpdate(enhancedData.improved_bullets);
            }
          } catch (enhancedErr) {
            console.error("Error checking for enhancements:", enhancedErr);
          }
        }
      } else {
        logDebug('UserAction', 'No resume ID available for enhanced analysis check during refresh');
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

  if (!isAuthenticated) {
    logDebug('Render', 'User not authenticated, showing login wall');
    return <ResumeLoginWall />;
  }
  
  const loading = resumeLoading || isAnalyzing || isRefreshing;
  
  logDebug('Render', 'Rendering main component', {
    loading,
    resumeLoading,
    isAnalyzing,
    isRefreshing,
    isLoadingEnhancedBullets,
    isPollingForImprovements,
    hasAnalysis: !!analysis,
    hasResume: !!resume,
    hasLoadedAnalysis
  });
  
  return <AppLayout fullWidth>
      <div className="mx-auto py-6 space-y-6 px-6 max-w-full">
        {/* Analysis overlay that appears during processing */}
        <ResumeAnalysisOverlay 
          isVisible={showAnalysisOverlay} 
          userId={user?.id}
          resumeId={resume?.id}
          analysisType={hasLoadedAnalysis ? 'bullets' : 'initial'}
        />
        
        {/* Add the new progress component */}
        <AnalysisProgress 
          isAnalyzing={isAnalyzing}
          isPollingForImprovements={isPollingForImprovements}
          pollingStatus={pollingStatus}
          pollingAttempt={pollingAttempt}
        />

        {storageError && <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Storage Error</AlertTitle>
            <AlertDescription>
              {storageError}
            </AlertDescription>
          </Alert>}

        {careerAlignments && careerAlignments.length > 0 && 
          <div className="space-y-2">
            {careerAlignments.map((alignment, index) => (
              <div key={index}>{/* Alignment content would go here */}</div>
            ))}
          </div>
        }

        {/* Pass showCareerChat state and handleRefreshData to ResumeAnalysisSection */}
        <ResumeAnalysisSection 
          loading={loading} 
          isAnalyzing={isAnalyzing} 
          isPollingForImprovements={isPollingForImprovements} 
          analysis={analysis} 
          resume={resume} 
          handleStartCareerChat={handleStartCareerChat} 
          handleFileChange={handleFileChange} 
          hasAnalysis={!!analysis} 
          resumeFile={resumeFile} 
          pdfPreviewUrl={pdfPreviewUrl} 
          uploading={uploading} 
          handleUpload={handleUpload} 
          handleDelete={handleDelete} 
          handleDownload={handleDownload} 
          fileError={storageError}
          showCareerChat={showCareerChat}
          handleRefreshData={handleRefreshData}
        />
      </div>
    </AppLayout>;
};

export default Resume;
