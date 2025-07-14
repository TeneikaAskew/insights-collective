import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { CourseLayout } from '@/components/course/CourseLayout';
import { mockService } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronLeft, Clock, Book } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LessonDetail = () => {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId: string; 
  }>();
  const { toast } = useToast();
  
  const course = mockService.getCourseById(courseId || '');
  const module = mockService.getModuleById(moduleId || '');
  const lesson = module?.lessons.find(l => l.id === lessonId);
  
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
  
  const handleMarkComplete = () => {
    toast({
      title: "Lesson marked as complete",
      description: "Your progress has been updated",
    });
  };
  
  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Lesson Header with Breadcrumb */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
            <Link to="/enrolled-courses" className="hover:text-primary">Courses</Link>
            <span>/</span>
            <Link to={`/courses/${courseId}`} className="hover:text-primary">{course?.title}</Link>
            <span>/</span>
            <Link to={`/courses/${courseId}/modules/${moduleId}`} className="hover:text-primary">{module?.title}</Link>
            <span>/</span>
            <span className="text-primary font-medium">{lesson.title}</span>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
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
            </div>
            <div className="text-right">
              {lesson.completed ? (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline">Not Completed</Badge>
              )}
            </div>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lesson Content</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="aspect-video bg-secondary rounded-lg mb-6 flex items-center justify-center">
              <div className="text-center p-4">
                <Clock className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p className="text-lg font-medium">Video Player</p>
                <p className="text-sm opacity-70 mt-1">Lesson content would be displayed here</p>
              </div>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-2">Lesson Description</h3>
              <p className="mb-4">{lesson.description}</p>
              
              <h3 className="text-lg font-semibold mb-2">Lesson Content</h3>
              <p>{lesson.content}</p>
            </div>
          </CardContent>
          
          <CardFooter className="justify-end">
            <div className="space-x-2">
              {!lesson.completed && (
                <Button onClick={handleMarkComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </CourseLayout>
  );
};

export default LessonDetail;