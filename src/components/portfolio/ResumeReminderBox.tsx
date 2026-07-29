
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUp, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const ResumeReminderBox = () => {
  return (
    <Alert className="mb-6 border-ss-teal bg-ss-teal-chip">
      <Info className="h-4 w-4 text-ss-teal" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground font-medium mb-1">
              Get Better Project Recommendations
            </p>
            <p className="text-muted-foreground text-sm">
              Upload your resume to receive the most aligned portfolio projects based on your skills and experience.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-4 border-ss-teal text-ss-teal hover:bg-background">
            <Link to="/resume" className="flex items-center space-x-2">
              <FileUp className="h-4 w-4" />
              <span>Upload Resume</span>
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ResumeReminderBox;
