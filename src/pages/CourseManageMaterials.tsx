
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { ArrowLeft, Plus, Pencil, Trash2, File, Video, FileText, Image } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ModuleContentEditor from '@/components/course/management/ModuleContentEditor';

const CourseManageMaterials = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const { canEdit, loading: permissionsLoading } = useCoursePermissions(courseId);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moduleContents, setModuleContents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('modules');
  
  // Fetch course and modules data
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;
      
      setLoading(true);
      try {
        // Fetch course
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
          
        if (courseError) throw courseError;
        setCourse(courseData);
        
        // Fetch modules
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });
          
        if (modulesError) throw modulesError;
        setModules(modulesData || []);
        
        // Set the first module as selected by default
        if (modulesData && modulesData.length > 0) {
          setSelectedModule(modulesData[0].id);
          fetchModuleContents(modulesData[0].id);
        }
        
      } catch (error: any) {
        console.error('Error fetching course data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load course data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourseData();
  }, [courseId, toast]);
  
  // Fetch module contents when selected module changes
  const fetchModuleContents = async (moduleId: string) => {
    if (!moduleId) return;
    
    try {
      const { data, error } = await supabase
        .from('module_content')
        .select('*')
        .eq('module_id', moduleId)
        .order('position', { ascending: true });
        
      if (error) throw error;
      setModuleContents(data || []);
      
    } catch (error: any) {
      console.error('Error fetching module contents:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load module contents',
        variant: 'destructive',
      });
    }
  };
  
  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId);
    fetchModuleContents(moduleId);
  };
  
  const handleAddContent = async (content: any) => {
    if (!selectedModule) return;
    
    try {
      // Get the highest position value to add new content at the end
      const highestPosition = moduleContents.length > 0 
        ? Math.max(...moduleContents.map(item => item.position)) + 1 
        : 0;
      
      const { data, error } = await supabase
        .from('module_content')
        .insert({
          ...content,
          module_id: selectedModule,
          position: highestPosition
        })
        .select();
        
      if (error) throw error;
      
      // Refresh the content list
      fetchModuleContents(selectedModule);
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
      
    } catch (error: any) {
      console.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add content',
        variant: 'destructive',
      });
    }
  };
  
  const handleUpdateContent = async (contentId: string, updatedContent: any) => {
    try {
      const { error } = await supabase
        .from('module_content')
        .update(updatedContent)
        .eq('id', contentId);
        
      if (error) throw error;
      
      // Refresh the content list
      fetchModuleContents(selectedModule!);
      
      toast({
        title: 'Success',
        description: 'Content updated successfully',
      });
      
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update content',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteContent = async (contentId: string) => {
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', contentId);
        
      if (error) throw error;
      
      // Refresh the content list
      fetchModuleContents(selectedModule!);
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
      
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content',
        variant: 'destructive',
      });
    }
  };
  
  // If permissions are still loading or user doesn't have edit access
  if (permissionsLoading) {
    return (
      <AppLayout>
        <div className="container py-6">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </AppLayout>
    );
  }
  
  if (!canEdit) {
    return (
      <AppLayout>
        <div className="container py-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to edit materials for this course.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate(`/courses/${courseId}`)}>
                Back to Course
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <h1 className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-40" /> : `Manage: ${course?.title}`}
            </h1>
          </div>
        </div>
        
        <Tabs defaultValue="modules" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="modules">Course Modules</TabsTrigger>
            <TabsTrigger value="content">Module Content</TabsTrigger>
          </TabsList>
          
          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>
                  Manage the modules for this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : modules.length > 0 ? (
                  <div className="space-y-3">
                    {modules.map(module => (
                      <div 
                        key={module.id} 
                        onClick={() => {
                          handleModuleSelect(module.id);
                          setActiveTab('content');
                        }}
                        className="p-3 border rounded-md hover:bg-muted cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <h3 className="font-medium">{module.title}</h3>
                          <p className="text-sm text-muted-foreground">Week {module.week}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4 mr-2" />
                          Manage Content
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No modules found for this course.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedModule 
                    ? `Edit Content: ${modules.find(m => m.id === selectedModule)?.title}` 
                    : 'Select a Module'}
                </CardTitle>
                <CardDescription>
                  Add, edit, or remove content from this module
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedModule ? (
                  <p className="text-muted-foreground">
                    Please select a module from the "Course Modules" tab to manage its content.
                  </p>
                ) : (
                  <ModuleContentEditor
                    moduleId={selectedModule}
                    contents={moduleContents}
                    onAddContent={handleAddContent}
                    onUpdateContent={handleUpdateContent}
                    onDeleteContent={handleDeleteContent}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CourseManageMaterials;
