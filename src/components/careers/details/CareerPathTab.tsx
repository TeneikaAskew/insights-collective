
import React from 'react';
import { Users, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { useRoleCourses } from '@/hooks/useRoleCourses';
import { CourseraCourseRow } from '@/components/learning/CourseraCourseRow';

interface CareerPathTabProps {
  role: DataCareerRole;
}

export const CareerPathTab: React.FC<CareerPathTabProps> = ({ role }) => {
  const { platform, coursera, platformIsEmpty } = useRoleCourses(role);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Career Progression</h3>
      </div>
      
      <p className="text-muted-foreground">{role.careerPath?.description || ''}</p>
      
      {role.careerPath?.progressionSteps && (
        <div className="space-y-4 mt-6">
          <h4 className="font-medium">Typical Career Path</h4>
          <div className="space-y-2">
            {role.careerPath.progressionSteps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1">
                  {index < role.careerPath!.progressionSteps.length - 1 ? (
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  ) : (
                    <div className="h-4 w-4"></div>
                  )}
                </div>
                <div className="border rounded-md p-3 flex-1">
                  <h5 className="font-medium">{step.title}</h5>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  {step.timePeriod && (
                    <Badge variant="outline" className="mt-2">{step.timePeriod}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {platform.length > 0 && (
        <div className="mt-8">
          <h4 className="font-medium mb-3">Courses on Insights Collective</h4>
          <div className="grid gap-2">
            {platform.map((course) => (
              <CourseraCourseRow key={course.id} course={course} showDescription showSubjects />
            ))}
          </div>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/courses">Browse All Courses</Link>
            </Button>
          </div>
        </div>
      )}

      {coursera.length > 0 && (
        <div className="mt-8">
          <h4 className="font-medium mb-1">
            {platformIsEmpty ? 'Recommended Courses' : 'Also Worth Studying Elsewhere'}
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            {platformIsEmpty
              ? "We don't have a course for this role yet — these Coursera tracks cover what it needs."
              : 'These Coursera tracks cover the skills our own courses do not reach yet.'}
          </p>
          <div className="grid gap-2">
            {coursera.map((course) => (
              <CourseraCourseRow key={course.id} course={course} showDescription showSubjects />
            ))}
          </div>
          {platformIsEmpty && (
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/courses">Browse All Courses</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
