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
import { useResumeStorage, extractTextFromFile } from '@/hooks/resume/useResumeStorage';
import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { resume, loading: resumeLoading, uploading, uploadResume, deleteResume, refreshResume } = useResume();
  const { analysis, isAnalyzing, analyzeResume, careerAlignments, setAnalysis } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textExtractionComplete, setTextExtractionComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (initialLoadComplete || !user) return;
      
      try {
        console.log("Initial data load started");
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
        console.log("Loading analysis from resume object:", resume.analysis);
        setAnalysis(resume.analysis);
        setHasLoadedAnalysis(true);
      } catch (err) {
        console.error("Error setting analysis from resume:", err);
      }
    }
  }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

  // Process file when it's selected
  useEffect(() => {
    if (!resumeFile) return;
    setTextExtractionComplete(false);

    const reader = new FileReader();
    reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
    reader.readAsDataURL(resumeFile);

    (async () => {
      try {
        const text = await extractTextFromFile(resumeFile);
        setExtractedText(text);
        setTextExtractionComplete(true);
        
        // Automatically trigger upload when text extraction is complete
        if (!isDeleting && !uploading) {
          console.log("Text extraction complete, triggering upload automatically");
          handleUpload();
        }
      } catch (err) {
        console.error(err);
        toast({
          title: 'Extraction failed',
          description: 'Could not extract text from your resume.',
          variant: 'destructive',
        });
      }
    })();
  }, [resumeFile, toast]);

  useEffect(() => {
    if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
      console.log("Analyzing existing resume text");
      analyzeResume(resume.text)
        .then(success => {
          if (success) {
            setHasLoadedAnalysis(true);
          }
        })
        .catch(err => {
          console.error("Error analyzing resume:", err);
        });
    }
  }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      console.log("File selected:", file.name);
      setResumeFile(file);
      setHasLoadedAnalysis(false);
      // Upload will be triggered automatically after text extraction
    } else {
      toast({
        title: 'Invalid type',
        description: 'Only PDF or DOCX allowed.',
        variant: 'destructive',
      });
    }
  };

  const handleUpload = async () => {
    if (!resumeFile || !extractedText) {
      toast({
        title: 'Wait',
        description: 'Still extracting text or no file selected.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log("Starting upload process for:", resumeFile.name);
    setHasLoadedAnalysis(false);
    setStorageError(null);
    
    try {
      console.log("Uploading file to server...");
      const ok = await uploadResume(resumeFile);
      if (ok) {
        console.log("Upload successful, analyzing text...");
        try {
          // Use the locally extracted text which is more reliable
          await analyzeResume(extractedText);
          setHasLoadedAnalysis(true);
          
          console.log("Analysis complete!");
          toast({
            title: 'Success',
            description: 'Resume uploaded and analyzed successfully.',
          });
        } catch (error) {
          console.error('Error analyzing resume:', error);
          toast({
            title: 'Analysis Error',
            description: 'Resume was uploaded but analysis failed. You can try again later.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
      }
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // First reset local state
      setResumeFile(null);
      setPdfDataUrl(null);
      setExtractedText(null);
      setShowCareerChat(false);
      setAnalysis(null);
      setHasLoadedAnalysis(false);
      setInitialLoadComplete(false);
      setTextExtractionComplete(false);
      
      console.log("Local state reset, deleting from server...");
      
      // Then delete from server
      if (resume) await deleteResume();
      
      // Add a small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force a refresh
      console.log("Refreshing resume data...");
      await refreshResume();
      
      toast({
        title: 'Deleted',
        description: 'Your resume has been deleted.',
      });
    } catch (error) {
      console.error('Error in handleDelete:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete resume. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
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
      toast({
        title: 'Refreshed',
        description: 'Resume data has been refreshed.',
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        setStorageError("Resume storage is not properly configured. Please contact support.");
      }
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh resume data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isAuthenticated) return <ResumeLoginWall />;

  const loading = resumeLoading || isAnalyzing || isRefreshing;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Resume Management</h1>
          
          <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {storageError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Storage Error</AlertTitle>
            <AlertDescription>
              {storageError}
            </AlertDescription>
          </Alert>
        )}

        {careerAlignments && careerAlignments.length > 0 && (
          <div className="space-y-2">
            {careerAlignments.map((alignment, index) => (
              <Alert key={index} className={`${
                index === 0 
                  ? "bg-accent/20 border border-accent" 
                  : "bg-slate-50 border border-slate-200"
              }`}>
                <AlertDescription>
                  {alignment.description}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <ResumeUploadSection
            deleting={isDeleting}
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
            pdfDataUrl={pdfDataUrl}
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
          <summary className="cursor-pointer px-4 py-2 font-medium">
            Resume Bullet Analysis
          </summary>
          <div className="p-4">
            {analysis?.bullets && analysis.bullets.length > 0 ? (
              <BulletPointsAnalysisCard bullets={analysis.bullets} />
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
// import { useResumeStorage, extractTextFromFile } from '@/hooks/resume/useResumeStorage';
// import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { Button } from '@/components/ui/button';
// import { AlertCircle, RefreshCw } from 'lucide-react';

// const Resume = () => {
//   const { user, isAuthenticated } = useAuth();
//   const { toast } = useToast();
//   const [resumeFile, setResumeFile] = useState<File | null>(null);
//   const { resume, loading: resumeLoading, uploading, uploadResume, deleteResume, refreshResume } = useResume();
//   const { analysis, isAnalyzing, analyzeResume, careerAlignments, setAnalysis } = useResumeAnalysis();
//   const [showCareerChat, setShowCareerChat] = useState(false);
//   const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
//   const [extractedText, setExtractedText] = useState<string | null>(null);
//   const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
//   const [initialLoadComplete, setInitialLoadComplete] = useState(false);
//   const [storageError, setStorageError] = useState<string | null>(null);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);

//   useEffect(() => {
//     let isMounted = true;
    
//     const loadInitialData = async () => {
//       if (initialLoadComplete || !user) return;
      
//       try {
//         console.log("Initial data load started");
//         setStorageError(null);
//         await refreshResume();
//         setInitialLoadComplete(true);
//       } catch (err) {
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
//         console.log("Loading analysis from resume object:", resume.analysis);
//         setAnalysis(resume.analysis);
//         setHasLoadedAnalysis(true);
//       } catch (err) {
//         console.error("Error setting analysis from resume:", err);
//       }
//     }
//   }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

//   useEffect(() => {
//     if (!resumeFile) return;

//     const reader = new FileReader();
//     reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
//     reader.readAsDataURL(resumeFile);

//     (async () => {
//       try {
//         const text = await extractTextFromFile(resumeFile);
//         setExtractedText(text);
//       } catch (err) {
//         console.error(err);
//         toast({
//           title: 'Extraction failed',
//           description: 'Could not extract text from your resume.',
//           variant: 'destructive',
//         });
//       }
//     })();
//   }, [resumeFile, toast]);

//   useEffect(() => {
//     if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
//       console.log("Analyzing existing resume text");
//       analyzeResume(resume.text)
//         .then(success => {
//           if (success) {
//             setHasLoadedAnalysis(true);
//           }
//         })
//         .catch(err => {
//           console.error("Error analyzing resume:", err);
//         });
//     }
//   }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (
//       file.type === 'application/pdf' ||
//       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//     ) {
//       setResumeFile(file);
//       setHasLoadedAnalysis(false);
//     } else {
//       toast({
//         title: 'Invalid type',
//         description: 'Only PDF or DOCX allowed.',
//         variant: 'destructive',
//       });
//     }
//   };

//   const handleUpload = async () => {
//     if (!resumeFile || !extractedText) {
//       toast({
//         title: 'Wait',
//         description: 'Still extracting text or no file selected.',
//         variant: 'destructive',
//       });
//       return;
//     }
    
//     setHasLoadedAnalysis(false);
//     setStorageError(null);
    
//     try {
//       const ok = await uploadResume(resumeFile);
//       if (ok) {
//         try {
//           // Use the locally extracted text which is more reliable
//           await analyzeResume(extractedText);
//           setHasLoadedAnalysis(true);
          
//           toast({
//             title: 'Success',
//             description: 'Resume uploaded and analyzed successfully.',
//           });
//         } catch (error) {
//           console.error('Error analyzing resume:', error);
//           toast({
//             title: 'Analysis Error',
//             description: 'Resume was uploaded but analysis failed. You can try again later.',
//             variant: 'destructive',
//           });
//         }
//       }
//     } catch (error) {
//       console.error('Error uploading resume:', error);
//       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
//         setStorageError("Resume storage is not properly configured. Please contact support.");
//       }
//     }
//   };

//   const handleDelete = async () => {
//     setIsDeleting(true);
//     try {
//       // First reset local state
//       setResumeFile(null);
//       setPdfDataUrl(null);
//       setExtractedText(null);
//       setShowCareerChat(false);
//       setAnalysis(null);
//       setHasLoadedAnalysis(false);
//       setInitialLoadComplete(false);
      
//       // Then delete from server
//       if (resume) await deleteResume();
      
//       // Add a small delay to ensure state updates
//       await new Promise(resolve => setTimeout(resolve, 500));
      
//       // Force a refresh
//       await refreshResume();
      
//       toast({
//         title: 'Deleted',
//         description: 'Your resume has been deleted.',
//       });
//     } catch (error) {
//       console.error('Error in handleDelete:', error);
//       toast({
//         title: 'Delete Failed',
//         description: 'Could not delete resume. Please try again.',
//         variant: 'destructive',
//       });
//     } finally {
//       setIsDeleting(false);
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
//         description: 'Resume data has been refreshed.',
//       });
//     } catch (error) {
//       console.error('Error refreshing data:', error);
//       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
//         setStorageError("Resume storage is not properly configured. Please contact support.");
//       }
//       toast({
//         title: 'Refresh Failed',
//         description: 'Could not refresh resume data. Please try again.',
//         variant: 'destructive',
//       });
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   if (!isAuthenticated) return <ResumeLoginWall />;

//   const loading = resumeLoading || isAnalyzing || isRefreshing;

//   return (
//     <AppLayout>
//       <div className="container mx-auto py-6 space-y-6">
//         <div className="flex justify-between items-center">
//           <h1 className="text-2xl font-bold">Resume Management</h1>
          
//           <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
//             <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
//             Refresh Data
//           </Button>
//         </div>

//         {storageError && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertTitle>Storage Error</AlertTitle>
//             <AlertDescription>
//               {storageError}
//             </AlertDescription>
//           </Alert>
//         )}

//         {careerAlignments && careerAlignments.length > 0 && (
//           <div className="space-y-2">
//             {careerAlignments.map((alignment, index) => (
//               <Alert key={index} className={`${
//                 index === 0 
//                   ? "bg-accent/20 border border-accent" 
//                   : "bg-slate-50 border border-slate-200"
//               }`}>
//                 <AlertDescription>
//                   {alignment.description}
//                 </AlertDescription>
//               </Alert>
//             ))}
//           </div>
//         )}

//         <div className="grid md:grid-cols-2 gap-6">
//           <ResumeUploadSection
//             deleting={isDeleting}
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
//             pdfDataUrl={pdfDataUrl}
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
//           <summary className="cursor-pointer px-4 py-2 font-medium">
//             Resume Bullet Analysis
//           </summary>
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
// import { useResumeStorage, extractTextFromFile } from '@/hooks/resume/useResumeStorage';
// import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { Button } from '@/components/ui/button';
// import { AlertCircle, RefreshCw } from 'lucide-react';

// const Resume = () => {
//   const { user, isAuthenticated } = useAuth();
//   const { toast } = useToast();
//   const [resumeFile, setResumeFile] = useState<File | null>(null);
//   const { resume, loading: resumeLoading, uploading, uploadResume, deleteResume, refreshResume } = useResume();
//   const { analysis, isAnalyzing, analyzeResume, careerAlignments, setAnalysis } = useResumeAnalysis();
//   const [showCareerChat, setShowCareerChat] = useState(false);
//   const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
//   const [extractedText, setExtractedText] = useState<string | null>(null);
//   const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
//   const [initialLoadComplete, setInitialLoadComplete] = useState(false);
//   const [storageError, setStorageError] = useState<string | null>(null);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const [pendingFileUpload, setPendingFileUpload] = useState<boolean>(false);

//   // Reset all local state
//   const resetLocalState = () => {
//     setResumeFile(null);
//     setPdfDataUrl(null);
//     setExtractedText(null);
//     setShowCareerChat(false);
//     setAnalysis(null);
//     setHasLoadedAnalysis(false);
//     setInitialLoadComplete(false);
//   };

//   // Utility function to wait for resume text to be available
//   // const waitForResumeText = async (maxRetries = 5, delayMs = 1000): Promise<string> => {
//   //   for (let i = 0; i < maxRetries; i++) {
//   //     await refreshResume();
      
//   //     if (resume?.text) {
//   //       console.log(`Got resume text after ${i+1} retries`);
//   //       return resume.text;
//   //     }
      
//   //     console.log(`Waiting for resume text (retry ${i+1}/${maxRetries})...`);
//   //     await new Promise(r => setTimeout(r, delayMs));
//   //   }
    
//   //   throw new Error("Resume text not available after multiple retries");
//   // };
// // Update the waitForResumeText function to check the resume object more intelligently
// const waitForResumeText = async (maxRetries = 5, delayMs = 1000): Promise<string> => {
//   let resumeId = resume?.id;
  
//   for (let i = 0; i < maxRetries; i++) {
//     console.log(`Attempt ${i+1}/${maxRetries} to get resume text`);
    
//     // If we have a resume with text already, use it
//     if (resume?.text) {
//       console.log(`Found text in existing resume object (${resume.text.length} chars)`);
//       return resume.text;
//     }
    
//     // Explicitly check if extractedText is available from the file (use this as fallback)
//     if (extractedText) {
//       console.log(`Using locally extracted text (${extractedText.length} chars)`);
//       return extractedText;
//     }
    
//     // Force a refresh to try to get updated data
//     await refreshResume();
    
//     // After refresh, if we have a new resume with a different ID, use its text
//     if (resume?.id && resume.id !== resumeId) {
//       resumeId = resume.id;
//       console.log(`Resume ID changed to ${resumeId}`);
//     }
    
//     // Wait before next attempt if we haven't found text yet
//     if (!resume?.text && !extractedText) {
//       console.log(`No resume text found yet, waiting ${delayMs}ms before retry ${i+2}/${maxRetries}...`);
//       await new Promise(r => setTimeout(r, delayMs));
//     }
//   }
  
//   // Last fallback - if we have extractedText by now, use it
//   if (extractedText) {
//     console.log(`Falling back to locally extracted text after retries (${extractedText.length} chars)`);
//     return extractedText;
//   }
  
//   // If we have a resume but no text, warn but give a more detailed error
//   if (resume?.id) {
//     console.error(`Resume exists (ID: ${resume.id}) but no text is available`);
//   }
  
//   throw new Error("Resume text not available after multiple retries");
// };
//   // Initial data load when component mounts
//   useEffect(() => {
//     let isMounted = true;
    
//     const loadInitialData = async () => {
//       if (initialLoadComplete || !user) return;
      
//       try {
//         console.log("Initial data load started");
//         setStorageError(null);
//         await refreshResume();
//         setInitialLoadComplete(true);
//       } catch (err) {
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

//   // Load analysis from resume data if available
//   useEffect(() => {
//     if (resume?.analysis && !analysis && !hasLoadedAnalysis && user) {
//       try {
//         console.log("Loading analysis from resume object:", resume.analysis);
//         setAnalysis(resume.analysis);
//         setHasLoadedAnalysis(true);
//       } catch (err) {
//         console.error("Error setting analysis from resume:", err);
//       }
//     }
//   }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

//   // Handle pending file upload after deletion completes
//   useEffect(() => {
//     const processPendingUpload = async () => {
//       if (pendingFileUpload && resumeFile && !isDeleting && !uploading) {
//         console.log("Processing pending file upload after deletion");
//         setPendingFileUpload(false);
//         await handleUpload();
//       }
//     };
    
//     processPendingUpload();
//   }, [pendingFileUpload, resumeFile, isDeleting, uploading]);

//   // Extract text from selected file
//   useEffect(() => {
//     if (!resumeFile) return;

//     const reader = new FileReader();
//     reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
//     reader.readAsDataURL(resumeFile);

//     (async () => {
//       try {
//         const text = await extractTextFromFile(resumeFile);
//         setExtractedText(text);
//       } catch (err) {
//         console.error(err);
//         toast({
//           title: 'Extraction failed',
//           description: 'Could not extract text from your resume.',
//           variant: 'destructive',
//         });
//       }
//     })();
//   }, [resumeFile, toast]);

//   // Analyze existing resume text if available
//   useEffect(() => {
//     if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
//       console.log("Analyzing existing resume text");
//       analyzeResume(resume.text)
//         .then(success => {
//           if (success) {
//             setHasLoadedAnalysis(true);
//           }
//         })
//         .catch(err => {
//           console.error("Error analyzing resume:", err);
//         });
//     }
//   }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

//   // Handle file selection
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     if (
//       file.type === 'application/pdf' ||
//       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//     ) {
//       setResumeFile(file);
//       setHasLoadedAnalysis(false);
      
//       // If we're in the process of deleting, queue this upload for after deletion completes
//       if (isDeleting) {
//         console.log("Queueing file upload for after deletion completes");
//         setPendingFileUpload(true);
//       } else {
//         // Otherwise, upload immediately
//         handleUpload();
//       }
//     } else {
//       toast({
//         title: 'Invalid type',
//         description: 'Only PDF or DOCX allowed.',
//         variant: 'destructive',
//       });
//     }
//   };

//   // Handle resume upload
//   // const handleUpload = async () => {
//   //   if (!resumeFile) {
//   //     toast({
//   //       title: 'Wait',
//   //       description: 'No file selected.',
//   //       variant: 'destructive',
//   //     });
//   //     return;
//   //   }
    
//   //   setHasLoadedAnalysis(false);
//   //   setStorageError(null);
    
//   //   try {
//   //     // Step 1: Upload the resume
//   //     console.log("Uploading resume file:", resumeFile.name);
//   //     const uploadOk = await uploadResume(resumeFile);
//   //     if (!uploadOk) {
//   //       toast({
//   //         title: 'Upload Failed',
//   //         description: 'Could not upload resume. Please try again.',
//   //         variant: 'destructive',
//   //       });
//   //       return;
//   //     }
      
//   //     // Step 2: Wait for text to be available with retries
//   //     console.log("Waiting for resume text to be available...");
//   //     let resumeText;
//   //     try {
//   //       resumeText = await waitForResumeText(5, 1000);
//   //     } catch (textError) {
//   //       console.error('Text extraction error:', textError);
//   //       toast({
//   //         title: 'Processing Issue',
//   //         description: 'Resume uploaded but text extraction failed. Please try again or refresh the page.',
//   //         variant: 'destructive',
//   //       });
//   //       return;
//   //     }
      
//   //     // Step 3: Analyze the resume text
//   //     console.log("Analyzing resume text:", resumeText.substring(0, 100) + "...");
//   //     await analyzeResume(resumeText);
//   //     setHasLoadedAnalysis(true);
      
//   //     toast({
//   //       title: 'Success',
//   //       description: 'Resume uploaded and analyzed successfully.',
//   //     });
//   //   } catch (error) {
//   //     console.error('Error in handleUpload:', error);
//   //     toast({
//   //       title: 'Process Failed',
//   //       description: 'An error occurred during upload or analysis. Please try again.',
//   //       variant: 'destructive',
//   //     });
//   //   }
//   // };
// const handleUpload = async () => {
//   if (!resumeFile) {
//     toast({
//       title: 'Wait',
//       description: 'No file selected.',
//       variant: 'destructive',
//     });
//     return;
//   }
  
//   setHasLoadedAnalysis(false);
//   setStorageError(null);
  
//   try {
//     // Step 1: Upload the resume
//     console.log("Uploading resume file:", resumeFile.name);
//     const uploadOk = await uploadResume(resumeFile);
//     if (!uploadOk) {
//       toast({
//         title: 'Upload Failed',
//         description: 'Could not upload resume. Please try again.',
//         variant: 'destructive',
//       });
//       return;
//     }
    
//     // Step 2: Try to get text from any available source
//     let textToAnalyze: string | null = null;
    
//     // First try to get it from the database record
//     try {
//       textToAnalyze = await waitForResumeText(3, 1000);
//     } catch (textError) {
//       console.log('Could not get text from database, checking local extraction:', textError);
      
//       // Fallback to locally extracted text if available
//       if (extractedText) {
//         console.log(`Using locally extracted text (${extractedText.length} chars)`);
//         textToAnalyze = extractedText;
//       }
//     }
    
//     // If we still don't have text, show error
//     if (!textToAnalyze) {
//       console.error('No text available for analysis from any source');
//       toast({
//         title: 'Processing Issue',
//         description: 'Could not extract text from resume. Please try again or try another file format.',
//         variant: 'destructive',
//       });
//       return;
//     }
    
//     // Step 3: Analyze the resume text
//     console.log(`Analyzing resume text (${textToAnalyze.length} chars): ${textToAnalyze.substring(0, 100)}...`);
//     await analyzeResume(textToAnalyze);
//     setHasLoadedAnalysis(true);
    
//     toast({
//       title: 'Success',
//       description: 'Resume uploaded and analyzed successfully.',
//     });
//   } catch (error) {
//     console.error('Error in handleUpload:', error);
//     toast({
//       title: 'Process Failed',
//       description: 'An error occurred during upload or analysis. Please try again.',
//       variant: 'destructive',
//     });
//   }
// };
//   // Handle resume deletion
//   const handleDelete = async () => {
//     setIsDeleting(true);
//     try {
//       // Reset all local state first
//       resetLocalState();
      
//       // Then attempt the server-side deletion
//       await deleteResume().catch(err => {
//         // Continue even if there's an error deleting
//         console.log("Delete error (continuing anyway):", err.message);
//       });
      
//       // Force a complete refresh of resume data
//       await refreshResume();
      
//       toast({ 
//         title: 'Reset', 
//         description: 'Resume data has been cleared.' 
//       });
      
//       // Add a small delay to ensure all state updates have propagated
//       await new Promise(resolve => setTimeout(resolve, 500));
//     } catch (error) {
//       console.error('Error in handleDelete:', error);
//       toast({
//         title: 'Reset Failed',
//         description: 'Could not fully reset resume data. Try refreshing the page.',
//         variant: 'destructive',
//       });
//     } finally {
//       setIsDeleting(false);
//     }
//   };

//   // Handle file download
//   const handleDownload = () => {
//     if (resume?.file_url) window.open(resume.file_url, '_blank');
//   };

//   // Handle career chat button click
//   const handleStartCareerChat = () => setShowCareerChat(true);

//   // Handle refresh data button click
//   const handleRefreshData = async () => {
//     setIsRefreshing(true);
//     setHasLoadedAnalysis(false);
//     setStorageError(null);
    
//     try {
//       await refreshResume();
//       toast({
//         title: 'Refreshed',
//         description: 'Resume data has been refreshed.',
//       });
//     } catch (error) {
//       console.error('Error refreshing data:', error);
//       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
//         setStorageError("Resume storage is not properly configured. Please contact support.");
//       }
//       toast({
//         title: 'Refresh Failed',
//         description: 'Could not refresh resume data. Please try again.',
//         variant: 'destructive',
//       });
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   if (!isAuthenticated) return <ResumeLoginWall />;

//   const loading = resumeLoading || isAnalyzing || isRefreshing;

//   return (
//     <AppLayout>
//       <div className="container mx-auto py-6 space-y-6">
//         <div className="flex justify-between items-center">
//           <h1 className="text-2xl font-bold">Resume Management</h1>
          
//           <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
//             <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
//             Refresh Data
//           </Button>
//         </div>

//         {storageError && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertTitle>Storage Error</AlertTitle>
//             <AlertDescription>
//               {storageError}
//             </AlertDescription>
//           </Alert>
//         )}

//         {careerAlignments && careerAlignments.length > 0 && (
//           <div className="space-y-2">
//             {careerAlignments.map((alignment, index) => (
//               <Alert key={index} className={`${
//                 index === 0 
//                   ? "bg-accent/20 border border-accent" 
//                   : "bg-slate-50 border border-slate-200"
//               }`}>
//                 <AlertDescription>
//                   {alignment.description}
//                 </AlertDescription>
//               </Alert>
//             ))}
//           </div>
//         )}

//         <div className="grid md:grid-cols-2 gap-6">
//           <ResumeUploadSection
//             deleting={isDeleting}
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
//             pdfDataUrl={pdfDataUrl}
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
//           <summary className="cursor-pointer px-4 py-2 font-medium">
//             Resume Bullet Analysis
//           </summary>
//           <div className="p-4">
//             {analysis?.bullets && analysis.bullets.length > 0 ? (
//               <BulletPointsAnalysisCard bullets={analysis.bullets} />
//             ) : (
//               <p className="text-gray-500">
//                 No bullet-point analysis available. Upload and analyze your resume
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
// // import React, { useState, useEffect } from 'react';
// // import AppLayout from '@/components/layout/AppLayout';
// // import { useAuth } from '@/contexts/AuthContext';
// // import { useToast } from '@/hooks/use-toast';
// // import { useResume } from '@/hooks/resume/useResume';
// // import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
// // import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
// // import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
// // import ResumeChat from '@/components/resume/ResumeChat';
// // import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
// // import { useResumeStorage, extractTextFromFile } from '@/hooks/resume/useResumeStorage';
// // import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
// // import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// // import { Button } from '@/components/ui/button';
// // import { AlertCircle, RefreshCw } from 'lucide-react';


// // const Resume = () => {
// //   const { user, isAuthenticated } = useAuth();
// //   const { toast } = useToast();
// //   const [resumeFile, setResumeFile] = useState<File | null>(null);
// //   const { resume, loading: resumeLoading, uploading, uploadResume, deleteResume, refreshResume } = useResume();
// //   const { analysis, isAnalyzing, analyzeResume, careerAlignments, setAnalysis } = useResumeAnalysis();
// //   const [showCareerChat, setShowCareerChat] = useState(false);
// //   const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
// //   const [extractedText, setExtractedText] = useState<string | null>(null);
// //   const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);
// //   const [initialLoadComplete, setInitialLoadComplete] = useState(false);
// //   const [storageError, setStorageError] = useState<string | null>(null);
// //   const [isRefreshing, setIsRefreshing] = useState(false);
// //   const [isDeleting, setIsDeleting] = useState(false)
// //   const resetLocalState = () => {
// //     setResumeFile(null)
// //     setPdfDataUrl(null)
// //     setExtractedText(null)
// //     setShowCareerChat(false)
// //     setAnalysis(null)
// //     setHasLoadedAnalysis(false)
// //     setInitialLoadComplete(false)
// //   }

// //   useEffect(() => {
// //     let isMounted = true;
    
// //     const loadInitialData = async () => {
// //       if (initialLoadComplete || !user) return;
      
// //       try {
// //         console.log("Initial data load started");
// //         setStorageError(null);
// //         await refreshResume();
// //         setInitialLoadComplete(true);
// //       } catch (err) {
// //         console.error("Error in initial data load:", err);
// //         if (err.message?.includes('bucket') || err.message?.includes('storage')) {
// //           setStorageError("Resume storage is not properly configured. Please contact support.");
// //         }
// //       }
// //     };
    
// //     loadInitialData();
    
// //     return () => {
// //       isMounted = false;
// //     };
// //   }, [user, initialLoadComplete, refreshResume]);

// //   useEffect(() => {
// //     if (resume?.analysis && !analysis && !hasLoadedAnalysis && user) {
// //       try {
// //         console.log("Loading analysis from resume object:", resume.analysis);
// //         setAnalysis(resume.analysis);
// //         setHasLoadedAnalysis(true);
// //       } catch (err) {
// //         console.error("Error setting analysis from resume:", err);
// //       }
// //     }
// //   }, [resume, analysis, setAnalysis, hasLoadedAnalysis, user]);

// //   useEffect(() => {
// //     if (!resumeFile) return;

// //     const reader = new FileReader();
// //     reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
// //     reader.readAsDataURL(resumeFile);

// //     (async () => {
// //       try {
// //         const text = await extractTextFromFile(resumeFile);
// //         setExtractedText(text);
// //       } catch (err) {
// //         console.error(err);
// //         toast({
// //           title: 'Extraction failed',
// //           description: 'Could not extract text from your resume.',
// //           variant: 'destructive',
// //         });
// //       }
// //     })();
// //   }, [resumeFile, toast]);

// //   useEffect(() => {
// //     if (resume?.text && !analysis && !isAnalyzing && !hasLoadedAnalysis && initialLoadComplete) {
// //       console.log("Analyzing existing resume text");
// //       analyzeResume(resume.text)
// //         .then(success => {
// //           if (success) {
// //             setHasLoadedAnalysis(true);
// //           }
// //         })
// //         .catch(err => {
// //           console.error("Error analyzing resume:", err);
// //         });
// //     }
// //   }, [resume, analysis, analyzeResume, isAnalyzing, hasLoadedAnalysis, initialLoadComplete]);

// //   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// //     const file = e.target.files?.[0];
// //     if (!file) return;
// //     if (
// //       file.type === 'application/pdf' ||
// //       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// //     ) {
// //       setResumeFile(file);
// //       setHasLoadedAnalysis(false);
// //     } else {
// //       toast({
// //         title: 'Invalid type',
// //         description: 'Only PDF or DOCX allowed.',
// //         variant: 'destructive',
// //       });
// //     }
// //   };


// // const handleUpload = async () => {
// //   if (!resumeFile) {
// //     toast({
// //       title: 'Wait',
// //       description: 'No file selected.',
// //       variant: 'destructive',
// //     });
// //     return;
// //   }
  
// //   setHasLoadedAnalysis(false);
// //   setStorageError(null);
  
// //   try {
// //     // 1. Upload the resume
// //     const uploadOk = await uploadResume(resumeFile);
// //     if (!uploadOk) {
// //       toast({
// //         title: 'Upload Failed',
// //         description: 'Could not upload resume. Please try again.',
// //         variant: 'destructive',
// //       });
// //       return;
// //     }
    
// //     // // 2. Force a refresh to get the latest resume data
// //     // await refreshResume();
    
// //     // // 3. Verify we have resume text before analyzing
// //     // if (!resume?.text) {
// //     //   console.log("Resume uploaded but text not available. Waiting for text extraction...");
// //     //   toast({
// //     //     title: 'Processing',
// //     //     description: 'Resume uploaded. Text extraction in progress...',
// //     //   });
      
// //     //   // Optional: Could add a retry mechanism here to wait for text
// //     //   return;
// //     // }
// //     // In the handleUpload function, replace steps 2-3 with:
    
// //     // 2. Wait for text to be available
// //     let resumeText;
// //     try {
// //       resumeText = await waitForResumeText();
// //     } catch (textError) {
// //       console.error('Text extraction error:', textError);
// //       toast({
// //         title: 'Processing Issue',
// //         description: 'Resume uploaded but text extraction failed. Please try again.',
// //         variant: 'destructive',
// //       });
// //       return;
// //     }
    
// //     // 3. Analyze the resume with the extracted text
// //     console.log("Analyzing resume text:", resumeText.substring(0, 100) + "...");
// //     await analyzeResume(resumeText);
    
// //     // // 4. Analyze the resume
// //     // console.log("Analyzing resume text:", resume.text.substring(0, 100) + "...");
// //     // await analyzeResume(resume.text);
// //     setHasLoadedAnalysis(true);
    
// //     toast({
// //       title: 'Success',
// //       description: 'Resume uploaded and analyzed successfully.',
// //     });
// //   } catch (error) {
// //     console.error('Error in handleUpload:', error);
// //     toast({
// //       title: 'Process Failed',
// //       description: 'An error occurred during upload or analysis. Please try again.',
// //       variant: 'destructive',
// //     });
    
// //     // Don't reset state on error - keep the file if it was uploaded
// //   }
// // };  


// // const handleDelete = async () => {
// //   setIsDeleting(true);
// //   try {
// //     await deleteResume().catch(err => {
// //       // Continue even if there's an error deleting
// //       console.log("Delete error (continuing anyway):", err.message);
// //     });
    
// //     // Always reset state regardless of delete success
// //     // setResumeFile(null);
// //     // setPdfDataUrl(null);
// //     // setExtractedText(null);
// //     // setShowCareerChat(false);
// //     // setAnalysis(null);
// //     // setHasLoadedAnalysis(false);
// //     // setInitialLoadComplete(false); // Reset loading flag

// //     resetLocalState()
    
// //     toast({ title: 'Reset', description: 'Resume data has been cleared.' });
    
// //     // Force a refresh of the component state
// //     await refreshResume();
// //   } catch (error) {
// //     console.error('Error in handleDelete:', error);
// //     toast({
// //       title: 'Reset Failed',
// //       description: 'Could not fully reset resume data. Try refreshing the page.',
// //       variant: 'destructive',
// //     });
// //   } finally {
// //     setIsDeleting(false);
// //   }
// // };


// //   const handleDownload = () => {
// //     if (resume?.file_url) window.open(resume.file_url, '_blank');
// //   };

// //   const handleStartCareerChat = () => setShowCareerChat(true);

// //   const handleRefreshData = async () => {
// //     setIsRefreshing(true);
// //     setHasLoadedAnalysis(false);
// //     setStorageError(null);
    
// //     try {
// //       await refreshResume();
// //       toast({
// //         title: 'Refreshed',
// //         description: 'Resume data has been refreshed.',
// //       });
// //     } catch (error) {
// //       console.error('Error refreshing data:', error);
// //       if (error.message?.includes('bucket') || error.message?.includes('storage')) {
// //         setStorageError("Resume storage is not properly configured. Please contact support.");
// //       }
// //       toast({
// //         title: 'Refresh Failed',
// //         description: 'Could not refresh resume data. Please try again.',
// //         variant: 'destructive',
// //       });
// //     } finally {
// //       setIsRefreshing(false);
// //     }
// //   };

// //   if (!isAuthenticated) return <ResumeLoginWall />;

// //   const loading = resumeLoading || isAnalyzing || isRefreshing;

// //   return (
// //     <AppLayout>
// //       <div className="container mx-auto py-6 space-y-6">
// //         <div className="flex justify-between items-center">
// //           <h1 className="text-2xl font-bold">Resume Management</h1>
          
// //           <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
// //             <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
// //             Refresh Data
// //           </Button>
// //         </div>

// //         {storageError && (
// //           <Alert variant="destructive">
// //             <AlertCircle className="h-4 w-4" />
// //             <AlertTitle>Storage Error</AlertTitle>
// //             <AlertDescription>
// //               {storageError}
// //             </AlertDescription>
// //           </Alert>
// //         )}

// //         {careerAlignments && careerAlignments.length > 0 && (
// //           <div className="space-y-2">
// //             {careerAlignments.map((alignment, index) => (
// //               <Alert key={index} className={`${
// //                 index === 0 
// //                   ? "bg-accent/20 border border-accent" 
// //                   : "bg-slate-50 border border-slate-200"
// //               }`}>
// //                 <AlertDescription>
// //                   {alignment.description}
// //                 </AlertDescription>
// //               </Alert>
// //             ))}
// //           </div>
// //         )}

// //         <div className="grid md:grid-cols-2 gap-6">
// //           <ResumeUploadSection
// //             deleting={isDeleting}
// //             resumeFile={resumeFile}
// //             setResumeFile={setResumeFile}
// //             resume={resume}
// //             loading={loading}
// //             uploading={uploading}
// //             isAnalyzing={isAnalyzing}
// //             handleUpload={handleUpload}
// //             handleDelete={handleDelete}
// //             handleFileChange={handleFileChange}
// //             handleDownload={handleDownload}
// //             pdfDataUrl={pdfDataUrl}
// //           />

// //           <ResumeAnalysisSection
// //             loading={loading}
// //             isAnalyzing={isAnalyzing}
// //             analysis={analysis}
// //             resume={resume}
// //             handleStartCareerChat={handleStartCareerChat}
// //             handleFileChange={handleFileChange}
// //           />
// //         </div>

// //         {showCareerChat && analysis && <ResumeChat resumeAnalysis={analysis} />}

// //         <details open className="border rounded-md bg-white shadow-sm">
// //           <summary className="cursor-pointer px-4 py-2 font-medium">
// //             Resume Bullet Analysis
// //           </summary>
// //           <div className="p-4">
// //             {analysis?.bullets && analysis.bullets.length > 0 ? (
// //               <BulletPointsAnalysisCard bullets={analysis.bullets} />
// //             ) : (
// //               <p className="text-gray-500">
// //                 No bullet‑point analysis available. Upload and analyze your resume
// //                 to see detailed feedback.
// //               </p>
// //             )}
// //           </div>
// //         </details>
// //       </div>
// //     </AppLayout>
// //   );
// // };

// // export default Resume;
