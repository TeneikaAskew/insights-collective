// Canvas-style module detail page for students
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { CourseLayout } from '@/components/course/CourseLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  ClipboardList, 
  HelpCircle,
  ExternalLink,
  Settings,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  AlertCircle
} from 'lucide-react';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import CanvasContentService from '@/services/canvasContentService';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import type { ContentItem, Module } from '@/types/canvas';
import { format } from 'date-fns';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CanvasModuleDetail');

const CanvasModuleDetail = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadData();
  }, [courseId, moduleId]);

  useEffect(() => {
    // Auto-select first content item if none selected
    if (contentItems.length > 0 && !selectedItem) {
      setSelectedItem(contentItems[0]);
    }
  }, [contentItems]);

  const loadData = async () => {
    // Validate that both courseId and moduleId are valid UUIDs
    if (!courseId || !moduleId || courseId === 'undefined' || moduleId === 'undefined') {
      logger.error('Invalid course or module ID:', { courseId, moduleId });
      setLoading(false);
      toast({
        title: "Error",
        description: "Invalid course or module ID",
        variant: "destructive"
      });
      return;
    }

    // Basic UUID validation - ensure it's not just "undefined" string
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courseId) || !uuidRegex.test(moduleId)) {
      logger.error('Invalid UUID format:', { courseId, moduleId });
      setLoading(false);
      toast({
        title: "Error", 
        description: "Invalid course or module ID format",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Reset selected item when loading new module
      setSelectedItem(null);

      // Load course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Check user role early
      const isInstructor = user?.roles?.includes('instructor') || user?.roles?.includes('admin');

      // Load module with published filter for non-instructors
      const moduleQuery = supabase
        .from('modules')
        .select('*')
        .eq('id', moduleId);

      if (!isInstructor) {
        moduleQuery.eq('published', true);
      }

      const { data: moduleData, error: moduleError } = await moduleQuery.single();

      if (moduleError) throw moduleError;
      if (!moduleData) {
        throw new Error('Module not found or not published');
      }
      setModule(moduleData);

      // Load all modules for navigation with published filter for non-instructors
      const modulesQuery = supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (!isInstructor) {
        modulesQuery.eq('published', true);
      }

      const { data: modulesData, error: modulesError } = await modulesQuery;

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Load content items
      const items = await CanvasContentService.getContentItems(moduleId);
      
      // CRITICAL: Filter out unpublished content in the student/viewing context
      // Only show published content to everyone, including instructors
      // Unpublished content should only be visible in the editing interface
      const visibleItems = items.filter(item => {
        // If content has no published status (null/undefined), hide from everyone
        if (item.published === null || item.published === undefined) {
          return false;
        }
        
        // Only show explicitly published content in the viewing interface
        // Instructors will see unpublished content in the edit mode only
        return item.published === true;
      });
      
      setContentItems(visibleItems);

      // Calculate progress based on actual completion
      if (visibleItems.length > 0) {
        const { data: progressData } = await supabase
          .from('content_item_progressions')
          .select('workflow_state')
          .eq('user_id', user?.id)
          .in('content_item_id', visibleItems.map(item => item.id));
        
        const completedItems = progressData?.filter(p => p.workflow_state === 'read') || [];
        const progressPercentage = Math.round((completedItems.length / visibleItems.length) * 100);
        setProgress(progressPercentage);
      } else {
        setProgress(0);
      }

    } catch (error: any) {
      logger.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load module content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: ContentItem) => {
    setSelectedItem(item);
    
    // Mark as read
    try {
      await CanvasContentService.markContentItemAsRead(item.id);
      
      // Recalculate progress after marking as read
      const { data: progressData } = await supabase
        .from('content_item_progressions')
        .select('workflow_state')
        .eq('user_id', user?.id)
        .in('content_item_id', contentItems.map(item => item.id));
      
      const completedItems = progressData?.filter(p => p.workflow_state === 'read') || [];
      const progressPercentage = Math.round((completedItems.length / contentItems.length) * 100);
      setProgress(progressPercentage);
    } catch (error) {
      logger.error('Error marking item as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'page': return <FileText className="h-5 w-5" />;
      case 'assignment': return <ClipboardList className="h-5 w-5" />;
      case 'quiz': return <HelpCircle className="h-5 w-5" />;
      case 'external_url': return <ExternalLink className="h-5 w-5" />;
      case 'external_tool': return <Settings className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const renderContentView = () => {
    if (!selectedItem) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Select an item from the module to view its content.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{selectedItem.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{selectedItem.type}</Badge>
                {selectedItem.assignment?.due_at && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Due {format(new Date(selectedItem.assignment.due_at), 'MMM d, yyyy')}
                  </div>
                )}
                {selectedItem.quiz?.time_limit && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {selectedItem.quiz.time_limit} minutes
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Render content based on type */}
          {selectedItem.type === 'page' && (
            <div className="prose prose-lg max-w-none">
              <UnifiedCanvasEditor
                content={selectedItem.content || ''}
                onChange={() => {}}
                readOnly={true}
              />
            </div>
          )}

          {selectedItem.type === 'assignment' && (
            <div className="space-y-6">
              <div className="prose prose-lg max-w-none">
                <UnifiedCanvasEditor
                  content={selectedItem.content || ''}
                  onChange={() => {}}
                  readOnly={true}
                />
              </div>
              
              {selectedItem.assignment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Assignment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Points Possible:</span>
                      <span>{selectedItem.assignment.points_possible || 'Not graded'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Submission Types:</span>
                      <span>{selectedItem.assignment.submission_types?.join(', ')}</span>
                    </div>
                    <div className="pt-4">
                      <Button 
                        className="w-full"
                        onClick={() => navigate(`/courses/${courseId}/modules/${moduleId}/assignments/${selectedItem.id}/submit`)}
                      >
                        Submit Assignment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {selectedItem.type === 'quiz' && (
            <div className="space-y-6">
              <div className="prose prose-lg max-w-none">
                <UnifiedCanvasEditor
                  content={selectedItem.content || ''}
                  onChange={() => {}}
                  readOnly={true}
                />
              </div>
              
              {selectedItem.quiz && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quiz Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Questions:</span>
                      <span>{selectedItem.quiz.questions?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Limit:</span>
                      <span>{selectedItem.quiz.time_limit ? `${selectedItem.quiz.time_limit} minutes` : 'No limit'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Attempts Allowed:</span>
                      <span>{selectedItem.quiz.allowed_attempts}</span>
                    </div>
                    <div className="pt-4">
                      <Button 
                        className="w-full"
                        onClick={() => navigate(`/courses/${courseId}/modules/${moduleId}/quizzes/${selectedItem.id}`)}
                      >
                        Take Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {selectedItem.type === 'external_url' && (
            <div className="text-center py-8">
              <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                This links to an external resource.
              </p>
              <Button asChild>
                <a href={selectedItem.settings?.url} target="_blank" rel="noopener noreferrer">
                  Open External Link
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!course || !module) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Module Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The module you're looking for doesn't exist or has been removed.
          </p>
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
        {/* Header with Breadcrumb */}
        <div className="bg-card border rounded-lg p-6">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/enrolled-courses">My Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/courses/${courseId}`}>{course.title}</Link>
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
              {module.description && (
                <div 
                  className="prose prose-sm max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: module.description }}
                />
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Progress</div>
              <div className="font-semibold">{progress}%</div>
            </div>
          </div>

          <Progress value={progress} className="mt-4" />
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Module Content Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Module Content
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {contentItems.length} {contentItems.length === 1 ? 'Activity' : 'Activities'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3">
                {contentItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedItem?.id === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getIcon(item.type)}
                      <span className="text-sm font-medium truncate">
                        {item.title}
                      </span>
                    </div>
                    {item.type === 'assignment' && item.assignment?.due_at && (
                      <div className="text-xs mt-1 opacity-80">
                        Due {format(new Date(item.assignment.due_at), 'MMM d')}
                      </div>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Module Navigation */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Course Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/courses/${courseId}`}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Course
                  </Link>
                </Button>

                {/* Previous/Next Module */}
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const currentIndex = modules.findIndex(m => m.id === module.id);
                    const prevModule = currentIndex > 0 ? modules[currentIndex - 1] : null;
                    if (prevModule) {
                      return (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/courses/${courseId}/modules/${prevModule.id}`}>
                            <ChevronLeft className="h-3 w-3 mr-1" />
                            Prev
                          </Link>
                        </Button>
                      );
                    }
                    return (
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Prev
                      </Button>
                    );
                  })()}
                  {(() => {
                    const currentIndex = modules.findIndex(m => m.id === module.id);
                    const nextModule = currentIndex < modules.length - 1 ? modules[currentIndex + 1] : null;
                    if (nextModule) {
                      return (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/courses/${courseId}/modules/${nextModule.id}`}>
                            Next
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      );
                    }
                    return (
                      <Button variant="outline" size="sm" disabled>
                        Next
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {renderContentView()}
          </div>
        </div>
      </div>
    </CourseLayout>
  );
};

export default CanvasModuleDetail;