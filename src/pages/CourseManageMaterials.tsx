
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LessonManagerWithMigration from '@/components/course/management/LessonManagerWithMigration';
import AppLayout from '@/components/layout/AppLayout';
import { Plus, ChevronLeft, Trash2, Pencil } from 'lucide-react';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const CourseManageMaterials = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canEdit, isInstructor, loading: permissionsLoading } = useCoursePermissions(courseId);
  
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [editModuleOpen, setEditModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [newModuleWeek, setNewModuleWeek] = useState(1);
  
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
  
  const handleAddModule = async () => {
    if (!newModuleTitle || !courseId) return;
    
    try {
      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: newModuleTitle,
          description: newModuleDescription || `Module ${newModuleWeek}`,
          course_id: courseId,
          week: newModuleWeek
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setModules([...modules, data]);
      setNewModuleTitle('');
      setNewModuleDescription('');
      setNewModuleWeek(modules.length + 1);
      setAddModuleOpen(false);
      
      toast({
        title: 'Success',
        description: 'Module added successfully',
      });
    } catch (error) {
      console.error('Error adding module:', error);
      toast({
        title: 'Error',
        description: 'Failed to add module',
        variant: 'destructive',
      });
    }
  };
  
  const handleUpdateModule = async () => {
    if (!selectedModule) return;
    
    try {
      const { error } = await supabase
        .from('modules')
        .update({
          title: newModuleTitle,
          description: newModuleDescription,
          week: newModuleWeek
        })
        .eq('id', selectedModule.id);
      
      if (error) throw error;
      
      setModules(modules.map(module => 
        module.id === selectedModule.id 
          ? { ...module, title: newModuleTitle, description: newModuleDescription, week: newModuleWeek } 
          : module
      ));
      
      setSelectedModule({
        ...selectedModule,
        title: newModuleTitle,
        description: newModuleDescription,
        week: newModuleWeek
      });
      
      setEditModuleOpen(false);
      
      toast({
        title: 'Success',
        description: 'Module updated successfully',
      });
    } catch (error) {
      console.error('Error updating module:', error);
      toast({
        title: 'Error',
        description: 'Failed to update module',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteModule = async (moduleId: string) => {
    if (!moduleId) return;
    
    if (!confirm('Are you sure you want to delete this module? This will also delete all content blocks within it.')) {
      return;
    }
    
    try {
      // Delete content blocks first
      await supabase
        .from('content_blocks')
        .delete()
        .eq('module_id', moduleId);
      
      // Delete old module content
      await supabase
        .from('module_content')
        .delete()
        .eq('module_id', moduleId);
      
      // Delete the module
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);
      
      if (error) throw error;
      
      const updatedModules = modules.filter(module => module.id !== moduleId);
      setModules(updatedModules);
      
      if (selectedModule && selectedModule.id === moduleId) {
        setSelectedModule(updatedModules.length > 0 ? updatedModules[0] : null);
      }
      
      toast({
        title: 'Success',
        description: 'Module deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting module:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };
  
  const startEditModule = (module: any) => {
    setNewModuleTitle(module.title);
    setNewModuleDescription(module.description);
    setNewModuleWeek(module.week);
    setEditModuleOpen(true);
  };
  
  if (permissionsLoading || loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => navigate(`/courses/${courseId}`)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Course Content Studio</h1>
              <p className="text-gray-600">Create structured course content with modules, lessons, and content blocks</p>
            </div>
          </div>
          
          <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Module</DialogTitle>
                <DialogDescription>
                  Create a new module for your course.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="module-title">Module Title</Label>
                  <Input
                    id="module-title"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    placeholder="Enter module title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="module-description">Description</Label>
                  <Input
                    id="module-description"
                    value={newModuleDescription}
                    onChange={(e) => setNewModuleDescription(e.target.value)}
                    placeholder="Enter module description"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="module-week">Week Number</Label>
                  <Input
                    id="module-week"
                    type="number"
                    min="1"
                    value={newModuleWeek}
                    onChange={(e) => setNewModuleWeek(parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddModuleOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddModule}>
                  Add Module
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {course && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-900">{course.title}</h2>
            <p className="text-blue-700 mt-1">{course.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>Select a module to manage its lessons and content</CardDescription>
              </CardHeader>
              <CardContent>
                {modules.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="text-sm">No modules yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Add your first module to get started.</p>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {modules.map((module) => (
                      <AccordionItem key={module.id} value={module.id}>
                        <AccordionTrigger
                          className={`hover:bg-gray-50 p-2 rounded text-left ${
                            selectedModule?.id === module.id ? 'bg-blue-50 text-blue-800' : ''
                          }`}
                          onClick={() => setSelectedModule(module)}
                        >
                          <div className="flex-1">
                            <div className="font-medium">Week {module.week}</div>
                            <div className="text-sm font-normal">{module.title}</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-2">
                          <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditModule(module);
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModule(module.id);
                              }}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
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
          
          <div className="lg:col-span-3">
            {selectedModule ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Week {selectedModule.week}: {selectedModule.title}</CardTitle>
                      <CardDescription>{selectedModule.description}</CardDescription>
                    </div>
                    <Dialog open={editModuleOpen} onOpenChange={setEditModuleOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Module
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Module</DialogTitle>
                          <DialogDescription>
                            Update module details
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-module-title">Module Title</Label>
                            <Input
                              id="edit-module-title"
                              value={newModuleTitle}
                              onChange={(e) => setNewModuleTitle(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="edit-module-description">Description</Label>
                            <Input
                              id="edit-module-description"
                              value={newModuleDescription}
                              onChange={(e) => setNewModuleDescription(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="edit-module-week">Week Number</Label>
                            <Input
                              id="edit-module-week"
                              type="number"
                              min="1"
                              value={newModuleWeek}
                              onChange={(e) => setNewModuleWeek(parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditModuleOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdateModule}>
                            Update Module
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <LessonManagerWithMigration moduleId={selectedModule.id} />
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-lg font-medium mb-2">No Module Selected</h3>
                  <p className="text-gray-600 mb-6 max-w-md">
                    Select a module from the sidebar to start organizing your content into lessons or 
                    continue using the direct content creation mode.
                  </p>
                  <Button onClick={() => setAddModuleOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Module
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseManageMaterials;
