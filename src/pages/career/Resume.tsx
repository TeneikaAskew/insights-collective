
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Edit, Eye } from 'lucide-react';

const Resume = () => {
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Resume Builder</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Create and manage professional resumes tailored for data careers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Create New Resume
              </CardTitle>
              <CardDescription>
                Build a professional resume from scratch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use our guided resume builder to create a compelling resume that highlights your data skills and experience.
              </p>
              <Button className="w-full">
                Start Building
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Existing Resume
              </CardTitle>
              <CardDescription>
                Import and enhance your current resume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your existing resume and get AI-powered suggestions for improvement.
              </p>
              <Button variant="outline" className="w-full">
                Upload Resume
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Resume Templates
              </CardTitle>
              <CardDescription>
                Choose from professional templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Browse our collection of ATS-friendly resume templates designed for data professionals.
              </p>
              <Button variant="outline" className="w-full">
                View Templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                My Resumes
              </CardTitle>
              <CardDescription>
                Access your saved resumes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View, edit, and download your previously created resumes.
              </p>
              <Button variant="outline" className="w-full">
                View My Resumes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
