import { Module } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, BookOpen, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';
import { htmlToPlainText } from '@/utils/htmlToPlainText';

const logger = createLogger('ModuleCard');

interface ModuleCardProps {
  courseId: string;
  module: Module;
}
const ModuleCard = ({
  courseId,
  module
}: ModuleCardProps) => {
  const { user } = useAuth();
  const [publishedContentCount, setPublishedContentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublishedContentCount = async () => {
      try {
        const { data, error } = await supabase
          .from('content_items')
          .select('id, published')
          .eq('module_id', module.id);

        if (error) {
          logger.error('Error fetching content items:', error);
          return;
        }

        const isInstructor = user?.roles?.includes('instructor') || user?.roles?.includes('admin');
        const visibleItems = data?.filter(item => item.published || isInstructor) || [];
        setPublishedContentCount(visibleItems.length);
      } catch (error) {
        logger.error('Error fetching published content count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublishedContentCount();
  }, [module.id, user?.roles]);

  // Add null checks for all potential undefined properties
  const lessons = module.lessons || [];
  const assignments = module.assignments || [];
  const quizzes = module.quizzes || [];
  const totalItems = lessons.length + assignments.length + quizzes.length;
  return <Link to={`/courses/${courseId}/modules/${module.id}`}>
      <Card className="h-full hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg">{module.title}</CardTitle>
            <div className="flex items-center justify-center rounded-full bg-primary/10 w-8 h-8 text-primary font-semibold">
              {module.week}
            </div>
          </div>
          {/* Module descriptions are rich text — CourseModulesList renders the
              same field through RichTextRenderer — so printing it directly put
              raw tags in front of the reader. Four of the twenty-three modules
              in the database carry markup today. */}
          <CardDescription className="mt-1 line-clamp-2">
            {htmlToPlainText(module.description ?? '')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Completion</span>
              <span>{module.completionStatus || 0}%</span>
            </div>
            <Progress value={module.completionStatus || 0} className="h-2" />

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-ss-peach">
                <BookOpen className="h-4 w-4 mb-1" />
                <span className="text-xs">
                  {loading ? '...' : publishedContentCount} {publishedContentCount === 1 ? 'Activity' : 'Activities'}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-ss-peach">
                <FileText className="h-4 w-4 mb-1" />
                <span className="text-xs">{assignments.length} Assignments</span>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-ss-peach">
                <Clock className="h-4 w-4 mb-1" />
                <span className="text-xs">{quizzes.length} Quizzes</span>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 flex justify-between items-center">
          {(module.completionStatus || 0) === 100 ? <div className="flex items-center text-ss-good text-sm">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>Completed</span>
            </div> : <div className="text-muted-foreground text-sm">
              {totalItems} activities total
            </div>}
        </CardFooter>
      </Card>
    </Link>;
};
export default ModuleCard;