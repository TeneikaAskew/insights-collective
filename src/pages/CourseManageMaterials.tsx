
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import { ChevronLeft } from 'lucide-react';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import LessonManager from '@/components/course/management/LessonManager';
import LessonContentEditor from '@/components/course/management/LessonContentEditor';

const CourseManageMaterials = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canEdit, isInstructor, loading: permissionsLoading } = useCoursePermissions(courseId);
  
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [selectedLesson, setSelectedLesson] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'modules' | 'lessons' | 'content'>('modules');
  
  useEffect(() => {
    if (!permissionsLoading && !isInstructor && !canEdit) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to manage this course's materials.",
        variant: "destructive"
      });
      navigate(`/courses/${courseId}`);
      return;
    }
    
    if (!permissionsLoading && (isInstructor || canEdit)) {
      fetchCourse();
      fetchModules();
    }
  }, [permissionsLoading, isInstructor, canEdit, courseId]);
  
  const fetchCourse = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      if (error) throw error;
      setCourse(data);
    } catch (error) {
      console.error('Error fetching course:', error);
      toast({
        title: 'Error',
        description: 'Failed to load course details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchModules = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('week', { ascending: true });
      
      if (error) throw error;
      setModules(data || []);
      
      if (data && data.length > 0 && !selectedModule) {
        setSelectedModule(data[0]);
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load modules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModule = (module: any) => {
    setSelectedModule(module);
    setView('lessons');
    setSelectedLesson(null);
  };

  const handleEditLesson = (lessonId: string, lessonTitle: string) => {
    setSelectedLesson({ id: lessonId, title: lessonTitle });
    setView('content');
  };

  const handleBackToModules = () => {
    setView('modules');
    setSelectedModule(null);
    setSelectedLesson(null);
  };

  const handleBackToLessons = () => {
    setView('lessons');
    setSelectedLesson(null);
  };

  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!course) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist or has been removed.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${courseId}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Course
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground">Manage course materials and content</p>
          </div>
        </div>

        {view === 'modules' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>
                  Select a module to manage its lessons and content
                </CardDescription>
              </CardHeader>
              <CardContent>
                {modules.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No modules found for this course.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Please add modules to the course first.
                    </p>
                  </div>
                ) : (
                  <Accordion type="single" collapsible>
                    {modules.map((module) => (
                      <AccordionItem key={module.id} value={module.id}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left">
                              <h3 className="font-medium">Week {module.week}: {module.title}</h3>
                              <p className="text-sm text-muted-foreground">{module.description}</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-4">
                            <p className="text-sm text-muted-foreground mb-4">
                              Manage lessons and content blocks for this module.
                            </p>
                            <Button onClick={() => handleSelectModule(module)}>
                              Manage Lessons
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {view === 'lessons' && selectedModule && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={handleBackToModules}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Modules
              </Button>
            </div>
            <LessonManager
              moduleId={selectedModule.id}
              moduleName={`Week ${selectedModule.week}: ${selectedModule.title}`}
              onEditLesson={handleEditLesson}
            />
          </div>
        )}

        {view === 'content' && selectedLesson && (
          <LessonContentEditor
            lessonId={selectedLesson.id}
            lessonTitle={selectedLesson.title}
            onBack={handleBackToLessons}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CourseManageMaterials;
