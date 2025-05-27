
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ResumeAnalyzer = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resume Analyzer</h1>
          <p className="text-muted-foreground">
            Get AI-powered insights and recommendations for your resume.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Upload Your Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Resume analysis features are being developed.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ResumeAnalyzer;
