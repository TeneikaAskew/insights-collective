import React, { useState } from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import type { Resume } from '../../hooks/resume/useResume';
import OverallScoreCard from './OverallScoreCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Sparkles, FileUp, File, DownloadCloud, Trash2, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
  userId?: string;
  hasAnalysis?: boolean;

  // Props for resume upload functionality
  resume: Resume | null;
  resumeFile: File | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: () => void;
  handleReanalyze?: () => Promise<void>;
  uploading: boolean;
  isAnalyzing: boolean;
  isPollingForImprovements?: boolean; // Prop for polling state
  isExtracting?: boolean; // Prop for text extraction state
  pdfPreviewUrl: string | null;
  fileError: string | null;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat,
  userId,
  hasAnalysis,
  resume,
  resumeFile,
  handleFileChange,
  handleUpload,
  handleDelete,
  handleDownload,
  handleReanalyze,
  uploading,
  isAnalyzing,
  isPollingForImprovements = false,
  isExtracting = false,
  pdfPreviewUrl,
  fileError,
}) => {
  // Destructure values from analysis with fallbacks
  const {
    resume_percent = 0,
    letter_grade = 'C',
    themes = [],
    elevator_pitch = '',
    explanation = '',
    bullets = [],
  } = analysis || {};

  // Ensure bullets is always an array
  const bulletPoints = Array.isArray(bullets) ? bullets : [];

  const needsImprovementAlert = analysis && (resume_percent < 60 || letter_grade === 'D' || letter_grade === 'F');
  const excellentResumeAlert = analysis && resume_percent >= 85;

  const topBullets = bulletPoints.slice(0, 5);
  const highestScoringBullet = topBullets.length > 0 ? [...topBullets].sort((a, b) => (b?.bullet_total || 0) - (a?.bullet_total || 0))[0] : null;
  const lowestScoringBullet = topBullets.length > 0 ? [...topBullets].sort((a, b) => (a?.bullet_total || 0) - (b?.bullet_total || 0))[0] : null;

  const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);

  const renderFilePreviewLocal = () => {
    if (resume?.file_url && resume?.file_name?.toLowerCase().endsWith('.pdf') && !resumeFile) {
      // Always make sure the URL includes response-content-disposition=inline to prevent download
      const pdfUrl = resume.file_url.includes('response-content-disposition=inline') 
        ? resume.file_url 
        : resume.file_url + (resume.file_url.includes('?') ? '&' : '?') + 'response-content-disposition=inline';
      
      return (
        <iframe
          src={pdfUrl + "#toolbar=0&navpanes=0&view=FitH"}
          title="Resume Preview"
          className="w-full aspect-[8.5/11] border rounded-md"
          style={{ height: '250px', maxHeight: '60vh' }}
        />
      );
    }
    if (pdfPreviewUrl && resumeFile?.type === 'application/pdf') {
      // For local file preview, make sure we use the blob URL with proper parameters
      const enhancedPdfUrl = pdfPreviewUrl + "#toolbar=0&navpanes=0&view=FitH";
      return (
        <iframe
          src={enhancedPdfUrl}
          title="Local Resume Preview"
          className="w-full aspect-[8.5/11] border rounded-md"
          style={{ height: '250px', maxHeight: '60vh' }}
        />
      );
    }
    const docxFile = resumeFile || (resume?.file_name?.toLowerCase().endsWith('.docx') ? resume : null);
    if (docxFile) {
      const fileName = resumeFile ? resumeFile.name : resume?.file_name;
      return (
        <div className="w-full aspect-[8.5/6] border rounded-md flex flex-col items-center justify-center bg-accent/10" style={{ height: '250px', maxHeight: '60vh' }}>
          <File className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Word Document Preview</p>
          {fileName && <p className="text-sm text-muted-foreground mt-1">{fileName}</p>}
          <p className="text-xs text-muted-foreground mt-1">(Live preview not available for DOCX files)</p>
        </div>
      );
    }
    return (
      <div className="bg-accent/10 aspect-[8.5/6] flex items-center justify-center rounded-md" style={{ height: '250px', maxHeight: '60vh' }}>
        <p className="text-muted-foreground">No preview available</p>
      </div>
    );
  };

  // Render the upload card - always visible
  const renderUploadCard = () => {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Resume</CardTitle>
          <CardDescription>
            {resume && !resumeFile ? "Manage your uploaded resume or upload a new version." : "Upload your resume in PDF or DOCX format to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fileError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Error</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}

          {(!resume && !resumeFile) ? (
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-8 text-center">
              <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Drag and drop your resume here, or click to browse</p>
              <input
                type="file"
                accept=".pdf,.docx"
                id="resume-upload-display"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading || isAnalyzing}
              />
              <Button asChild variant="outline">
                <label htmlFor="resume-upload-display">Browse Files</label>
              </Button>
            </div>
          ) : (
            <div className="border rounded-md p-4">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <File className="h-6 w-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate">
                    {resumeFile ? resumeFile.name : (resume?.file_name || resume?.file_path?.split('/').pop())}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {resumeFile
                      ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
                      : resume?.uploaded_at ? `Uploaded on ${new Date(resume.uploaded_at).toLocaleDateString()}` : 'Previously uploaded'}
                  </p>
                </div>
                <div className="flex gap-1 sm:gap-2 ml-auto">
                  {resume?.file_url && !resumeFile && (
                    <Button variant="outline" size="icon" onClick={handleDownload} title="Download Resume" className="h-8 w-8">
                      <DownloadCloud className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  )}
                  <Button variant="destructive" size="icon" onClick={handleDelete} title={resumeFile ? "Clear selection" : "Delete uploaded resume"} className="h-8 w-8">
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    id="resume-replace-display"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading || isAnalyzing}
                  />
                  {(resume || resumeFile) && (
                    <Button variant="outline" size="icon" asChild title="Replace Resume" className="h-8 w-8">
                      <label htmlFor="resume-replace-display">
                        <FileUp className="h-3 w-3 sm:h-4 sm:w-4" />
                      </label>
                    </Button>
                  )}
                  {handleReanalyze && resume && !resumeFile && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleReanalyze} 
                      disabled={isAnalyzing || isPollingForImprovements} 
                      title="Re-analyze Resume" 
                      className="h-8 w-8"
                    >
                      <RotateCcw className={`h-3 w-3 sm:h-4 sm:w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        {resumeFile && (
          <CardFooter>
            <Button
              onClick={handleUpload}
              disabled={!resumeFile || uploading || isAnalyzing || isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extracting text...</>
              ) : uploading ? 'Uploading...' : isAnalyzing ? 'Analyzing...' : 'Upload & Analyze Resume'}
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  };

  return (
    <div>
      <div className="space-y-6">
        {needsImprovementAlert && (
          <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical Improvements Needed</AlertTitle>
            <AlertDescription className="text-red-700">
              Your resume may be getting filtered out by ATS systems. Follow the action plan to significantly improve your chances.
            </AlertDescription>
          </Alert>
        )}
        
        {excellentResumeAlert && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <Sparkles className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Excellent Resume</AlertTitle>
            <AlertDescription className="text-green-700">
              Your resume ranks in the top tier. The recommendations will help you perfect it even further.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Always show upload section and preview */}
          <div className="md:col-span-1">
            {/* Upload Section - Always visible */}
            {renderUploadCard()}
            
            {/* Preview Section - Show if resume exists */}
            {(resume || resumeFile) && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderFilePreviewLocal()}
                </CardContent>
              </Card>
            )}

            {/* Key Insights Section - Show if analysis exists */}
            {analysis && (
              <Card className="mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#9b87f5]" />
                    <span>Key Insights</span>
                  </CardTitle>
                  {isPollingForImprovements && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating improved bullet points...</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {highestScoringBullet && (
                      <div className="border-l-4 border-green-400 pl-3 py-1">
                        <p className="text-xs text-muted-foreground mb-1">STRONGEST POINT</p>
                        <p className="text-sm">{highestScoringBullet.original}</p>
                      </div>
                    )}
                    {lowestScoringBullet && (
                      <div className="border-l-4 border-amber-400 pl-3 py-1">
                        <p className="text-xs text-muted-foreground mb-1">NEEDS IMPROVEMENT</p>
                        <p className="text-sm">{lowestScoringBullet.original}</p>
                      </div>
                    )}
                    <div className="border-l-4 border-blue-400 pl-3 py-1">
                      <p className="text-xs text-muted-foreground mb-1">INDUSTRY ALIGNMENT</p>
                      <p className="text-sm">{(resume_percent > 75) ? 'Strong' : (resume_percent > 60) ? 'Fair' : 'Weak'} industry alignment</p>
                    </div>
                    <div className="border-l-4 border-purple-400 pl-3 py-1">
                      <p className="text-xs text-muted-foreground mb-1">STORYTELLING QUALITY</p>
                      <p className="text-sm">{bulletPoints && bulletPoints.length > 0 ? bulletPoints.length : 0} bullet points analyzed</p>
                      <p className="text-xs text-muted-foreground">Average quality score: {bulletPoints && bulletPoints.length > 0 ?
                        Math.round(bulletPoints.reduce((sum, bullet) => sum + (bullet?.bullet_total || 0), 0) / bulletPoints.length)
                        : 0}/100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Analysis */}
          <div className="md:col-span-2">
            {analysis ? (
              <OverallScoreCard
                letterGrade={letter_grade}
                resumePercent={resume_percent}
                elevatorPitch={elevator_pitch}
                themes={themes || []}
                explanation={explanation}
                onStartCareerChat={onStartCareerChat}
                hasAnalysis={hasAnalysis}
              />
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[200px]">
                <CardContent className="text-center p-6">
                  <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {resumeFile ? "Upload your selected resume to see the analysis." : "No analysis available yet. Upload a resume to get started."}
                  </p>
                  {!resumeFile && !resume && (<Button variant="link" className="mt-2" onClick={() => document.getElementById('resume-upload-display')?.click()}>Upload Resume</Button>)}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalysisDisplay;
