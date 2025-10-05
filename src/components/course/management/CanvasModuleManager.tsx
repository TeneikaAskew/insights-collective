// Canvas-style module manager for instructors
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, BookOpen, Clock, Settings, ChevronRight, Edit, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { CanvasModuleContent } from '../canvas/CanvasModuleContent';
import { Module } from '@/types/canvas';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
    week: 1,
    published: true
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
        .order('position', { ascending: true })
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
            published: formData.published,
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
            published: formData.published,
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

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(modules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for responsive UI
    setModules(items);

    // Update positions in database
    try {
      const updates = items.map((module, index) => ({
        id: module.id,
        position: index,
        week: index + 1 // Update week numbers based on position
      }));

      // Update each module's position
      for (const update of updates) {
        const { error } = await supabase
          .from('modules')
          .update({ position: update.position, week: update.week })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Modules reordered',
        description: 'Module order has been updated successfully.'
      });
    } catch (error: any) {
      toast({
        title: 'Error reordering modules',
        description: error.message,
        variant: 'destructive'
      });
      // Reload to get correct order
      loadModules();
    }
  };

  const openEditDialog = (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description || '',
      week: module.week,
      published: module.published ?? true
    });
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      week: modules.length + 1,
      published: true
    });
    setEditingModule(null);
  };

  const toggleModulePublished = async (module: Module) => {
    try {
      const newPublishedStatus = !module.published;
      const { error } = await supabase
        .from('modules')
        .update({ published: newPublishedStatus, updated_at: new Date().toISOString() })
        .eq('id', module.id);

      if (error) throw error;

      toast({
        title: newPublishedStatus ? 'Module published' : 'Module unpublished',
        description: newPublishedStatus
          ? 'Students can now see this module'
          : 'Module is now hidden from students'
      });

      loadModules();
    } catch (error: any) {
      toast({
        title: 'Error updating module',
        description: error.message,
        variant: 'destructive'
      });
    }
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
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="modules">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {modules.map((module, index) => (
                      <Draggable 
                        key={module.id} 
                        draggableId={module.id} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? 'opacity-50' : ''}
                          >
                            <Card 
                              className={`transition-all hover:shadow-md ${
                                selectedModule?.id === module.id ? 'ring-2 ring-primary' : ''
                              }`}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => setSelectedModule(module)}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="flex gap-2 mb-2">
                                          <Badge variant="secondary">
                                            Week {module.week}
                                          </Badge>
                                          {module.published === false ? (
                                            <Badge variant="outline" className="text-muted-foreground">
                                              <EyeOff className="h-3 w-3 mr-1" />
                                              Unpublished
                                            </Badge>
                                          ) : (
                                            <Badge variant="default" className="bg-green-600">
                                              <Eye className="h-3 w-3 mr-1" />
                                              Published
                                            </Badge>
                                          )}
                                        </div>
                                        <CardTitle className="text-lg">{module.title}</CardTitle>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleModulePublished(module);
                                          }}
                                          title={module.published === false ? 'Publish module' : 'Unpublish module'}
                                        >
                                          {module.published === false ? (
                                            <Eye className="h-4 w-4" />
                                          ) : (
                                            <EyeOff className="h-4 w-4" />
                                          )}
                                        </Button>
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
                                  </div>
                                </div>
                                {module.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2 ml-8">
                                    {module.description}
                                  </p>
                                )}
                              </CardHeader>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
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

            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox
                id="published"
                checked={formData.published}
                onCheckedChange={(checked) => setFormData({ ...formData, published: checked as boolean })}
              />
              <div className="space-y-1">
                <Label htmlFor="published" className="cursor-pointer font-medium">
                  Publish this module
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formData.published
                    ? 'Students can see this module and its content'
                    : 'Module will be hidden from students until published'}
                </p>
              </div>
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