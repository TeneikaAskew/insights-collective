
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, Target } from 'lucide-react';

const Resume = () => {
  // Initialize page onboarding
  usePageOnboarding({ 
    tourId: 'resume', 
    autoStart: true,
    dependencies: ['dashboard'] // Start after dashboard tour
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Resume Analyzer"
          description="Get AI-powered feedback to optimize your resume for data roles and beat ATS systems."
          pageTourId="resume"
        />
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card data-tour="resume-upload">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Your Resume
                </CardTitle>
                <CardDescription>
                  Upload your resume in PDF or Word format for instant analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Drop your resume here</p>
                  <p className="text-gray-500 mb-4">or click to browse files</p>
                  <Button>Choose File</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6" data-tour="analysis-results">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Analysis Results
                </CardTitle>
                <CardDescription>
                  Your detailed resume analysis will appear here
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  Upload a resume to see detailed analysis and recommendations
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  What We Analyze
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">ATS Compatibility</h3>
                    <p className="text-sm text-gray-500">Ensure your resume passes applicant tracking systems</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Keyword Optimization</h3>
                    <p className="text-sm text-gray-500">Match important keywords for data roles</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Content Structure</h3>
                    <p className="text-sm text-gray-500">Optimize layout and content organization</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Skills Assessment</h3>
                    <p className="text-sm text-gray-500">Evaluate technical and soft skills presentation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
