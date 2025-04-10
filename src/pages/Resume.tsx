
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

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { resume, loading, uploading, uploadResume, deleteResume } = useResume();
  const { analysis, isAnalyzing, analyzeResume } = useResumeAnalysis();
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
  
  // Debug logs to track state changes
  useEffect(() => {
    console.log("Resume object updated:", resume);
    console.log("Analysis object updated:", analysis);
  }, [resume, analysis]);
  
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
    
    try {
      // First extract the text to use for analysis
      const resumeText = await extractTextFromFile(resumeFile);
      
      // Then upload the resume file
      const success = await uploadResume(resumeFile);
      
      if (success && resumeText) {
        // Use the extracted text for analysis, not the file
        await analyzeResume(resumeText);
      }
    } catch (error) {
      console.error("Error during upload/analysis process:", error);
      toast({
        title: "Process Failed",
        description: "There was an error processing your resume.",
        variant: "destructive"
      });
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

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-6">
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
            <ResumeChat resumeAnalysis={analysis} />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
