
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUp, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const ResumeReminderBox = () => {
  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
              Get Better Project Recommendations
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Upload your resume to receive the most aligned portfolio projects based on your skills and experience.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-4 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900">
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
