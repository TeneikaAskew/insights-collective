
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import InteractiveCareerReportSection from '@/components/assistants/InteractiveCareerReportSection';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerReportData } from '@/components/assistants/utils/types';

type CareerPathwaySectionProps = {
  pathwayAnswers: Record<number, number | string>;
};

const CareerPathwaySection: React.FC<CareerPathwaySectionProps> = ({ pathwayAnswers }) => {
  const navigate = useNavigate();
  const { data, isLoading } = useCareerPathwayResults();
  const [resumeFound, setResumeFound] = useState(false);

  useEffect(() => {
    // Check if resume exists in local storage
    const resumeItems = Object.keys(localStorage).filter(key => key.includes('resume-'));
    setResumeFound(resumeItems.length > 0);
  }, []);

  const handleTakeAssessment = () => {
    navigate('/career-agent');
  };

  if (isLoading) {
    return (
      <Card id="career-pathway-report" className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <CardTitle>Career Pathway Report</CardTitle>
          </div>
          <CardDescription>
            Loading your personalized career pathway assessment...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If there's no career report data
  if (!data?.report || 
      (data.report.recommendedRoles?.length === 0 && data.report.summary === "You haven't completed your career assessment yet.")) {
    return (
      <Card id="career-pathway-report" className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <CardTitle>Career Pathway Report</CardTitle>
          </div>
          <CardDescription>
            Take your career assessment to get personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You haven't completed your career assessment yet. Complete the assessment to receive a personalized career pathway report.
            </p>
            <Button onClick={handleTakeAssessment}>
              Take Career Assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use the InteractiveCareerReportSection to display the career report
  return (
    <InteractiveCareerReportSection reportData={data.report as CareerReportData} />
  );
};

export default CareerPathwaySection;
