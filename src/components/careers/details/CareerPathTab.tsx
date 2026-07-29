
import React from 'react';
import { Users, ArrowRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { SUBJECT_LABELS } from '@/data/learningSubjects';
import { useRoleCourses } from '@/hooks/useRoleCourses';
import type { ResolvedCourse } from '@/lib/roleCourseResolver';

interface CareerPathTabProps {
  role: DataCareerRole;
}

const CourseRow: React.FC<{ course: ResolvedCourse }> = ({ course }) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{course.title}</span>
        {course.external && (
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="text-sm text-muted-foreground">{course.description}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {course.external && <Badge variant="secondary">{course.provider}</Badge>}
        {course.level && <Badge variant="outline">{course.level}</Badge>}
        {course.matchedSubjects.slice(0, 3).map((subject) => (
          <Badge key={subject} variant="outline">
            {SUBJECT_LABELS[subject]}
          </Badge>
        ))}
      </div>
    </>
  );

  const className = 'block p-3 border rounded-md hover:bg-primary/5 transition-colors';

  if (course.external) {
    return (
      <a href={course.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link to={course.href} className={className}>
      {body}
    </Link>
  );
};

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
              <CourseRow key={course.id} course={course} />
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
              <CourseRow key={course.id} course={course} />
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
