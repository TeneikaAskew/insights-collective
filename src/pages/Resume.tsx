
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import ResumeChat from '@/components/resume/ResumeChat';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { resume, loading, uploading, uploadResume, deleteResume } = useResume();
  const { analysis, isAnalyzing, analyzeResume, setAnalysisFromResume } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  
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
  
  // Check if we need to sync analysis from resume
  useEffect(() => {
    if (resume?.analysis && !analysis) {
      console.log("Syncing analysis from resume object");
      setAnalysisFromResume(resume);
    }
  }, [resume, analysis, setAnalysisFromResume]);
  
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

  // Create a unique key for components that rely on analysis data
  const analysisKey = analysis ? `analysis-${Date.now()}` : 'no-analysis';

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
              key={`analysis-section-${analysisKey}`}
              loading={loading}
              isAnalyzing={isAnalyzing}
              analysis={analysis}
              resume={resume}
              handleStartCareerChat={handleStartCareerChat}
              handleFileChange={handleFileChange}
            />
          </div>
          
          {/* Career Chat Section */}
          {showCareerChat && (
            <div className="mt-8" key={`career-chat-${analysisKey}`}>
              <ResumeChat resumeAnalysis={analysis} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
