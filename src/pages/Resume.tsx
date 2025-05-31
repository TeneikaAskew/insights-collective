
import React, { useState, useEffect } from 'react';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const [showCareerChat, setShowCareerChat] = useState(false);
  
  // Use page onboarding hook
  usePageOnboarding();

  useEffect(() => {
    if (!isAuthenticated) {
      navigateWithAuth('/login', { 
        requireAuth: true, 
        message: "Please log in to access Resume Analysis", 
        title: "Authentication Required" 
      });
    }
  }, [isAuthenticated, navigateWithAuth]);

  // Mock the useResume hook properties that don't exist yet
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      if (file.type === 'application/pdf') {
        const url = URL.createObjectURL(file);
        setPdfPreviewUrl(url);
      }
      setFileError(null);
    }
  };

  const handleUpload = async () => {
    if (!resumeFile) return;
    // This will be implemented with the actual useResume hook
    console.log('Upload functionality to be implemented');
  };

  const handleDelete = async () => {
    setResumeFile(null);
    setPdfPreviewUrl(null);
    setFileError(null);
  };

  const handleDownload = () => {
    // This will be implemented with the actual useResume hook
    console.log('Download functionality to be implemented');
  };

  const {
    analysis,
    isAnalyzing,
    isPollingForImprovements,
  } = useResumeAnalysis();

  // Mock data for now
  const resume = null;
  const loading = false;
  const uploading = false;
  const hasAnalysis = !!analysis;

  const refreshData = async () => {
    // This will be implemented
    console.log('Refresh functionality to be implemented');
  };

  const handleStartCareerChat = () => {
    setShowCareerChat(true);
  };

  if (!user) return null;

  return (
    <AppLayout>
      <OnboardingGuide tourId="resume" />
      <div className="space-y-6">
        <PageHeader
          title="Resume Analyzer"
          description="Get AI-powered analysis and optimization suggestions for your resume"
          tourId="resume"
        />

        <div data-tour="resume-main">
          <ResumeAnalysisSection
            loading={loading}
            isAnalyzing={isAnalyzing}
            analysis={analysis}
            resume={resume}
            handleStartCareerChat={handleStartCareerChat}
            handleFileChange={handleFileChange}
            hasAnalysis={hasAnalysis}
            resumeFile={resumeFile}
            pdfPreviewUrl={pdfPreviewUrl}
            uploading={uploading}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            handleDownload={handleDownload}
            fileError={fileError}
            showCareerChat={showCareerChat}
            isPollingForImprovements={isPollingForImprovements}
            handleRefreshData={refreshData}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
