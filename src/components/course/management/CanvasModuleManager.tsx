// Canvas-style module manager for instructors
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, BookOpen, Clock, Settings, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { CanvasModuleContent } from '../canvas/CanvasModuleContent';
import { Module } from '@/types/canvas';

interface CanvasModuleManagerProps {
  courseId: string;
  courseDuration: number;
}

export function CanvasModuleManager({ courseId, courseDuration }: CanvasModuleManagerProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    week: 1
  });

  useEffect(() => {
    loadModules();
  }, [courseId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('week', { ascending: true });

      if (error) throw error;
      
      setModules(data || []);
      
      // Auto-select first module if none selected
      if (data && data.length > 0 && !selectedModule) {
        setSelectedModule(data[0]);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading modules',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModule = async () => {
    try {
      if (editingModule) {
        // Update existing module
        const { error } = await supabase
          .from('modules')
          .update({
            title: formData.title,
            description: formData.description,
            week: formData.week,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingModule.id);

        if (error) throw error;

        toast({
          title: 'Module updated',
          description: 'Your changes have been saved.'
        });
      } else {
        // Create new module
        const { data, error } = await supabase
          .from('modules')
          .insert({
            course_id: courseId,
            title: formData.title,
            description: formData.description,
            week: formData.week,
            position: modules.length
          })
          .select()
          .single();

        if (error) throw error;

        // Select the new module
        setSelectedModule(data);

        toast({
          title: 'Module created',
          description: 'You can now add content to this module.'
        });
      }

      setShowAddDialog(false);
      resetForm();
      loadModules();
    } catch (error: any) {
      toast({
        title: 'Error saving module',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module and all its content?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      toast({
        title: 'Module deleted',
        description: 'The module and its content have been removed.'
      });

      // Reset selection if deleted module was selected
      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
      }

      loadModules();
    } catch (error: any) {
      toast({
        title: 'Error deleting module',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description || '',
      week: module.week
    });
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      week: modules.length + 1
    });
    setEditingModule(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Course Modules</CardTitle>
              <CardDescription>
                Organize your course content into weekly modules
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Module
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No modules yet. Create your first module to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((module) => (
                <Card 
                  key={module.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedModule?.id === module.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedModule(module)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Week {module.week}
                        </Badge>
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(module);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(module.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {module.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {module.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Module Content */}
      {selectedModule && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Week {selectedModule.week}</Badge>
                </div>
                <CardTitle>{selectedModule.title}</CardTitle>
                {selectedModule.description && (
                  <CardDescription className="mt-2">
                    {selectedModule.description}
                  </CardDescription>
                )}
              </div>
              <Button variant="outline" onClick={() => openEditDialog(selectedModule)}>
                <Settings className="h-4 w-4 mr-2" />
                Module Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CanvasModuleContent
              moduleId={selectedModule.id}
              courseId={courseId}
              isInstructor={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Module Dialog */}
      <Dialog 
        open={showAddDialog} 
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModule ? 'Edit Module' : 'Create New Module'}
            </DialogTitle>
            <DialogDescription>
              {editingModule 
                ? 'Update the module information below.'
                : 'Add a new module to organize your course content.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="week">Week Number</Label>
              <Input
                id="week"
                type="number"
                min="1"
                max={courseDuration}
                value={formData.week}
                onChange={(e) => setFormData({ ...formData, week: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Module Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Introduction to Course Concepts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Module Overview (Optional)</Label>
              <UnifiedCanvasEditor
                content={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Provide an overview of what students will learn in this module..."
                minHeight="200px"
                showAdvancedFeatures={false}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModule}>
              {editingModule ? 'Save Changes' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CanvasModuleManager;