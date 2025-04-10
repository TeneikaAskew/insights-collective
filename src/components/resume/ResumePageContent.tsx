
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import ResumeUploadSection from '@/components/resume/ResumeUploadSection';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
import ResumeChat from '@/components/resume/ResumeChat';
import { ResumeAnalysis } from '@/components/assistants/types';

interface ResumeHookData {
  resume: any;
  loading: boolean;
  uploading: boolean;
  uploadResume: (file: File) => Promise<boolean>;
  deleteResume: () => Promise<boolean>;
  refreshResume: () => Promise<void>;
}

interface AnalysisHookData {
  analysis: ResumeAnalysis | null;
  isAnalyzing: boolean;
  analyzeResume: (file: File) => Promise<boolean>;
  setAnalysis: React.Dispatch<React.SetStateAction<ResumeAnalysis | null>>;
}

interface ResumePageContentProps {
  resumeHookData: ResumeHookData;
  analysisHookData: AnalysisHookData;
}

const ResumePageContent: React.FC<ResumePageContentProps> = ({
  resumeHookData,
  analysisHookData
}) => {
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [showCareerChat, setShowCareerChat] = useState(false);

  const { resume, loading, uploading, uploadResume, deleteResume } = resumeHookData;
  const { analysis, isAnalyzing, analyzeResume } = analysisHookData;
  
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

  return (
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
  );
};

export default ResumePageContent;
