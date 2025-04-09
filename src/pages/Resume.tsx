
import React, { useState } from 'react';
import { FileUp, File, DownloadCloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // This would come from user's quiz results in a real implementation
  const careerAlignmentScore = 72;
  const targetRole = "Data Analyst";

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
    
    setUploading(true);
    
    // Simulating upload
    setTimeout(() => {
      setUploading(false);
      toast({
        title: "Upload successful",
        description: "Your resume has been uploaded and analyzed.",
      });
    }, 2000);
  };

  const handleDelete = () => {
    setResumeFile(null);
    toast({
      title: "Resume deleted",
      description: "Your resume has been removed.",
    });
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
          
          {careerAlignmentScore && targetRole && (
            <div className="bg-accent/20 border border-accent rounded-md p-4">
              <p className="font-medium">
                Your resume is {careerAlignmentScore}% aligned with your career path: {targetRole}
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
                {!resumeFile ? (
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
                        <p className="font-medium">{resumeFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="outline" size="icon" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        Resume preview will appear here after upload
                      </p>
                      <div className="bg-accent/10 aspect-[8.5/11] flex items-center justify-center rounded-md">
                        <p className="text-muted-foreground">PDF Preview</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleUpload} 
                  disabled={!resumeFile || uploading} 
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Right Column - Career GPT Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Resume Analysis</CardTitle>
                <CardDescription>
                  Get personalized insights and recommendations based on your resume and career goals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Strengths</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Strong technical skill presentation</li>
                      <li>Relevant project experience</li>
                      <li>Clear educational background</li>
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Areas for Improvement</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Add more quantifiable achievements</li>
                      <li>Highlight data analysis tools more prominently</li>
                      <li>Consider adding a skills section</li>
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Career Alignment</h3>
                    <p className="text-sm">
                      Your resume is well-aligned with the Data Analyst role, but could be improved 
                      by highlighting SQL skills and data visualization experience more prominently.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-start space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload or update your resume to receive personalized career advice from our AI assistant.
                </p>
                <Button variant="outline" className="w-full" disabled>
                  Start Career Chat
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
