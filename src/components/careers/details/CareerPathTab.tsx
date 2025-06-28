
import React from 'react';
import { Users, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface CareerPathTabProps {
  role: DataCareerRole;
}

export const CareerPathTab: React.FC<CareerPathTabProps> = ({ role }) => {
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
      
      {role.courses && role.courses.length > 0 && (
        <div className="mt-8">
          <h4 className="font-medium mb-3">Recommended Courses</h4>
          <div className="grid gap-2">
            {role.courses.map((course, index) => (
              <Link 
                key={index}
                to={`/courses/${course.id}`}
                className="block p-3 border rounded-md hover:bg-primary/5 transition-colors"
              >
                <div className="font-medium">{course.title}</div>
                <div className="text-sm text-muted-foreground">{course.description}</div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/courses">Browse All Courses</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
