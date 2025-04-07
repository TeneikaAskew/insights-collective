import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { mockService } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ChevronLeft, Clock, FileText, Upload, Book, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ModuleDetail = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const { toast } = useToast();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [assignmentSubmission, setAssignmentSubmission] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const course = mockService.getCourseById(courseId || '');
  const module = mockService.getModuleById(moduleId || '');
  
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
  
  if (!activeLesson && module.lessons.length > 0) {
    setActiveLesson(module.lessons[0].id);
  }
  
  const handleMarkComplete = (lessonId: string) => {
    toast({
      title: "Lesson marked as complete",
      description: "Your progress has been updated",
    });
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
  
  const getActiveLesson = () => {
    return module.lessons.find(lesson => lesson.id === activeLesson);
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
                    <span>{module.completionStatus}%</span>
                  </div>
                  <Progress value={module.completionStatus} className="h-2" />
                </div>
              </CardContent>
            </Card>
            
            <Tabs defaultValue="lessons">
              <TabsList>
                <TabsTrigger value="lessons">Lessons</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              
              <TabsContent value="lessons" className="space-y-6 mt-6">
                {activeLesson && getActiveLesson() ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">{getActiveLesson()?.title}</CardTitle>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{getActiveLesson()?.duration}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-video bg-black rounded-lg mb-6 flex items-center justify-center text-white">
                        <div className="text-center p-4">
                          <Clock className="h-16 w-16 mx-auto mb-2 opacity-50" />
                          <p>Video player would be embedded here</p>
                          <p className="text-sm opacity-70 mt-1">Lesson: {getActiveLesson()?.title}</p>
                        </div>
                      </div>
                      
                      <div className="prose max-w-none">
                        <h3 className="text-lg font-semibold mb-2">Lesson Description</h3>
                        <p>{getActiveLesson()?.description}</p>
                        
                        <h3 className="text-lg font-semibold mt-6 mb-2">Lesson Content</h3>
                        <p>{getActiveLesson()?.content}</p>
                      </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                      <div>
                        {module.lessons.indexOf(getActiveLesson()!) > 0 && (
                          <Button 
                            variant="outline" 
                            onClick={() => setActiveLesson(module.lessons[module.lessons.indexOf(getActiveLesson()!) - 1].id)}
                          >
                            Previous Lesson
                          </Button>
                        )}
                      </div>
                      <div className="space-x-2">
                        {!getActiveLesson()?.completed && (
                          <Button onClick={() => handleMarkComplete(getActiveLesson()!.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Complete
                          </Button>
                        )}
                        
                        {module.lessons.indexOf(getActiveLesson()!) < module.lessons.length - 1 && (
                          <Button 
                            variant={getActiveLesson()?.completed ? "default" : "secondary"}
                            onClick={() => setActiveLesson(module.lessons[module.lessons.indexOf(getActiveLesson()!) + 1].id)}
                          >
                            Next Lesson
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <p className="text-muted-foreground">No lessons available in this module.</p>
                    </CardContent>
                  </Card>
                )}
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">All Lessons</h3>
                  <div className="space-y-3">
                    {module.lessons.map((lesson) => (
                      <Card 
                        key={lesson.id} 
                        className={`cursor-pointer ${activeLesson === lesson.id ? 'border-primary' : ''}`}
                        onClick={() => setActiveLesson(lesson.id)}
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-foreground">
                              <Book className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{lesson.title}</h4>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>{lesson.duration}</span>
                              </div>
                            </div>
                          </div>
                          
                          {lesson.completed ? (
                            <Badge className="bg-green-500 text-white hover:bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Completed</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="assignments" className="mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Module Assignments</h3>
                  
                  {module.assignments.length > 0 ? (
                    <div className="space-y-6">
                      {module.assignments.map((assignment) => (
                        <Card key={assignment.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xl">{assignment.title}</CardTitle>
                              <Badge variant={
                                assignment.status === 'Graded' ? 'default' :
                                assignment.status === 'Submitted' ? 'secondary' :
                                assignment.status === 'In Progress' ? 'outline' : 'outline'
                              }>
                                {assignment.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-1">Assignment Description</h4>
                              <p className="text-muted-foreground">{assignment.description}</p>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>Due: {new Date(assignment.dueDate || '').toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span>Points: {assignment.points}</span>
                              </div>
                            </div>
                            
                            {assignment.status === 'Graded' || assignment.status === 'Submitted' ? (
                              <div className="bg-secondary p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Your Submission</h4>
                                <p className="text-sm">{assignment.submission?.content}</p>
                                
                                {assignment.status === 'Graded' && (
                                  <div className="mt-4 pt-4 border-t">
                                    <div className="flex justify-between mb-2">
                                      <h4 className="font-medium">Feedback</h4>
                                      <span className="font-medium">{assignment.submission?.grade} / {assignment.points}</span>
                                    </div>
                                    <p className="text-sm">{assignment.submission?.feedback}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Textarea 
                                  placeholder="Enter your submission here..." 
                                  className="min-h-[150px]"
                                  value={assignmentSubmission}
                                  onChange={(e) => setAssignmentSubmission(e.target.value)}
                                />
                                
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" className="flex-1">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Attach Files
                                  </Button>
                                  <Button 
                                    className="flex-1"
                                    onClick={() => handleSubmitAssignment(assignment.id)}
                                    disabled={submitting}
                                  >
                                    {submitting ? "Submitting..." : "Submit Assignment"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
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
                  
                  {module.quizzes.length > 0 ? (
                    <div className="space-y-6">
                      {module.quizzes.map((quiz) => (
                        <Card key={quiz.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xl">{quiz.title}</CardTitle>
                              <Badge variant={
                                quiz.status === 'Completed' ? 'default' :
                                quiz.status === 'In Progress' ? 'secondary' : 'outline'
                              }>
                                {quiz.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-muted-foreground">{quiz.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>Time Limit: {quiz.timeLimit} minutes</span>
                              </div>
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                <span>Questions: {quiz.questions.length}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>Due: {new Date(quiz.dueDate || '').toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                <span>Total Points: {quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
                              </div>
                            </div>
                            
                            {quiz.status === 'Completed' ? (
                              <div className="bg-secondary p-4 rounded-lg">
                                <div className="flex justify-between mb-2">
                                  <h4 className="font-medium">Your Score</h4>
                                  <span className="font-medium">{quiz.score} / {quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
                                </div>
                                <p className="text-sm">You've completed this quiz. You can review your answers by clicking the button below.</p>
                                <Button variant="outline" className="mt-4 w-full">
                                  Review Quiz
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                className="w-full"
                                onClick={() => handleTakeQuiz(quiz.id)}
                              >
                                {quiz.status === 'In Progress' ? "Continue Quiz" : "Start Quiz"}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
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
              
              <TabsContent value="resources" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Module Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>Lecture Materials</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Lecture 1 - Introduction Slides</span>
                              <Badge variant="outline">PDF</Badge>
                            </li>
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Lecture 2 - Core Concepts</span>
                              <Badge variant="outline">PDF</Badge>
                            </li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="item-2">
                        <AccordionTrigger>Exercise Files</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Exercise 1 - Starter Files</span>
                              <Badge variant="outline">ZIP</Badge>
                            </li>
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Exercise 1 - Solution</span>
                              <Badge variant="outline">ZIP</Badge>
                            </li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="item-3">
                        <AccordionTrigger>Supplementary Reading</AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Research Paper - Advanced Techniques</span>
                              <Badge variant="outline">PDF</Badge>
                            </li>
                            <li className="flex items-center p-2 rounded-md hover:bg-secondary">
                              <FileText className="h-4 w-4 mr-2 text-primary" />
                              <span className="flex-1">Industry Case Study</span>
                              <Badge variant="outline">PDF</Badge>
                            </li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
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
                    <span>{module.completionStatus}%</span>
                  </div>
                  <Progress value={module.completionStatus} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Lessons</span>
                    <span>{module.lessons.filter(l => l.completed).length} / {module.lessons.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Assignments</span>
                    <span>{module.assignments.filter(a => a.status === 'Graded' || a.status === 'Submitted').length} / {module.assignments.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Quizzes</span>
                    <span>{module.quizzes.filter(q => q.status === 'Completed').length} / {module.quizzes.length}</span>
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
                {course.modules.map((m) => (
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
