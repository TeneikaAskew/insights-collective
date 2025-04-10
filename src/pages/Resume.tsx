
import React, { useState, useEffect, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
import ResumeChat from '@/components/resume/ResumeChat';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
import { Skeleton } from '@/components/ui/skeleton';

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("Caught in error boundary:", error);
      setHasError(true);
      setError(error.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
        <p className="text-red-600">{error?.message || 'Unknown error'}</p>
        <button 
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  
  // Force component to re-render after mount to ensure hooks are initialized properly
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    // Add a timeout to stop showing loading state even if something fails
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Carefully initialize hooks with error handling
  let resumeHookData = { resume: null, loading: true, uploading: false, uploadResume: async () => false, deleteResume: async () => false, refreshResume: async () => {} };
  let analysisHookData = { analysis: null, isAnalyzing: false, analyzeResume: async () => false };
  
  try {
    resumeHookData = useResume();
    analysisHookData = useResumeAnalysis();
  } catch (error) {
    console.error("Error initializing hooks:", error);
    toast({
      title: "Error initializing page",
      description: "There was a problem loading your resume data. Please try refreshing the page.",
      variant: "destructive",
    });
  }
  
  const { resume, loading, uploading, uploadResume, deleteResume, refreshResume } = resumeHookData;
  const { analysis, isAnalyzing, analyzeResume } = analysisHookData;
  const [showCareerChat, setShowCareerChat] = useState(false);
  
  // Load preview when resumeFile changes
  useEffect(() => {
    if (resumeFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfDataUrl(e.target?.result as string);
      };
      reader.readAsDataURL(resumeFile);
    }
  }, [resumeFile]);

  // Ensure fresh data on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated && mounted) {
      console.log("Refreshing resume data");
      refreshResume().finally(() => {
        setIsLoading(false);
      });
    } else if (!isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, mounted]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Accept both PDF and DOCX files
      if (file.type === 'application/pdf' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setResumeFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Word (DOCX) file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!resumeFile) return;
    
    const success = await uploadResume(resumeFile);
    
    if (success) {
      await analyzeResume(resumeFile);
    }
  };

  const handleDelete = async () => {
    if (resume) {
      await deleteResume();
    }
    setResumeFile(null);
    setPdfDataUrl(null);
  };

  const handleDownload = () => {
    if (resume?.file_url) {
      window.open(resume.file_url, '_blank');
    }
  };
  
  const handleStartCareerChat = () => {
    setShowCareerChat(true);
  };

  if (!isAuthenticated) {
    return <ResumeLoginWall />;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto">
          <div className="flex flex-col space-y-8">
            <h1 className="text-2xl font-bold">Resume Management</h1>
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-[500px] w-full" />
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-8">
          <h1 className="text-2xl font-bold">Resume Management</h1>
          
          {resume?.career_alignment_score && resume?.target_role && (
            <div className="bg-accent/20 border border-accent rounded-md p-4">
              <p className="font-medium">
                Your resume is {resume.career_alignment_score}% aligned with your career path: {resume.target_role}
              </p>
            </div>
          )}
          
          <ErrorBoundary>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Resume Upload and View */}
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
                pdfDataUrl={pdfDataUrl}
              />
              
              {/* Right Column - Resume Analysis */}
              <ResumeAnalysisSection
                loading={loading}
                isAnalyzing={isAnalyzing}
                analysis={analysis}
                resume={resume}
                handleStartCareerChat={handleStartCareerChat}
                handleFileChange={handleFileChange}
              />
            </div>
          </ErrorBoundary>
          
          {/* Bullet Point Analysis Section - Only show when bullets exist */}
          <ErrorBoundary>
            {analysis?.bullets && analysis.bullets.length > 0 && (
              <div className="mt-8">
                <BulletPointsAnalysisCard 
                  bullets={analysis.bullets} 
                />
              </div>
            )}
          </ErrorBoundary>
          
          {/* Career Chat Section */}
          <ErrorBoundary>
            {showCareerChat && (
              <div className="mt-8">
                <ResumeChat resumeAnalysis={analysis} />
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
