import React, { useState, useEffect, useRef } from 'react';
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
  const [shouldUploadAfterExtraction, setShouldUploadAfterExtraction] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Force a complete reset of all application state
  const resetAllState = () => {
    // clear the actual file picker
    if (fileInputRef.current) fileInputRef.current.value = '';
    setResumeFile(null);
    setPdfDataUrl(null);
    setExtractedText(null);
    setShowCareerChat(false);
    setAnalysis(null);
    setHasLoadedAnalysis(false);
    setInitialLoadComplete(false);
    setShouldUploadAfterExtraction(false);
    localStorage.removeItem(`resume_analysis_${user?.id}`);
    localStorage.removeItem(`resume_text_${user?.id}`);
  };

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

  // Effect to extract text when file is selected
  useEffect(() => {
    if (!resumeFile) return;

    const reader = new FileReader();
    reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
    reader.readAsDataURL(resumeFile);

    (async () => {
      try {
        console.log("Starting text extraction for:", resumeFile.name);
        const text = await extractTextFromFile(resumeFile);
        setExtractedText(text);
        console.log("Text extraction complete, length:", text.length);
        
        // If we flagged to upload after extraction, do it now
        if (shouldUploadAfterExtraction && !isDeleting) {
          console.log("Auto-triggering upload after text extraction");
          setShouldUploadAfterExtraction(false);
          handleUpload();
        }
      } catch (err) {
        console.error("Text extraction error:", err);
        toast({
          title: 'Extraction failed',
          description: 'Could not extract text from your resume.',
          variant: 'destructive',
        });
      }
    })();
  }, [resumeFile, shouldUploadAfterExtraction, isDeleting, toast]);

  // Effect to analyze existing resume text
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

  // Handle file selection
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
      
      // Flag to trigger upload after extraction completes
      setShouldUploadAfterExtraction(true);
    } else {
      toast({
        title: 'Invalid type',
        description: 'Only PDF or DOCX allowed.',
        variant: 'destructive',
      });
    }
  };

  // Handle manual upload button click
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

  // Handle resume deletion
const handleDelete = async () => {
  setIsDeleting(true);
  try {
    resetAllState();
    console.log("Local state reset, deleting from server…");
    if (resume) await deleteResume();
    await refreshResume();
    toast({ title: 'Deleted', description: 'Your resume has been cleared.' });
  } catch (error) {
    toast({
      title: 'Delete Failed',
      description: 'Could not delete — please try again.',
      variant: 'destructive',
    });
  } finally {
    setIsDeleting(false);
  }
};

      
  //     // Add a small delay to ensure state updates
  //     await new Promise(resolve => setTimeout(resolve, 1000));
      
  //     toast({
  //       title: 'Deleted',
  //       description: 'Your resume has been deleted.',
  //     });

  //     // Force a complete reset
  //     window.location.reload();
  //   } catch (error) {
  //     console.error('Error in handleDelete:', error);
  //     toast({
  //       title: 'Delete Failed',
  //       description: 'Could not completely delete resume. Try refreshing the page.',
  //       variant: 'destructive',
  //     });
      
  //     // Force reload even after error
  //     window.location.reload();
  //   } finally {
  //     setIsDeleting(false);
  //   }
  // };

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
            fileInputRef={fileInputRef}
            deleting={isDeleting}
            resumeFile={resumeFile}
            setResumeFile={setResumeFile}
            resume={resume}
            loading={loading}
            uploading={uploading}
            isAnalyzing={isAnalyzing}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            {/* handleFileChange={handleFileChange} */}
            handleDownload={handleDownload}
            pdfDataUrl={pdfDataUrl}
            handleFileChange={e => {
              handleFileChange(e);
              // ensure any queued ref is reset
            }}
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
                No bullet-point analysis available. Upload and analyze your resume
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