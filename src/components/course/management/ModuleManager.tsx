
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FilePlus, 
  ChevronRight, 
  ChevronDown,
  MoveVertical 
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import ModuleContentEditor from './ModuleContentEditor';

interface ModuleManagerProps {
  courseId: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
  created_at: string;
  updated_at: string;
}

const ModuleManager: React.FC<ModuleManagerProps> = ({ courseId }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = useCoursePermissions(courseId);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [editingModule, setEditingModule] = useState<Partial<Module>>({
    title: '',
    description: '',
    week: 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!courseId) return;
    
    const fetchModules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });
        
        if (error) throw error;
        
        setModules(data || []);
      } catch (error: any) {
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
    
    fetchModules();
  }, [courseId, toast]);
  
  const handleAddModule = () => {
    setSelectedModule(null);
    setEditingModule({
      title: '',
      description: '',
      week: Math.max(0, ...modules.map(m => m.week)) + 1
    });
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleEditModule = (module: Module) => {
    setSelectedModule(module);
    setEditingModule({
      title: module.title,
      description: module.description,
      week: module.week
    });
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingModule(prev => ({
      ...prev,
      [name]: name === 'week' ? parseInt(value) || 1 : value
    }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!editingModule.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!editingModule.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!editingModule.week || editingModule.week < 1) {
      newErrors.week = 'Week must be a positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveModule = async () => {
    if (!validateForm()) return;
    
    try {
      if (selectedModule) {
        // Update existing module
        const { data, error } = await supabase
          .from('modules')
          .update({
            title: editingModule.title,
            description: editingModule.description,
            week: editingModule.week
          })
          .eq('id', selectedModule.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setModules(modules.map(m => m.id === selectedModule.id ? data : m));
        
        toast({
          title: 'Success',
          description: 'Module updated successfully',
        });
      } else {
        // Create new module
        const { data, error } = await supabase
          .from('modules')
          .insert({
            title: editingModule.title,
            description: editingModule.description,
            week: editingModule.week,
            course_id: courseId
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setModules([...modules, data]);
        
        toast({
          title: 'Success',
          description: 'Module created successfully',
        });
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save module',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteModule = async (moduleId: string) => {
    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);
      
      if (error) throw error;
      
      setModules(modules.filter(m => m.id !== moduleId));
      
      toast({
        title: 'Success',
        description: 'Module deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Modules</CardTitle>
          <CardDescription>
            Loading modules...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Progress value={30} className="w-1/2 animate-pulse" />
        </CardContent>
      </Card>
    );
  }
  
  const modulesByWeek = modules.reduce((acc, module) => {
    const week = module.week;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(module);
    return acc;
  }, {} as Record<number, Module[]>);
  
  const sortedWeeks = Object.keys(modulesByWeek)
    .map(Number)
    .sort((a, b) => a - b);
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>
              Organize your course into weekly modules.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={handleAddModule} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Module
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="mb-4">No modules have been created yet.</p>
              {canEdit && (
                <Button onClick={handleAddModule}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Module
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedWeeks.map(week => (
                <div key={week} className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 font-medium">
                    Week {week}
                  </div>
                  <div className="p-2">
                    <Accordion type="single" collapsible className="w-full">
                      {modulesByWeek[week].map(module => (
                        <AccordionItem key={module.id} value={module.id}>
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{module.title}</span>
                              {canEdit && activeModuleId !== module.id && (
                                <div 
                                  className="flex items-center space-x-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditModule(module)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Module</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this module and all its content?
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteModule(module.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4">
                              <p className="text-muted-foreground">
                                {module.description}
                              </p>
                              <div className="border-t pt-4">
                                <ModuleContentEditor 
                                  moduleId={module.id}
                                  onActivate={() => setActiveModuleId(module.id)}
                                  onDeactivate={() => setActiveModuleId(null)}
                                  isActive={activeModuleId === module.id}
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedModule ? 'Edit Module' : 'Create Module'}
            </DialogTitle>
            <DialogDescription>
              {selectedModule 
                ? 'Update the details of this module.' 
                : 'Add a new module to your course.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className={errors.title ? 'text-destructive' : ''}>
                Module Title
              </Label>
              <Input
                id="title"
                name="title"
                value={editingModule.title || ''}
                onChange={handleChange}
                placeholder="e.g., Introduction to the Course"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className={errors.description ? 'text-destructive' : ''}>
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={editingModule.description || ''}
                onChange={handleChange}
                placeholder="Provide a description of this module..."
                className={`min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="week" className={errors.week ? 'text-destructive' : ''}>
                Week Number
              </Label>
              <Input
                id="week"
                name="week"
                type="number"
                min="1"
                value={editingModule.week || 1}
                onChange={handleChange}
                className={errors.week ? 'border-destructive' : ''}
              />
              {errors.week && (
                <p className="text-sm text-destructive">{errors.week}</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModule}>
              {selectedModule ? 'Update Module' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModuleManager;
