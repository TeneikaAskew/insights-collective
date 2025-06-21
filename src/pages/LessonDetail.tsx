import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronLeft, Clock, Book } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import ContentBlockRenderer from '@/components/course/content/ContentBlockRenderer';

const LessonDetail = () => {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId: string; 
  }>();
  const { toast } = useToast();
  
  const [lesson, setLesson] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { progress, loading: progressLoading, markComplete, markIncomplete } = useLessonProgress(lessonId);
  const { blocks } = useContentBlocks(undefined, lessonId);
  
  useEffect(() => {
    fetchLessonData();
  }, [lessonId, moduleId, courseId]);
  
  const fetchLessonData = async () => {
    if (!lessonId || !moduleId || !courseId) return;
    
    try {
      setLoading(true);
      
      // Fetch lesson
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      
      if (lessonError) throw lessonError;
      setLesson(lessonData);
      
      // Fetch module
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('*')
        .eq('id', moduleId)
        .single();
      
      if (moduleError) throw moduleError;
      setModule(moduleData);
      
      // Fetch course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      if (courseError) throw courseError;
      setCourse(courseData);
      
    } catch (error) {
      console.error('Error fetching lesson data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lesson data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleMarkComplete = async () => {
    const success = await markComplete();
    if (success) {
      toast({
        title: "Lesson marked as complete",
        description: "Your progress has been updated",
      });
    }
  };
  
  const handleMarkIncomplete = async () => {
    const success = await markIncomplete();
    if (success) {
      toast({
        title: "Lesson marked as incomplete",
        description: "Your progress has been updated",
      });
    }
  };
  
  if (loading || progressLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>Back to Module</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Module
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
              <h3 className="text-lg font-semibold mb-2">Lesson Description</h3>
              <p className="mb-4">{lesson.description}</p>
              
              {lesson.content && (
                <>
                  <h3 className="text-lg font-semibold mb-2">Lesson Overview</h3>
                  <p className="mb-6">{lesson.content}</p>
                </>
              )}
            </div>
            
            {/* Render content blocks */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Lesson Content</h3>
              {blocks.length === 0 ? (
                <div className="text-center py-8 bg-secondary rounded-lg">
                  <Book className="h-16 w-16 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">No content available</p>
                  <p className="text-sm opacity-70 mt-1">Content blocks will appear here once added</p>
                </div>
              ) : (
                blocks.map((block) => (
                  <ContentBlockRenderer 
                    key={block.id} 
                    block={block} 
                    showControls={false} 
                  />
                ))
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
                <Badge variant="outline">Not Completed</Badge>
              )}
              {progress && (
                <Badge variant="secondary">
                  {progress.completion_percentage}% Complete
                </Badge>
              )}
            </div>
            
            <div className="space-x-2">
              {!progress?.completed ? (
                <Button onClick={handleMarkComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              ) : (
                <Button variant="outline" onClick={handleMarkIncomplete}>
                  Mark as Incomplete
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