
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import CareerHeader from '@/components/career/CareerHeader';
import CareerPathSection from '@/components/career/CareerPathSection';
import SkillsSection from '@/components/career/SkillsSection';
import CareerAIRecommendations from '@/components/career/CareerAIRecommendations';
import LoginWall from '@/components/common/LoginWall';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import InteractiveCareerReportSection from '@/components/assistants/InteractiveCareerReportSection';

const CareerPathway = () => {
  const { isAuthenticated, user } = useAuth();
  const { data, isLoading } = useCareerPathwayResults();
  const navigate = useNavigate();
  const [userSkills, setUserSkills] = useState<string[]>([]);
  
  useEffect(() => {
    if (data?.report?.skillsAndCourses) {
      // Extract user skills from the report
      const skills = data.report.skillsAndCourses.map(item => item.skill);
      setUserSkills(skills);
    }
  }, [data]);
  
  const handleTakeQuiz = () => {
    navigate('/career-quiz');
  };

  if (!isAuthenticated) {
    return <LoginWall message="Please sign in to view and manage your career pathway" />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <CareerHeader />
        
        {isLoading ? (
          <div className="space-y-8 mt-8">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : data?.report?.recommendedRoles?.length > 0 ? (
          <>
            <InteractiveCareerReportSection reportData={data.report} />
            
            {data.actionPlan && (
              <>
                <CareerPathSection actionPlan={data.actionPlan} />
                <SkillsSection actionPlan={data.actionPlan} />
              </>
            )}
            
            <CareerAIRecommendations
              careerPath={data.report.recommendedRoles[0]?.title}
              userSkills={userSkills}
            />
          </>
        ) : (
          <div className="text-center py-12 space-y-6">
            <h2 className="text-3xl font-bold">No Career Assessment Results Yet</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Take our career assessment quiz to get personalized career pathway recommendations,
              skill development guidance, and a customized learning path.
            </p>
            <Button onClick={handleTakeQuiz} size="lg">
              Take Career Assessment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            {/* Show AI recommendations even without assessment */}
            <div className="pt-12">
              <CareerAIRecommendations />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CareerPathway;
