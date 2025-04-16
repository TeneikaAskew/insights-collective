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
  MoveVertical,
  Wand2 
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
import AIContentGenerator from '@/components/ai/AIContentGenerator';

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
  const [moduleContents, setModuleContents] = useState<any[]>([]);
  
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
  
  useEffect(() => {
    if (!activeModuleId) {
      setModuleContents([]);
      return;
    }
    
    const fetchModuleContents = async () => {
      try {
        const { data, error } = await supabase
          .from('module_content')
          .select('*')
          .eq('module_id', activeModuleId)
          .order('position', { ascending: true });
        
        if (error) throw error;
        setModuleContents(data || []);
      } catch (error) {
        console.error('Error fetching module contents:', error);
        toast({
          title: 'Error',
          description: 'Failed to load module contents',
          variant: 'destructive',
        });
      }
    };
    
    fetchModuleContents();
  }, [activeModuleId, toast]);
  
  const handleAddContent = async (content: any) => {
    if (!activeModuleId) return null;
    
    try {
      const { data, error } = await supabase
        .from('module_content')
        .insert(content)
        .select()
        .single();
      
      if (error) throw error;
      
      setModuleContents([...moduleContents, data]);
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: 'Failed to add content',
        variant: 'destructive',
      });
      throw error;
    }
  };
  
  const handleUpdateContent = async (contentId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('module_content')
        .update(updates)
        .eq('id', contentId)
        .select()
        .single();
      
      if (error) throw error;
      
      setModuleContents(moduleContents.map(content => 
        content.id === contentId ? data : content
      ));
      
      toast({
        title: 'Success',
        description: 'Content updated successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const handleDeleteContent = async (contentId: string) => {
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', contentId);
      
      if (error) throw error;
      
      setModuleContents(moduleContents.filter(content => content.id !== contentId));
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete content',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  const handleAIContentGenerated = (content: string) => {
    setEditingModule(prev => ({
      ...prev,
      description: content
    }));
  };
  
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>
              Manage the modules and content for this course
            </CardDescription>
          </div>
          <Button onClick={handleAddModule}>
            <Plus className="h-4 w-4 mr-2" />
            Add Module
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading modules...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="py-8 text-center border rounded-md">
              <p className="text-muted-foreground">No modules yet. Create your first module to get started.</p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={activeModuleId || undefined}
              onValueChange={setActiveModuleId}
            >
              {modules.map((module) => (
                <AccordionItem value={module.id} key={module.id}>
                  <AccordionTrigger className="hover:bg-muted px-4 rounded-md">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-2">Week {module.week}:</span>
                        <span>{module.title}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditModule(module);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Module</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this module? This action cannot be undone.
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
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      <div className="pt-2">
                        <h4 className="text-sm font-semibold">Description</h4>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                      
                      {activeModuleId === module.id && (
                        <ModuleContentEditor 
                          moduleId={module.id} 
                          contents={moduleContents}
                          onAddContent={handleAddContent}
                          onUpdateContent={handleUpdateContent}
                          onDeleteContent={handleDeleteContent}
                        />
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedModule ? 'Edit Module' : 'Add Module'}
            </DialogTitle>
            <DialogDescription>
              {selectedModule 
                ? 'Update the module details.' 
                : 'Create a new module for this course.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Module Title</Label>
              <Input
                id="title"
                name="title"
                value={editingModule.title || ''}
                onChange={handleChange}
                placeholder="Introduction to the Course"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="description">Module Description</Label>
                <AIContentGenerator 
                  onContentGenerated={handleAIContentGenerated}
                  contextType="module"
                />
              </div>
              <Textarea
                id="description"
                name="description"
                value={editingModule.description || ''}
                onChange={handleChange}
                placeholder="Describe what students will learn in this module..."
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="week">Week Number</Label>
              <Input
                id="week"
                name="week"
                type="number"
                min="1"
                value={editingModule.week || 1}
                onChange={handleChange}
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
              {selectedModule ? 'Update Module' : 'Add Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleManager;
