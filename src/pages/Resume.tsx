import React, { useState, useEffect } from 'react';
import { FileUp, File, DownloadCloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import { useResume } from '@/hooks/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import ResumeAnalysisDisplay from '@/components/resume/ResumeAnalysisDisplay';
import ResumeChat from '@/components/resume/ResumeChat';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { resume, loading, uploading, uploadResume, deleteResume } = useResume();
  const { analysis, isAnalyzing, analyzeResume } = useResumeAnalysis();
  const [showCareerChat, setShowCareerChat] = useState(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setResumeFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!resumeFile) return;
    
    // First upload the resume
    const success = await uploadResume(resumeFile);
    
    if (success) {
      // Then analyze it
      await analyzeResume(resumeFile);
      setResumeFile(null);
    }
  };

  const handleDelete = async () => {
    if (resume) {
      await deleteResume();
    }
    setResumeFile(null);
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
    return <LoginWall 
      message="Sign in to upload your resume and get personalized career insights and recommendations."
      visibleItems={0} 
      totalItems={1}
    />;
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
            <Card>
              <CardHeader>
                <CardTitle>Upload Your Resume</CardTitle>
                <CardDescription>
                  Upload your resume in PDF format to receive personalized feedback and insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading your resume...</p>
                  </div>
                ) : !resume && !resumeFile ? (
                  <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
                    <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Drag and drop your resume here, or click to browse</p>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      id="resume-upload" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                    <Button asChild>
                      <label htmlFor="resume-upload">Browse Files</label>
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-md p-4">
                    <div className="flex items-center space-x-3">
                      <File className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {resumeFile ? resumeFile.name : resume?.file_path.split('/').pop()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {resumeFile 
                            ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
                            : `Uploaded on ${new Date(resume?.uploaded_at || '').toLocaleDateString()}`
                          }
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {resume && (
                          <Button variant="outline" size="icon" onClick={handleDownload}>
                            <DownloadCloud className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={handleDelete}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {resume?.file_url && !resumeFile && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">
                          Resume preview
                        </p>
                        <iframe 
                          src={`${resume.file_url}#toolbar=0&navpanes=0`}
                          className="w-full aspect-[8.5/11] border rounded-md"
                          title="Resume preview"
                        />
                      </div>
                    )}
                    
                    {resumeFile && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">
                          Resume preview will appear after upload
                        </p>
                        <div className="bg-accent/10 aspect-[8.5/11] flex items-center justify-center rounded-md">
                          <p className="text-muted-foreground">PDF Preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {resumeFile && (
                  <Button 
                    onClick={handleUpload} 
                    disabled={!resumeFile || uploading || isAnalyzing} 
                    className="w-full"
                  >
                    {uploading || isAnalyzing ? 
                      (isAnalyzing ? 'Analyzing...' : 'Uploading...') : 
                      'Upload & Analyze Resume'}
                  </Button>
                )}
                
                {!resumeFile && resume && (
                  <div className="w-full flex justify-between">
                    <Button variant="outline" onClick={handleDelete}>
                      Delete Resume
                    </Button>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      id="resume-replace" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                    <Button asChild>
                      <label htmlFor="resume-replace">Replace Resume</label>
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
            
            {/* Right Column - Resume Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Resume Analysis</CardTitle>
                <CardDescription>
                  Get personalized insights and recommendations based on your resume and career goals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading || isAnalyzing ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-5/6 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-4/6 mb-6"></div>
                    
                    <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-5/6 mb-6"></div>
                    
                    <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                ) : analysis ? (
                  <ResumeAnalysisDisplay 
                    analysis={analysis} 
                    onStartCareerChat={handleStartCareerChat}
                  />
                ) : resume?.analysis ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Strengths</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {resume.analysis.strengths.map((strength: string, i: number) => (
                          <li key={i}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="font-medium mb-2">Areas for Improvement</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {resume.analysis.improvements.map((improvement: string, i: number) => (
                          <li key={i}>{improvement}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="font-medium mb-2">Career Alignment</h3>
                      <p className="text-sm">
                        {resume.analysis.careerAlignment}
                      </p>
                    </div>
                    
                    <CardFooter className="flex-col items-start space-y-2 p-0 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Your resume has been analyzed. You can chat with our AI assistant for more personalized advice.
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleStartCareerChat}
                      >
                        Start Career Chat
                      </Button>
                    </CardFooter>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <p className="text-muted-foreground mb-4">
                      Upload your resume to receive personalized career advice and analysis.
                    </p>
                    
                    <input 
                      type="file" 
                      accept=".pdf" 
                      id="resume-upload-alt" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                    <Button asChild>
                      <label htmlFor="resume-upload-alt">Upload Resume</label>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
