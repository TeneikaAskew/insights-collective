import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileCheck, Upload, Trash2, FileText, Download, FileOutput } from 'lucide-react';
import { ResumeAnalysis } from '@/components/assistants/types';
import type { Resume } from '../../hooks/resume/useResume'; 
import OverallScoreCard from './OverallScoreCard';
import ATSScoreCard from './ATSScoreCard';
import { Progress } from '@/components/ui/progress';
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
  hasAnalysis?: boolean;
  resume: Resume | null;
  resumeFile: File | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: () => void;
  uploading: boolean;
  isAnalyzing: boolean;
  pdfPreviewUrl: string | null;
  fileError: string | null;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat,
  hasAnalysis = false,
  resume,
  resumeFile,
  handleFileChange,
  handleUpload,
  handleDelete,
  handleDownload,
  uploading,
  isAnalyzing,
  pdfPreviewUrl,
  fileError,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // PDF export function
  const handleExportPDF = async () => {
    if (!contentRef.current || !analysis) return;
    
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Generate filename with timestamp
      const fileName = `resume_analysis_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  if (!analysis && !resume && !resumeFile) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center space-y-4">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Upload Your Resume</h3>
          <p className="text-sm text-muted-foreground text-center">
            Supported formats: PDF, DOCX
          </p>
          <label
            htmlFor="resume-upload"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Select File
            <input
              type="file"
              id="resume-upload"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx"
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (isAnalyzing) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center space-y-4">
          <FileCheck className="h-10 w-10 text-muted-foreground animate-pulse" />
          <h3 className="font-semibold text-lg">Analyzing Your Resume</h3>
          <p className="text-sm text-muted-foreground text-center">
            Our AI is extracting key information and providing personalized feedback.
          </p>
          <Progress value={66} className="w-full max-w-md" />
        </CardContent>
      </Card>
    );
  }

  if (uploading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center space-y-4">
          <Upload className="h-10 w-10 text-muted-foreground animate-pulse" />
          <h3 className="font-semibold text-lg">Uploading Your Resume</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your resume is being securely uploaded and processed.
          </p>
          <Progress value={33} className="w-full max-w-md" />
        </CardContent>
      </Card>
    );
  }

  if (resumeFile && !resume) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileCheck className="h-5 w-5 text-primary mr-2" />
              <span className="font-medium">{resumeFile.name}</span>
            </div>
          </div>
          <Button onClick={handleUpload} className="w-full" disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Resume
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" ref={contentRef}>
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-4">
        <div className="flex flex-col">
          {resume && resume.file_name && (
            <div className="flex items-center text-sm">
              <FileText className="h-4 w-4 mr-2" />
              <span className="font-medium">{resume.file_name}</span>
            </div>
          )}
          {resume && resume.uploaded_at && (
            <span className="text-xs text-muted-foreground">
              Uploaded on {new Date(resume.uploaded_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          {analysis && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportPDF}
              className="flex items-center gap-1"
            >
              <FileOutput className="h-4 w-4" /> Export Report
            </Button>
          )}
          {resume && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownload}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Download Resume
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            className="flex items-center gap-1 text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {hasAnalysis && analysis ? (
            <OverallScoreCard 
              score={analysis.score || 0} 
              themes={analysis.themes || []} 
              explanation={analysis.explanation || "No analysis available"}
            />
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground">Resume analysis will appear here.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-1 space-y-4">
          {!resume && resumeFile && (
            <Card className="overflow-hidden">
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileCheck className="h-5 w-5 text-primary mr-2" />
                    <span className="font-medium">{resumeFile.name}</span>
                  </div>
                </div>
                <Button onClick={handleUpload} className="w-full" disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resume
                </Button>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <ATSScoreCard 
              score={analysis.atsScore || 0} 
              feedback={analysis.atsFeedback || ""}
            />
          )}

          {analysis && analysis.careerAlignmentScore !== undefined && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Career Alignment</h3>
                <div className="space-y-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Score</span>
                    <span className="font-medium">{analysis.careerAlignmentScore}%</span>
                  </div>
                  <Progress value={analysis.careerAlignmentScore} />
                  <p className="text-sm text-muted-foreground mt-2">
                    {analysis.careerAlignmentScore >= 80 
                      ? "Excellent match for your target role" 
                      : analysis.careerAlignmentScore >= 60 
                      ? "Good match with some areas to improve" 
                      : "Needs improvement to match your target role"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {hasAnalysis && (
            <Button 
              onClick={onStartCareerChat} 
              className="w-full"
            >
              Start Career Chat
            </Button>
          )}
        </div>
      </div>

      {fileError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ResumeAnalysisDisplay;
