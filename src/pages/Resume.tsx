import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import ResumeChat from '@/components/resume/ResumeChat';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
import { extractTextFromFile } from '@/hooks/resume/useResumeStorage';
import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Resume = () => {
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
  const [enhancedBullets, setEnhancedBullets] = useState([]);
  const [isLoadingEnhancedBullets, setIsLoadingEnhancedBullets] = useState(false);
  const [subscriptionEstablished, setSubscriptionEstablished] = useState(false);

  // Subscribe to changes in the resumes table for enhanced_analysis updates
  useEffect(() => {
    if (!user || subscriptionEstablished) return;

    // Set up real-time subscription
    const subscription = supabase
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
          console.log('Enhanced analysis update received:', payload);
          if (payload.new && payload.new.enhanced_analysis) {
            // Handle the updated data
            handleEnhancedAnalysisUpdate(payload.new.enhanced_analysis);
          }
        }
      )
      .subscribe();

    setSubscriptionEstablished(true);

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
      setSubscriptionEstablished(false);
    };
  }, [user, subscriptionEstablished]);

  // Handle updates to enhanced_analysis
  const handleEnhancedAnalysisUpdate = (enhancedAnalysis) => {
    if (!enhancedAnalysis) return;

    // Check if the enhanced analysis has rewritten bullets
    if (enhancedAnalysis && Array.isArray(enhancedAnalysis)) {
      setEnhancedBullets(enhancedAnalysis);

      // If we have analysis data, update it with the enhanced bullets
      if (analysis && analysis.bullets) {
        // Create a mapping from original bullet to enhanced bullet
        const enhancedMap = new Map();
        enhancedAnalysis.forEach(bullet => {
          enhancedMap.set(bullet.original, bullet);
        });

        // Update the analysis with enhanced bullets
        const updatedBullets = analysis.bullets.map(bullet => {
          const enhanced = enhancedMap.get(bullet.original);
          if (enhanced) {
            return {
              ...bullet,
              rewritten: enhanced.rewritten || bullet.original,
              tips: enhanced.tips || []
            };
          }
          return bullet;
        });

        setAnalysis({
          ...analysis,
          bullets: updatedBullets
        });

        toast({
          title: 'Resume Bullet Improvements Ready',
          description: 'Your resume bullets have been enhanced with AI improvements.',
          variant: 'default'
        });
      }
    }

    // Done loading enhanced bullets
    setIsLoadingEnhancedBullets(false);
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      if (initialLoadComplete || !user) return;
      try {
        setStorageError(null);
        await refreshResume();
        setInitialLoadComplete(true);
      } catch (err) {
        console.error("Error in initial data load:", err);
        if (err.message?.includes('bucket') || err.message?.includes('storage')) {
          setStorageError("Resume storage is not properly configured. Please contact support.");
        }
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [user, initialLoadComplete, refreshResume]);

  useEffect(() => {
    if (resume?.analysis && !analysis && !hasLoadedAnalysis && user) {
      try {
        setAnalysis(resume.analysis);
        setHasLoadedAnalysis(true);
      } catch (err) {
        console.error("Error setting analysis from resume:", err);
      }
    }
  }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

  // Initial load of enhanced analysis
  useEffect(() => {
    const loadEnhancedAnalysis = async () => {
      if (!user || !analysis) return;

      try {
        setIsLoadingEnhancedBullets(true);
        
        const { data, error } = await supabase
          .from('resumes')
          .select('enhanced_analysis')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching enhanced analysis:", error);
          setIsLoadingEnhancedBullets(false);
          return;
        }

        if (data?.enhanced_analysis) {
          handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        } else {
          // No enhanced analysis yet, check if there's a need to manually trigger it
          const { data: resumeData, error: resumeError } = await supabase
            .from('resumes')
            .select('analysis')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!resumeError && resumeData?.analysis) {
            // Analysis exists but no enhanced bullets yet, keep the loading state
            console.log("Analysis exists but enhanced bullets not yet generated. Waiting...");
          } else {
            // No analysis data either, stop loading
            setIsLoadingEnhancedBullets(false);
          }
        }
      } catch (err) {
        console.error("Error loading enhanced analysis:", err);
        setIsLoadingEnhancedBullets(false);
      }
    };

    loadEnhancedAnalysis();
  }, [user, analysis]);

  useEffect(() => {
    if (!resumeFile) {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      setExtractedText(null);
      return;
    }

    let blobUrl: string | null = null;
    if (resumeFile.type === 'application/pdf') {
      blobUrl = URL.createObjectURL(resumeFile);
      setPdfPreviewUrl(blobUrl);
    } else {
      setPdfPreviewUrl(null);
    }

    if (!extractedText) {
      (async () => {
        try {
          const text = await extractTextFromFile(resumeFile);
          setExtractedText(text);
        } catch (err) {
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
      }
    };
  }, [resumeFile, toast]);

  useEffect(() => {
    if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
      analyzeResume(resume.text).then(success => {
        if (success) {
          setHasLoadedAnalysis(true);
          setIsLoadingEnhancedBullets(true); // Start waiting for enhanced bullets
        }
      }).catch(err => {
        console.error("Error analyzing resume:", err);
      });
    }
  }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setResumeFile(file);
      setHasLoadedAnalysis(false);
    } else {
      toast({
        title: 'Invalid type',
        description: 'Only PDF or DOCX allowed.',
        variant: 'destructive'
      });
    }
  };

  const handleUpload = async () => {
    if (!resumeFile || !extractedText) {
      toast({
        title: 'Wait',
        description: 'Still extracting text or no file selected.',
        variant: 'destructive'
      });
      return;
    }
    setHasLoadedAnalysis(false);
    setStorageError(null);
    try {
      const ok = await uploadResume(resumeFile, extractedText);
      if (ok) {
        try {
          await analyzeResume(extractedText);
          setHasLoadedAnalysis(true);
          setIsLoadingEnhancedBullets(true); // Start waiting for enhanced bullets
        } catch (error) {
          toast({
            title: 'Analysis Error',
            description: 'Resume was uploaded but analysis failed. You can try again later.',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
      }
    }
  };

  const handleDelete = async () => {
    try {
      if (resume) await deleteResume();
      setResumeFile(null);
      setPdfPreviewUrl(null);
      setExtractedText(null);
      setShowCareerChat(false);
      setAnalysis(null);
      setHasLoadedAnalysis(false);
      setEnhancedBullets([]);
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete resume. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = () => {
    if (resume?.file_url) window.open(resume.file_url, '_blank');
  };

  const handleStartCareerChat = () => setShowCareerChat(true);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    setHasLoadedAnalysis(false);
    setStorageError(null);
    try {
      await refreshResume();
      
      // Check for enhanced analysis
      const { data, error } = await supabase
        .from('resumes')
        .select('enhanced_analysis')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (!error && data?.enhanced_analysis) {
        handleEnhancedAnalysisUpdate(data.enhanced_analysis);
      } else {
        setIsLoadingEnhancedBullets(true);
      }
      
      toast({
        title: 'Refreshed',
        description: 'Resume data has been refreshed.'
      });
    } catch (error) {
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
      }
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh resume data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheckEnhancements = async () => {
    if (!user) return;
    
    setIsLoadingEnhancedBullets(true);
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('enhanced_analysis')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.enhanced_analysis) {
        handleEnhancedAnalysisUpdate(data.enhanced_analysis);
        
        toast({
          title: 'Enhancements Loaded',
          description: 'Your resume bullet improvements have been loaded.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'No Enhancements',
          description: 'No improved bullets found yet. They may still be processing.',
          variant: 'default'
        });
        setIsLoadingEnhancedBullets(false);
      }
    } catch (err) {
      console.error("Error checking for enhancements:", err);
      toast({
        title: 'Error',
        description: 'Could not load enhanced bullets. Please try again later.',
        variant: 'destructive'
      });
      setIsLoadingEnhancedBullets(false);
    }
  };

  if (!isAuthenticated) return <ResumeLoginWall />;

  const loading = resumeLoading || isAnalyzing || isRefreshing;

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
              disabled={loading || isLoadingEnhancedBullets}
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
              disabled={loading}
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

        <div className="grid md:grid-cols-2 gap-6">
          <ResumeUploadSection
            resumeFile={resumeFile}
            setResumeFile={setResumeFile}
            resume={resume}
            loading={loading}
            uploading={uploading}
            isAnalyzing={isAnalyzing}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            handleFileChange={handleFileChange}
            handleDownload={handleDownload}
            pdfPreviewUrl={pdfPreviewUrl}
          />

          <ResumeAnalysisSection
            loading={loading}
            isAnalyzing={isAnalyzing}
            analysis={analysis}
            resume={resume}
            handleStartCareerChat={handleStartCareerChat}
            handleFileChange={handleFileChange}
          />
        </div>

        {showCareerChat && analysis && <ResumeChat resumeAnalysis={analysis} />}

        <details open className="border rounded-md bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-2 font-medium">Storytelling Analysis</summary>
          <div className="p-4">
            {analysis?.bullets && analysis.bullets.length > 0 ? (
              <BulletPointsAnalysisCard 
                bullets={analysis.bullets} 
                isAnalyzing={isAnalyzing || isLoadingEnhancedBullets}
              />
            ) : (
              <p className="text-gray-500">
                No bullet‑point analysis available. Upload and analyze your resume
                to see detailed feedback.
              </p>
            )}
          </div>
        </details>
      </div>
    </AppLayout>
  );
};

export default Resume;

// import React, { useState, useEffect } from 'react';
// import AppLayout from '@/components/layout/AppLayout';
// import { useAuth } from '@/contexts/AuthContext';
// import { useToast } from '@/hooks/use-toast';
// import { useResume } from '@/hooks/resume/useResume';
// import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
// import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
// import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
// import ResumeChat from '@/components/resume/ResumeChat';
// import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
// import { extractTextFromFile } from '@/hooks/resume/useResumeStorage';
// import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { Button } from '@/components/ui/button';
// import { AlertCircle, RefreshCw } from 'lucide-react';

// const Resume = () => {
//   const {
//     user,
//     isAuthenticated
//   } = useAuth();
//   const {
//     toast
//   } = useToast();
//   const [resumeFile, setResumeFile] = useState<File | null>(null);
//   const {
//     resume,
//     loading: resumeLoading,
//     uploading,
//     uploadResume,
//     deleteResume,
//     refreshResume
//   } = useResume();
//   const {
//     analysis,
//     isAnalyzing,
//     analyzeResume,
//     careerAlignments,
//     setAnalysis
//   } = useResumeAnalysis();
//   const [showCareerChat, setShowCareerChat] = useState(false);
//   const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
//   const [extractedText, setExtractedText] = useState<string | null>(null);
//   const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
//   const [initialLoadComplete, setInitialLoadComplete] = useState(false);
//   const [storageError, setStorageError] = useState<string | null>(null);
//   const [isRefreshing, setIsRefreshing] = useState(false);

//   useEffect(() => {
//     let isMounted = true;
//     const loadInitialData = async () => {
//       if (initialLoadComplete || !user) return;
//       try {
//         setStorageError(null);
//         await refreshResume();
//         setInitialLoadComplete(true);
//       } catch (err: any) {
//         console.error("Error in initial data load:", err);
//         if (err.message?.includes('bucket') || err.message?.includes('storage')) {
//           setStorageError("Resume storage is not properly configured. Please contact support.");
//         }
//       }
//     };
//     loadInitialData();
//     return () => {
//       isMounted = false;
//     };
//   }, [user, initialLoadComplete, refreshResume]);

//   useEffect(() => {
//     if (resume?.analysis && !analysis && !hasLoadedAnalysis && user) {
//       try {
//         setAnalysis(resume.analysis);
//         setHasLoadedAnalysis(true);
//       } catch (err) {
//         console.error("Error setting analysis from resume:", err);
//       }
//     }
//   }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

//   useEffect(() => {
//     if (!resumeFile) {
//       if (pdfPreviewUrl) {
//         URL.revokeObjectURL(pdfPreviewUrl);
//         setPdfPreviewUrl(null);
//       }
//       setExtractedText(null);
//       return;
//     }

//     let blobUrl: string | null = null;
//     if (resumeFile.type === 'application/pdf') {
//       blobUrl = URL.createObjectURL(resumeFile);
//       setPdfPreviewUrl(blobUrl);
//     } else {
//       setPdfPreviewUrl(null);
//     }

//     if (!extractedText) {
//       (async () => {
//         try {
//           const text = await extractTextFromFile(resumeFile);
//           setExtractedText(text);
//         } catch (err) {
//           console.error(err);
//           toast({
//             title: 'Extraction failed',
//             description: 'Could not extract text from your resume.',
//             variant: 'destructive'
//           });
//         }
//       })();
//     }

//     return () => {
//       if (pdfPreviewUrl && resumeFile?.type === 'application/pdf') {
//         URL.revokeObjectURL(blobUrl);
//         setPdfPreviewUrl(null);
//       }
//     };
//   }, [resumeFile, toast]);

//   useEffect(() => {
//     if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
//       analyzeResume(resume.text).then(success => {
//         if (success) {
//           setHasLoadedAnalysis(true);
//         }
//       }).catch(err => {
//         console.error("Error analyzing resume:", err);
//       });
//     }
//   }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
//       setResumeFile(file);
//       setHasLoadedAnalysis(false);
//     } else {
//       toast({
//         title: 'Invalid type',
//         description: 'Only PDF or DOCX allowed.',
//         variant: 'destructive'
//       });
//     }
//   };

//   const handleUpload = async () => {
//     if (!resumeFile || !extractedText) {
//       toast({
//         title: 'Wait',
//         description: 'Still extracting text or no file selected.',
//         variant: 'destructive'
//       });
//       return;
//     }
//     setHasLoadedAnalysis(false);
//     setStorageError(null);
//     try {
//       const ok = await uploadResume(resumeFile, extractedText);
//       if (ok) {
//         try {
//           await analyzeResume(extractedText);
//           setHasLoadedAnalysis(true);
//         } catch (error) {
//           toast({
//             title: 'Analysis Error',
//             description: 'Resume was uploaded but analysis failed. You can try again later.',
//             variant: 'destructive'
//           });
//         }
//       }
//     } catch (error: any) {
//       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
//         setStorageError("Resume storage is not properly configured. Please contact support.");
//       }
//     }
//   };

//   const handleDelete = async () => {
//     try {
//       if (resume) await deleteResume();
//       setResumeFile(null);
//       setPdfPreviewUrl(null);
//       setExtractedText(null);
//       setShowCareerChat(false);
//       setAnalysis(null);
//       setHasLoadedAnalysis(false);
//     } catch (error) {
//       toast({
//         title: 'Delete Failed',
//         description: 'Could not delete resume. Please try again.',
//         variant: 'destructive'
//       });
//     }
//   };

//   const handleDownload = () => {
//     if (resume?.file_url) window.open(resume.file_url, '_blank');
//   };

//   const handleStartCareerChat = () => setShowCareerChat(true);

//   const handleRefreshData = async () => {
//     setIsRefreshing(true);
//     setHasLoadedAnalysis(false);
//     setStorageError(null);
//     try {
//       await refreshResume();
//       toast({
//         title: 'Refreshed',
//         description: 'Resume data has been refreshed.'
//       });
//     } catch (error: any) {
//       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
//         setStorageError("Resume storage is not properly configured. Please contact support.");
//       }
//       toast({
//         title: 'Refresh Failed',
//         description: 'Could not refresh resume data. Please try again.',
//         variant: 'destructive'
//       });
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   if (!isAuthenticated) return <ResumeLoginWall />;

//   const loading = resumeLoading || isAnalyzing || isRefreshing;

//   return (
//     <AppLayout fullWidth>
//       <div className="mx-auto py-6 space-y-6 px-6 max-w-full">
//         <div className="flex justify-between items-center">
//           <h1 className="text-2xl font-bold">Resume Management</h1>
          
//           <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
//             <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
//             Refresh Data
//           </Button>
//         </div>

//         {storageError && <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertTitle>Storage Error</AlertTitle>
//             <AlertDescription>
//               {storageError}
//             </AlertDescription>
//           </Alert>}

//         {careerAlignments && careerAlignments.length > 0 && (
//           <div className="space-y-2">
//             {careerAlignments.map((alignment, index) => (
//               <Alert
//                 key={index}
//                 className={`${index === 0 ? "bg-accent/20 border border-accent" : "bg-slate-50 border border-slate-200"}`}
//               >
//                 <AlertDescription>
//                   {alignment.description}
//                 </AlertDescription>
//               </Alert>
//             ))}
//           </div>
//         )}

//         <div className="grid md:grid-cols-2 gap-6">
//           <ResumeUploadSection
//             resumeFile={resumeFile}
//             setResumeFile={setResumeFile}
//             resume={resume}
//             loading={loading}
//             uploading={uploading}
//             isAnalyzing={isAnalyzing}
//             handleUpload={handleUpload}
//             handleDelete={handleDelete}
//             handleFileChange={handleFileChange}
//             handleDownload={handleDownload}
//             pdfPreviewUrl={pdfPreviewUrl}
//           />

//           <ResumeAnalysisSection
//             loading={loading}
//             isAnalyzing={isAnalyzing}
//             analysis={analysis}
//             resume={resume}
//             handleStartCareerChat={handleStartCareerChat}
//             handleFileChange={handleFileChange}
//           />
//         </div>

//         {showCareerChat && analysis && <ResumeChat resumeAnalysis={analysis} />}

//         <details open className="border rounded-md bg-white shadow-sm">
//           <summary className="cursor-pointer px-4 py-2 font-medium">Storytelling Analysis</summary>
//           <div className="p-4">
//             {analysis?.bullets && analysis.bullets.length > 0 ? (
//               <BulletPointsAnalysisCard bullets={analysis.bullets} />
//             ) : (
//               <p className="text-gray-500">
//                 No bullet‑point analysis available. Upload and analyze your resume
//                 to see detailed feedback.
//               </p>
//             )}
//           </div>
//         </details>
//       </div>
//     </AppLayout>
//   );
// };

// export default Resume;
