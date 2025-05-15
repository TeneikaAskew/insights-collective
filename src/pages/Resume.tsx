import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud } from 'lucide-react';
import { useResumeAnalysis } from '@/hooks/resume/useResumeAnalysis';

const Resume = () => {
  const { user } = useAuth();
  const resumeStorageRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [improvedBullets, setImprovedBullets] = useState([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const {
    analysis,
    isAnalyzing,
    analyzeResume,
    careerAlignments,
    setAnalysis,
    isPollingForImprovements,
    setIsPollingForImprovements
  } = useResumeAnalysis();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        setResumeText(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeText(event.target.value);
  };

  const handleUpload = async () => {
    if (!resumeText && !selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file or enter resume text.",
        variant: "destructive",
      });
      return;
    }

    await analyzeResume(resumeText);
  };

  // Handle check for enhancements button click
  const handleCheckEnhancements = async () => {
    // Do not allow starting if already polling
    if (isPollingForImprovements || !analysis?.id || pollingIntervalRef.current) {
      toast({
        title: "Already checking",
        description: "We're already checking for improvements to your resume bullets",
      });
      return;
    }

    setIsPollingForImprovements(true);
    setImprovedBullets([]);
    
    toast({
      title: "Checking for improvements",
      description: "We're checking to see if we can improve your resume bullets. This may take a moment.",
    });
    
    try {
      // Start polling for improvements
      pollingIntervalRef.current = setInterval(async () => {
        try {
          console.log("Polling for improvements...");
          // API call to check for improvements would go here
          // const response = await checkForImprovements(analysis.id);
          
          // Mock response for now
          const mockResponse = {
            hasImprovements: Math.random() > 0.7,
            improvements: [
              { original: "Led team of 5", improved: "Led cross-functional team of 5 engineers to deliver project 20% ahead of schedule" },
              { original: "Increased sales", improved: "Increased quarterly sales by 35% through implementation of targeted marketing campaigns" }
            ]
          };
          
          if (mockResponse.hasImprovements) {
            setImprovedBullets(mockResponse.improvements);
            toast({
              title: "Improvements found!",
              description: "We've found some ways to improve your resume bullets.",
              variant: "default",
            });
            
            // Clear interval once improvements are found
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
              setIsPollingForImprovements(false);
            }
          }
        } catch (error) {
          console.error("Error polling for improvements:", error);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setIsPollingForImprovements(false);
          }
          toast({
            title: "Error checking for improvements",
            description: "An error occurred while checking for improvements.",
            variant: "destructive",
          });
        }
      }, 5000); // Poll every 5 seconds
      
    } catch (error) {
      console.error("Error starting improvement check:", error);
      setIsPollingForImprovements(false);
      toast({
        title: "Error",
        description: "An error occurred while starting the improvement check.",
        variant: "destructive",
      });
    }
  };
  
  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Resume Analysis</CardTitle>
            <CardDescription>
              Upload your resume or paste the text to analyze it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col space-y-2">
              <Textarea
                placeholder="Paste your resume text here..."
                value={resumeText}
                onChange={handleTextChange}
                className="resize-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <span>Selected file: {selectedFile.name}</span>
              )}
            </div>
            <Button onClick={handleUpload} disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Analyze Resume"}
            </Button>
          </CardContent>
        </Card>

        {analysis && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Analysis Results</h2>
            <Card>
              <CardHeader>
                <CardTitle>Key Skills</CardTitle>
                <CardDescription>Identified skills from your resume.</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.skills && analysis.skills.length > 0 ? (
                  <ul>
                    {analysis.skills.map((skill, index) => (
                      <li key={index}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No skills identified.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Experience Summary</CardTitle>
                <CardDescription>Summary of your work experience.</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.experienceSummary ? (
                  <p>{analysis.experienceSummary}</p>
                ) : (
                  <p>No experience summary available.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Career Alignments</CardTitle>
                <CardDescription>Potential career paths based on your resume.</CardDescription>
              </CardHeader>
              <CardContent>
                {careerAlignments && careerAlignments.length > 0 ? (
                  <ul>
                    {careerAlignments.map((career, index) => (
                      <li key={index}>{career.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No career alignments found.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Actionable Improvements</CardTitle>
                <CardDescription>Suggestions to improve your resume.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCheckEnhancements} disabled={isPollingForImprovements}>
                  {isPollingForImprovements ? "Checking..." : "Check for Enhancements"}
                </Button>
                {improvedBullets.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold">Improved Bullets</h3>
                    <ul>
                      {improvedBullets.map((bullet, index) => (
                        <li key={index} className="mb-2">
                          <p>Original: {bullet.original}</p>
                          <p>Improved: {bullet.improved}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Resume;
