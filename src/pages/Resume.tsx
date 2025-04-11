
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
import { Alert, AlertDescription } from '@/components/ui/alert';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { resume, loading, uploading, uploadResume, deleteResume } = useResume();
  const { analysis, isAnalyzing, analyzeResume, careerAlignments } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  // 1) Preview PDF and extract text
  useEffect(() => {
    if (!resumeFile) return;

    // PDF preview
    const reader = new FileReader();
    reader.onload = (e) => setPdfDataUrl(e.target?.result as string);
    reader.readAsDataURL(resumeFile);

    // Text extraction
    (async () => {
      try {
        const text = await extractTextFromFile(resumeFile);
        setExtractedText(text);
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

  // 2) If we already have a stored resume and no analysis in-memory, re-run analysis
  useEffect(() => {
    if (resumeFile === null && resume?.text && !analysis) {
      // if your `resume` object contains the text you originally uploaded (e.g. resume.text),
      // re-analyze it on mount so the bullets card never disappears.
      analyzeResume(resume.text);
    }
  }, [resume, resumeFile, analysis, analyzeResume]);

  // 3) Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      setResumeFile(file);
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
    const ok = await uploadResume(resumeFile);
    if (ok) {
      await analyzeResume(extractedText);
    }
  };

  const handleDelete = async () => {
    if (resume) await deleteResume();
    setResumeFile(null);
    setPdfDataUrl(null);
    setExtractedText(null);
  };

  const handleDownload = () => {
    if (resume?.file_url) window.open(resume.file_url, '_blank');
  };

  const handleStartCareerChat = () => setShowCareerChat(true);

  if (!isAuthenticated) return <ResumeLoginWall />;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold">Resume Management</h1>

        {/* Career Alignment Alerts */}
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

        {/* Only show chat when showCareerChat is true */}
        {showCareerChat && analysis && <ResumeChat resumeAnalysis={analysis} />}

        {/* Bullet-analysis panel now comes after the chat */}
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
