
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const SurveyConfirmation: React.FC = () => {
  return (
    <AppLayout>
      <div className="container max-w-4xl py-12 px-4 md:px-6 flex flex-col items-center">
        <div className="flex flex-col items-center text-center mb-8 space-y-4">
          <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">Application Submitted Successfully!</h1>
          <p className="text-xl text-muted-foreground max-w-xl">
            Thank you for applying to the AI & Automation Skills Fellowship. We have received your application and will be in touch soon.
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border max-w-xl w-full">
          <h2 className="text-xl font-semibold mb-4">What Happens Next?</h2>
          <ul className="space-y-2 list-disc pl-5 mb-6">
            <li>Our team will review your application carefully.</li>
            <li>You will receive an email confirmation shortly.</li>
            <li>Selected applicants will be invited for an interview within 2-3 weeks.</li>
            <li>Final decisions will be communicated by email.</li>
          </ul>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-100 dark:border-blue-800 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Important:</strong> Please add <span className="font-mono">fellowships@example.com</span> to your contacts to ensure our emails don't go to your spam folder.
            </p>
          </div>
        </div>
        
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Button asChild variant="default">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default SurveyConfirmation;
