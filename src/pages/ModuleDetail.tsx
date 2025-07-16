import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { CourseLayout } from '@/components/course/CourseLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ChevronLeft, Clock, FileText, Upload, Book, CheckCircle2 } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useLessons } from '@/hooks/useLessons';
import { useLessonProgress } from '@/hooks/useLessonProgress';

import ContentBlockRenderer from '@/components/course/content/ContentBlockRenderer';
import StudentContentRenderer from '@/components/course/content/StudentContentRenderer';
import { ModuleCompletionCard } from '@/components/course/ModuleCompletionCard';
import { LessonAccordion } from '@/components/course/LessonAccordion';

const ModuleDetail = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [activeContent, setActiveContent] = useState<string | null>(null);
  const [assignmentSubmission, setAssignmentSubmission] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Use content blocks, lessons, and progress hooks
  const { blocks: contentBlocks, loading: contentLoading } = useContentBlocks(moduleId);
  const { lessons, loading: lessonsLoading } = useLessons(moduleId);
  const { 
    moduleProgress, 
    assignmentProgress, 
    quizProgress, 
    loading: progressLoading, 
    markModuleComplete, 
    submitAssignment 
  } = useModuleProgress(moduleId);

  // Simple lesson progress state for now - can be enhanced later with proper hooks
  const [lessonProgressData, setLessonProgressData] = useState<Record<string, any>>({});

  // Set active content to first block if none selected and blocks exist
  useEffect(() => {
    if (!activeContent && contentBlocks.length > 0) {
      setActiveContent(contentBlocks[0].id);
    }
  }, [contentBlocks, activeContent]);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId || !moduleId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch course data
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();

        if (courseError) throw courseError;

        // Fetch module data
        const { data: moduleData, error: moduleError } = await supabase
          .from('modules')
          .select('*')
          .eq('id', moduleId)
          .single();

        if (moduleError) throw moduleError;

        // Fetch all modules for navigation
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });

        if (modulesError) throw modulesError;

        setCourse(courseData);
        setModules(modulesData || []);
        setModule({
          ...moduleData,
          completionStatus: 0
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load module data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, moduleId, toast]);
  
  
  const handleSubmitAssignment = async (assignmentId: string) => {
    if (!assignmentSubmission.trim()) {
      toast({
        title: "Error",
        description: "Please enter your submission",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    const success = await submitAssignment(assignmentId, {
      submission_text: assignmentSubmission,
      submitted_at: new Date().toISOString()
    });
    
    if (success) {
      setAssignmentSubmission('');
    }
    
    setSubmitting(false);
  };

  const handleMarkModuleComplete = async () => {
    await markModuleComplete();
  };
  
  const handleTakeQuiz = (quizId: string) => {
    toast({
      title: "Quiz started",
      description: "Good luck with your quiz!",
    });
  };
  
  const getActiveContent = () => {
    return contentBlocks.find(block => block.id === activeContent);
  };

  // Get content blocks by type
  const textBlocks = contentBlocks.filter(block => ['text', 'image', 'video', 'file', 'quote', 'code', 'embed'].includes(block.block_type));
  const assignmentBlocks = contentBlocks.filter(block => block.block_type === 'assignment');
  const quizBlocks = contentBlocks.filter(block => block.block_type === 'quiz');
  
  // Get module-level content blocks (not assigned to any lesson)
  const moduleLevelBlocks = contentBlocks.filter(block => !block.lesson_id);
  
  // Conditional rendering after all hooks have been called
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!course || !module) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Module Not Found</h1>
          <p className="text-muted-foreground mb-6">The module you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to={`/courses/${courseId}`}>Back to Course</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Module Header with Breadcrumb */}
        <div className="bg-card border rounded-lg p-6">
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={isAuthenticated ? "/enrolled-courses" : "/courses"}>Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/courses/${courseId}`}>{course?.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{module.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                Week {module.week}: {module.title}
              </h1>
              <p className="text-muted-foreground">{module.description}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Progress</div>
              <div className="font-semibold">{moduleProgress?.completion_percentage || 0}%</div>
            </div>
          </div>
          
          <Progress value={moduleProgress?.completion_percentage || 0} className="mt-4" />
        </div>
        
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            
            <Tabs defaultValue="lessons">
              <TabsList>
                <TabsTrigger value="lessons">Lessons ({lessons.length})</TabsTrigger>
                <TabsTrigger value="content">Module Content</TabsTrigger>
                <TabsTrigger value="assignments">Assignments ({assignmentBlocks.length})</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes ({quizBlocks.length})</TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="lessons" className="space-y-6 mt-6">
                {lessonsLoading ? (
                  <div className="space-y-4">
                    <Card className="p-6">
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <LessonAccordion
                    lessons={lessons}
                    contentBlocks={contentBlocks}
                    lessonProgress={lessonProgressData}
                    courseId={courseId!}
                    moduleId={moduleId!}
                  />
                )}
              </TabsContent>

              <TabsContent value="content" className="space-y-6 mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Module-Level Content</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Content that applies to the entire module, not specific to any lesson.
                  </p>
                  
                  {contentLoading ? (
                    <div className="space-y-4">
                      <Card className="p-6">
                        <div className="animate-pulse space-y-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-2 bg-gray-200 rounded"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </Card>
                    </div>
                  ) : moduleLevelBlocks.length > 0 ? (
                    <div className="max-w-4xl mx-auto space-y-4">
                      {moduleLevelBlocks
                        .filter(block => ['text', 'image', 'video', 'file', 'quote', 'code', 'embed'].includes(block.block_type))
                        .map((block) => (
                          <StudentContentRenderer
                            key={block.id}
                            block={block}
                          />
                        ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground">
                          No module-level content available. All content is organized within lessons.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="assignments" className="mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Module Assignments</h3>
                  
                  {assignmentBlocks.length > 0 ? (
                    <div className="space-y-6">
                      {assignmentBlocks.map((assignment) => (
                        <ContentBlockRenderer
                          key={assignment.id}
                          block={assignment}
                          showControls={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground">No assignments available in this module.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="quizzes" className="mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Module Quizzes</h3>
                  
                  {quizBlocks.length > 0 ? (
                    <div className="space-y-6">
                      {quizBlocks.map((quiz) => (
                        <ContentBlockRenderer
                          key={quiz.id}
                          block={quiz}
                          showControls={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground">No quizzes available in this module.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="overview" className="mt-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Module Overview</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4">
                       <div className="grid grid-cols-4 gap-4">
                         <div className="text-center">
                           <div className="text-2xl font-bold text-purple-600">{lessons.length}</div>
                           <div className="text-sm text-muted-foreground">Lessons</div>
                         </div>
                         <div className="text-center">
                           <div className="text-2xl font-bold text-blue-600">{textBlocks.length}</div>
                           <div className="text-sm text-muted-foreground">Content Blocks</div>
                         </div>
                         <div className="text-center">
                           <div className="text-2xl font-bold text-orange-600">{assignmentBlocks.length}</div>
                           <div className="text-sm text-muted-foreground">Assignments</div>
                         </div>
                         <div className="text-center">
                           <div className="text-2xl font-bold text-green-600">{quizBlocks.length}</div>
                           <div className="text-sm text-muted-foreground">Quizzes</div>
                         </div>
                       </div>
                      
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-6">
            <ModuleCompletionCard
              moduleProgress={moduleProgress}
              assignmentProgress={assignmentProgress}
              quizProgress={quizProgress}
              assignmentCount={assignmentBlocks.length}
              quizCount={quizBlocks.length}
              onMarkComplete={handleMarkModuleComplete}
              loading={progressLoading}
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/courses/${courseId}`}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Course
                  </Link>
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Course Navigation</CardTitle>
              </CardHeader>
               <CardContent className="space-y-3">
                 <h3 className="font-medium text-sm mb-2">Course Modules</h3>
                 {modules.map((m) => (
                   <Link key={m.id} to={`/courses/${courseId}/modules/${m.id}`}>
                     <div className={`flex items-center justify-between p-2 rounded-md text-sm hover:bg-secondary ${m.id === moduleId ? 'bg-secondary' : ''}`}>
                       <span>{m.title}</span>
                       <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                         {m.week}
                       </div>
                     </div>
                   </Link>
                 ))}
               </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CourseLayout>
  );
};

export default ModuleDetail;
