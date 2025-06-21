import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ChevronLeft, Clock, FileText, Upload, Book, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import ContentBlockRenderer from '@/components/course/content/ContentBlockRenderer';

const ModuleDetail = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const { toast } = useToast();
  const [activeContent, setActiveContent] = useState<string | null>(null);
  const [assignmentSubmission, setAssignmentSubmission] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Use content blocks and progress tracking hooks
  const { blocks: contentBlocks, loading: contentLoading } = useContentBlocks(moduleId);
  const { moduleProgress, getContentProgress, markContentComplete } = useProgressTracking(undefined, moduleId);

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
  
  // Set active content to first block if none selected and blocks exist
  if (!activeContent && contentBlocks.length > 0) {
    setActiveContent(contentBlocks[0].id);
  }
  
  const handleMarkComplete = async (contentBlockId: string) => {
    const success = await markContentComplete(contentBlockId);
    if (success) {
      toast({
        title: "Content marked as complete",
        description: "Your progress has been updated",
      });
    }
  };
  
  const handleSubmitAssignment = (assignmentId: string) => {
    if (!assignmentSubmission.trim()) {
      toast({
        title: "Error",
        description: "Please enter your submission",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    setTimeout(() => {
      setSubmitting(false);
      setAssignmentSubmission('');
      toast({
        title: "Assignment submitted",
        description: "Your submission has been received successfully",
      });
    }, 1000);
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
        
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-muted-foreground">{module.description}</p>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Module Progress</span>
                    <span>{moduleProgress?.completion_percentage || 0}%</span>
                  </div>
                  <Progress value={moduleProgress?.completion_percentage || 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {moduleProgress?.completed_blocks || 0} of {moduleProgress?.total_blocks || 0} content blocks completed
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="assignments">Assignments ({assignmentBlocks.length})</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes ({quizBlocks.length})</TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content" className="space-y-6 mt-6">
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
                ) : textBlocks.length > 0 ? (
                  <div className="space-y-6">
                    {/* Active Content Display */}
                    {activeContent && getActiveContent() && (
                      <div className="space-y-4">
                        <ContentBlockRenderer
                          block={getActiveContent()!}
                          showControls={false}
                        />
                        
                        <div className="flex justify-between items-center">
                          <div>
                            {textBlocks.findIndex(block => block.id === activeContent) > 0 && (
                              <Button 
                                variant="outline" 
                                onClick={() => setActiveContent(textBlocks[textBlocks.findIndex(block => block.id === activeContent) - 1].id)}
                              >
                                Previous
                              </Button>
                            )}
                          </div>
                          <div className="space-x-2">
                            {!getContentProgress(activeContent)?.completed && (
                              <Button onClick={() => handleMarkComplete(activeContent)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Complete
                              </Button>
                            )}
                            
                            {textBlocks.findIndex(block => block.id === activeContent) < textBlocks.length - 1 && (
                              <Button 
                                onClick={() => setActiveContent(textBlocks[textBlocks.findIndex(block => block.id === activeContent) + 1].id)}
                              >
                                Next
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Content Block List */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">All Content</h3>
                      <div className="space-y-3">
                        {textBlocks.map((block, index) => {
                          const progress = getContentProgress(block.id);
                          return (
                            <Card 
                              key={block.id} 
                              className={`cursor-pointer hover:shadow-md transition-all duration-200 ${activeContent === block.id ? 'ring-2 ring-primary' : ''}`}
                              onClick={() => setActiveContent(block.id)}
                            >
                              <CardContent className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-foreground">
                                    <span className="text-sm font-medium">{index + 1}</span>
                                  </div>
                                  <div>
                                    <h4 className="font-medium">{block.title || `${block.block_type} Content`}</h4>
                                     <div className="flex items-center text-sm text-muted-foreground">
                                       <span className="capitalize">{block.block_type}</span>
                                       {block.metadata?.duration && (
                                         <>
                                           <Clock className="h-3 w-3 ml-2 mr-1" />
                                           <span>{block.metadata.duration} min</span>
                                         </>
                                       )}
                                     </div>
                                  </div>
                                </div>
                                
                                {progress?.completed ? (
                                  <Badge className="bg-green-500 text-white hover:bg-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Completed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not Completed</Badge>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <p className="text-muted-foreground">No content available in this module.</p>
                    </CardContent>
                  </Card>
                )}
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
                      <div className="grid grid-cols-3 gap-4">
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
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{moduleProgress?.completion_percentage || 0}%</span>
                        </div>
                        <Progress value={moduleProgress?.completion_percentage || 0} />
                        <p className="text-xs text-muted-foreground">
                          {moduleProgress?.completed_blocks || 0} of {moduleProgress?.total_blocks || 0} items completed
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Module Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Completion</span>
                    <span>{moduleProgress?.completion_percentage || 0}%</span>
                  </div>
                  <Progress value={moduleProgress?.completion_percentage || 0} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Content</span>
                    <span>{textBlocks.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Assignments</span>
                    <span>{assignmentBlocks.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Quizzes</span>
                    <span>{quizBlocks.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Completed</span>
                    <span>{moduleProgress?.completed_blocks || 0} / {moduleProgress?.total_blocks || 0}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/courses/${courseId}`}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Course
                  </Link>
                </Button>
              </CardFooter>
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
    </AppLayout>
  );
};

export default ModuleDetail;
