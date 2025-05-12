import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileUpload, FilePdfIcon, Trash2, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ResumeGrade } from '@/components/resume/ResumeGrade';
import { ResumeFeedback } from '@/components/resume/ResumeFeedback';
import { ResumeBullets } from '@/components/resume/ResumeBullets';
import { ResumeElevatorPitch } from '@/components/resume/ResumeElevatorPitch';
import { ResumeKeywords } from '@/components/resume/ResumeKeywords';
import { ResumeCareerBenefits } from '@/components/resume/ResumeCareerBenefits';
import { ResumePdfViewer } from '@/components/resume/ResumePdfViewer';
import { ResumeChat } from '@/components/resume/ResumeChat';
import { ResumeRecommendations } from '@/components/resume/ResumeRecommendations';
import { Badge } from '@/components/ui/badge';
import { ResumeJobMatch } from '@/components/resume/ResumeJobMatch';
import { ResumeAnalysis } from '@/components/assistants/types';
import { Resume } from '@/types/supabase';

// Props interface
interface ResumeAnalysisSectionProps {
  loading: boolean;
  isAnalyzing: boolean;
  analysis: ResumeAnalysis | null;
  resume: Resume | null;
  handleStartCareerChat: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasAnalysis: boolean;
  resumeFile: File | null;
  pdfPreviewUrl: string | null;
  uploading: boolean;
  handleUpload: () => void;
  handleDelete: () => void;
  handleDownload: () => void;
  fileError: string | null;
  showCareerChat: boolean;
}

const ResumeAnalysisSection: React.FC<ResumeAnalysisSectionProps> = ({
  loading, isAnalyzing, analysis, resume, handleStartCareerChat, handleFileChange, hasAnalysis, resumeFile, pdfPreviewUrl, uploading, handleUpload, handleDelete, handleDownload, fileError, showCareerChat
}) => {
  const [activeTab, setActiveTab] = useState<string>("resume");

  return (
    <div className="h-full flex flex-col">
      <Tabs 
        defaultValue="resume" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col h-full" // Make tabs expand to fill container
      >
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="analysis" disabled={!hasAnalysis || loading || isAnalyzing}>Analysis</TabsTrigger>
          <TabsTrigger value="chat" disabled={!hasAnalysis || loading || isAnalyzing}>Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="flex-1 flex flex-col">
          {/* Resume tab content */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="col-span-1">
              <CardContent className="flex flex-col space-y-4">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-semibold">Upload Resume</h2>
                  {resume?.file_url && <Button variant="secondary" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>}
                </div>
                <input type="file" id="resume-upload" className="hidden" onChange={handleFileChange} />
                <Button asChild variant="outline" disabled={loading || isAnalyzing}>
                  <label htmlFor="resume-upload" className="cursor-pointer">
                    <FileUpload className="h-4 w-4 mr-2" />
                    {resumeFile ? resumeFile.name : 'Select a file'}
                  </label>
                </Button>
                {fileError && <Badge variant="destructive">{fileError}</Badge>}
                <div className="flex space-x-2">
                  <Button variant="primary" disabled={uploading || loading || isAnalyzing || !resumeFile} onClick={handleUpload}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                  {resume && <Button variant="destructive" disabled={loading || isAnalyzing} onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardContent className="flex flex-col space-y-4">
                <h2 className="text-lg font-semibold">Resume Preview</h2>
                {pdfPreviewUrl ? <ResumePdfViewer pdfUrl={pdfPreviewUrl} /> : <div className="flex items-center justify-center h-48 bg-gray-100 text-gray-500 rounded-md">
                    {resume?.file_url ? <FilePdfIcon className="h-12 w-12" /> : 'No Preview Available'}
                  </div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 h-full">
          {/* Analysis tab content */}
          {analysis && !loading && !isAnalyzing ? <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Resume Grade</h2>
                  <ResumeGrade resumePercent={analysis.resume_percent} letterGrade={analysis.letter_grade} />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Key Feedback</h2>
                  <ResumeFeedback themes={analysis.themes} />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Elevator Pitch</h2>
                  <ResumeElevatorPitch elevatorPitch={analysis.elevator_pitch} />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Key Skills & Keywords</h2>
                  <ResumeKeywords keywords={analysis.keywords} />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Career Benefits</h2>
                  <ResumeCareerBenefits benefits={analysis.benefits} />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Job Match</h2>
                  <ResumeJobMatch />
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Improved Bullets</h2>
                  <ResumeBullets bullets={analysis.bullets} />
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardContent className="flex flex-col space-y-4">
                  <h2 className="text-lg font-semibold">Recommendations</h2>
                  <ResumeRecommendations />
                </CardContent>
              </Card>
            </div> : <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  {loading || isAnalyzing ? <p className="text-muted-foreground">Analyzing your resume...</p> : <p className="text-muted-foreground">
                      Upload and analyze your resume to see detailed feedback.
                    </p>}
                </div>
              </CardContent>
            </Card>}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col h-full">
          {/* Chat tab content */}
          {hasAnalysis && analysis ? (
            <div className="h-full flex flex-col">
              <ResumeChat resumeAnalysis={analysis} />
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Upload and analyze your resume to use the AI chat assistant.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResumeAnalysisSection;
