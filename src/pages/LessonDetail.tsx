
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, Clock, CheckCircle, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LessonDetail = () => {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId: string; 
  }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Mock lesson data - in a real app, this would come from an API
  const lesson = {
    id: lessonId,
    title: "Introduction to React Components",
    description: "Learn the fundamentals of React components and how to create reusable UI elements.",
    content: `
      <h2>What are React Components?</h2>
      <p>React components are the building blocks of React applications. They let you split the UI into independent, reusable pieces, and think about each piece in isolation.</p>
      
      <h3>Types of Components</h3>
      <ul>
        <li><strong>Functional Components:</strong> Simple functions that return JSX</li>
        <li><strong>Class Components:</strong> ES6 classes that extend React.Component</li>
      </ul>
      
      <h3>Creating Your First Component</h3>
      <p>Here's a simple functional component example:</p>
      <pre><code>
function Welcome(props) {
  return &lt;h1&gt;Hello, {props.name}!&lt;/h1&gt;;
}
      </code></pre>
    `,
    duration: "15 minutes",
    videoUrl: "/api/placeholder/video",
    completed: false,
    order: 1
  };

  const handleMarkComplete = () => {
    setCompleted(true);
    toast({
      title: "Lesson completed!",
      description: "Great job! You can now move to the next lesson.",
    });
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Simulate video progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            return 100;
          }
          return prev + 1;
        });
      }, 150);
    }
  };

  if (!courseId || !moduleId || !lessonId) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Lesson Not Found</h1>
          <p className="text-muted-foreground mb-6">The lesson you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/courses">Back to Courses</Link>
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

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{lesson.title}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{lesson.duration}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white relative">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handlePlayPause}
                    className="absolute z-10 text-white hover:bg-white/20"
                  >
                    {isPlaying ? (
                      <Pause className="h-12 w-12" />
                    ) : (
                      <Play className="h-12 w-12" />
                    )}
                  </Button>
                  <div className="absolute bottom-4 left-4 right-4">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="absolute top-4 left-4 text-sm">
                    {lesson.title}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Lesson Description</h3>
                  <p className="text-muted-foreground">{lesson.description}</p>
                </div>

                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold mb-4">Lesson Content</h3>
                  <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
                </div>
              </CardContent>

              <CardFooter className="justify-between">
                <Button variant="outline" asChild>
                  <Link to={`/courses/${courseId}/modules/${moduleId}`}>
                    Previous
                  </Link>
                </Button>
                
                <div className="space-x-2">
                  {!completed && (
                    <Button onClick={handleMarkComplete}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Complete
                    </Button>
                  )}
                  <Button variant={completed ? "default" : "secondary"} asChild>
                    <Link to={`/courses/${courseId}/modules/${moduleId}`}>
                      Next Lesson
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Lesson Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Video Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  <div className="text-sm">
                    {completed ? (
                      <div className="flex items-center text-green-500">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">In Progress</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LessonDetail;
