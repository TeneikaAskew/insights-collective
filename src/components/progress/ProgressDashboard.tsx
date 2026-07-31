import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Clock, 
  CheckCircle, 
  BarChart3,
  Target,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { useProgressTracking, CourseProgress } from '@/hooks/useProgressTracking';
import { formatDistanceToNow } from 'date-fns';

interface ProgressDashboardProps {
  courseId: string;
  showDetailedView?: boolean;
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ 
  courseId, 
  showDetailedView = true 
}) => {
  const { courseProgress, loading } = useProgressTracking(courseId);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-2 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!courseProgress) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No progress data available</p>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-ss-good';
    if (percentage >= 60) return 'text-ss-warn';
    return 'text-ss-bad';
  };

  const getProgressBadgeVariant = (percentage: number) => {
    if (percentage === 100) return 'default';
    if (percentage >= 60) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Course Progress</span>
            </CardTitle>
            <Badge 
              variant={getProgressBadgeVariant(courseProgress.overall_completion)}
              className="text-sm"
            >
              {courseProgress.overall_completion}% Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Overall Completion</span>
              <span className={getProgressColor(courseProgress.overall_completion)}>
                {courseProgress.overall_completion}%
              </span>
            </div>
            <Progress value={courseProgress.overall_completion} className="h-3" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold">{courseProgress.completed_modules}</div>
              <div className="text-sm text-muted-foreground">
                of {courseProgress.total_modules} modules
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-ss-lav-deep" />
              </div>
              <div className="text-2xl font-bold">
                {formatTime(courseProgress.total_time_spent)}
              </div>
              <div className="text-sm text-muted-foreground">time spent</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-ss-good" />
              </div>
              <div className="text-2xl font-bold">
                {courseProgress.modules.reduce((sum, m) => sum + m.completed_blocks, 0)}
              </div>
              <div className="text-sm text-muted-foreground">content completed</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-ss-peach-deep" />
              </div>
              <div className="text-2xl font-bold">
                {courseProgress.modules.reduce((sum, m) => sum + m.total_blocks, 0)}
              </div>
              <div className="text-sm text-muted-foreground">total content</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Progress Cards */}
      {showDetailedView && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Module Progress</span>
          </h3>
          
          <div className="grid gap-4">
            {courseProgress.modules.map((module, index) => (
              <Card key={module.module_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Week {index + 1}: {module.module_title}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={getProgressBadgeVariant(module.completion_percentage)}
                        className="text-xs"
                      >
                        {module.completion_percentage}%
                      </Badge>
                      {module.completion_percentage === 100 && (
                        <CheckCircle className="h-4 w-4 text-ss-good" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Progress</span>
                      <span className={getProgressColor(module.completion_percentage)}>
                        {module.completed_blocks} of {module.total_blocks} completed
                      </span>
                    </div>
                    <Progress value={module.completion_percentage} className="h-2" />
                  </div>

                  <div className="flex justify-between text-sm">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatTime(module.time_spent)} spent
                      </span>
                    </div>
                    {module.last_accessed && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Last accessed {formatDistanceToNow(new Date(module.last_accessed), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {courseProgress.overall_completion > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average time per content:</span>
                <span className="font-medium">
                  {formatTime(Math.round(
                    courseProgress.total_time_spent / 
                    Math.max(1, courseProgress.modules.reduce((sum, m) => sum + m.completed_blocks, 0))
                  ))}
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completion rate:</span>
              <span className={`font-medium ${getProgressColor(courseProgress.overall_completion)}`}>
                {courseProgress.overall_completion}%
              </span>
            </div>

            {courseProgress.completed_modules > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modules completed:</span>
                <span className="font-medium text-ss-good">
                  {courseProgress.completed_modules} / {courseProgress.total_modules}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProgressDashboard;