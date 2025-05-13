
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileUp, Download, Trash2, FileIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResumeAnalysis } from '@/components/assistants/types';
import { Resume } from '@/hooks/resume/useResume';
import ResumeChat from '@/components/resume/ResumeChat';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  // Simple PDF viewer component
  const ResumePdfViewer = ({ pdfUrl }: { pdfUrl: string }) => (
    <iframe
      src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
      title="Resume Preview"
      className="w-full aspect-[8.5/11] border rounded-md"
      style={{ height: '250px', maxHeight: '60vh' }}
    />
  );

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
              <CardContent className="flex flex-col space-y-4 pt-6">
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
                    <FileUp className="h-4 w-4 mr-2" />
                    {resumeFile ? resumeFile.name : 'Select a file'}
                  </label>
                </Button>
                {fileError && <Badge variant="destructive">{fileError}</Badge>}
                <div className="flex space-x-2">
                  <Button variant="default" disabled={uploading || loading || isAnalyzing || !resumeFile} onClick={handleUpload}>
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
              <CardContent className="flex flex-col space-y-4 pt-6">
                <h2 className="text-lg font-semibold">Resume Preview</h2>
                {pdfPreviewUrl ? <ResumePdfViewer pdfUrl={pdfPreviewUrl} /> : <div className="flex items-center justify-center h-48 bg-gray-100 text-gray-500 rounded-md">
                    {resume?.file_url ? <FileIcon className="h-12 w-12" /> : 'No Preview Available'}
                  </div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 h-full">
          {/* Analysis tab content */}
          {analysis && !loading && !isAnalyzing ? 
            <ScrollArea className="h-full pr-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
                <Card className="col-span-1">
                  <CardContent className="flex flex-col space-y-4 pt-6">
                    <h2 className="text-lg font-semibold">Resume Grade</h2>
                    <div className="flex items-center space-x-2">
                      <div className="text-4xl font-bold">{analysis.letter_grade}</div>
                      <div className="text-2xl font-medium">{analysis.resume_percent}%</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-1">
                  <CardContent className="flex flex-col space-y-4 pt-6">
                    <h2 className="text-lg font-semibold">Key Feedback</h2>
                    <div className="space-y-2">
                      {analysis.themes && analysis.themes.map((theme, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded-md text-sm">{theme}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-1">
                  <CardContent className="flex flex-col space-y-4 pt-6">
                    <h2 className="text-lg font-semibold">Elevator Pitch</h2>
                    <p className="text-sm">{analysis.elevator_pitch}</p>
                  </CardContent>
                </Card>

                {/* Replace with something else since keywords doesn't exist */}
                <Card className="col-span-1">
                  <CardContent className="flex flex-col space-y-4 pt-6">
                    <h2 className="text-lg font-semibold">Explanation</h2>
                    <p className="text-sm">{analysis.explanation}</p>
                  </CardContent>
                </Card>

                {/* Replace with something else since benefits doesn't exist */}
                <Card className="col-span-2">
                  <CardContent className="flex flex-col space-y-4 pt-6">
                    <h2 className="text-lg font-semibold">Bullet Points Analysis</h2>
                    {analysis.bullets && (
                      <div className="space-y-4">
                        {analysis.bullets.slice(0, 3).map((bullet, index) => (
                          <div key={index} className="border p-3 rounded-md">
                            <p className="font-medium mb-1">Original</p>
                            <p className="text-sm text-gray-600 mb-2">{bullet.original}</p>
                            <p className="font-medium mb-1">Improved</p>
                            <p className="text-sm text-gray-800">{bullet.improved_bullet}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea> 
            : 
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  {loading || isAnalyzing ? <p className="text-muted-foreground">Analyzing your resume...</p> : <p className="text-muted-foreground">
                      Upload and analyze your resume to see detailed feedback.
                    </p>}
                </div>
              </CardContent>
            </Card>
          }
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
