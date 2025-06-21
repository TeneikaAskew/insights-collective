import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronLeft, Clock, Book } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ContentBlockRenderer from '@/components/course/content/ContentBlockRenderer';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content: string;
  order_num: number;
  duration?: string;
  estimated_duration?: number;
}

interface Module {
  id: string;
  title: string;
}

interface Course {
  id: string;
  title: string;
}

const LessonDetail = () => {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId: string; 
  }>();
  const { toast } = useToast();
  const { progress, markAsComplete } = useLessonProgress(lessonId);
  const { blocks } = useContentBlocks(undefined, lessonId);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId || !moduleId || !lessonId) return;

      try {
        setLoading(true);
        
        // Fetch course
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, title')
          .eq('id', courseId)
          .single();

        if (courseError) throw courseError;

        // Fetch module
        const { data: moduleData, error: moduleError } = await supabase
          .from('modules')
          .select('id, title')
          .eq('id', moduleId)
          .single();

        if (moduleError) throw moduleError;

        // Fetch lesson
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();

        if (lessonError) throw lessonError;

        setCourse(courseData);
        setModule(moduleData);
        setLesson(lessonData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load lesson details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, moduleId, lessonId]);
  
  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!course || !module || !lesson) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Lesson Not Found</h1>
          <p className="text-muted-foreground mb-6">The lesson you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to={`/courses/${courseId}`}>Back to Course</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  const handleMarkComplete = async () => {
    const success = await markAsComplete();
    if (success) {
      toast({
        title: "Lesson marked as complete",
        description: "Your progress has been updated",
      });
    }
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Course
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{lesson.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{lesson.duration}</span>
              </div>
              <div className="flex items-center">
                <Book className="h-4 w-4 mr-1" />
                <span>{module.title}</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="prose max-w-none mb-6">
              <h3 className="text-lg font-semibold mb-2">Lesson Overview</h3>
              <p className="mb-4">{lesson.description}</p>
              
              {lesson.content && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <p>{lesson.content}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Lesson Content</h3>
              {blocks.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No content blocks available for this lesson.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blocks.map((block) => (
                    <ContentBlockRenderer key={block.id} block={block} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="justify-between">
            <div className="flex items-center gap-2">
              {progress?.completed ? (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline">
                  {progress?.completion_percentage || 0}% Complete
                </Badge>
              )}
              
              {lesson.duration && (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  {lesson.duration}
                </Badge>
              )}
            </div>
            
            <div className="space-x-2">
              {!progress?.completed && (
                <Button onClick={handleMarkComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
};

export default LessonDetail;