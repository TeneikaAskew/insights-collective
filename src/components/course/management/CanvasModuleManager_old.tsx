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
        const { data, error } = await supabase
          .from('modules')
          .update({
            title: formData.title,
            description: formData.description,
            week: formData.week,
            published: formData.published,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingModule.id)
          .select()
          .single();

        if (error) throw error;

        // Update selectedModule if it's the one being edited
        if (selectedModule?.id === editingModule.id) {
          setSelectedModule(data);
        }

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
      await loadModules();
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Course Modules</h2>
          <p className="text-muted-foreground">
            Organize your course content into weekly modules
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      {/* Two Column Layout: Module List (Left) | Module Content (Right) */}
      {modules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No modules yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first module to get started organizing your course content.
            </p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create First Module
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="modules">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
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
                        <div
                          className={`group bg-card rounded-lg border transition-all ${
                            selectedModule?.id === module.id
                              ? 'border-primary shadow-md'
                              : 'border-border hover:border-primary/50 hover:shadow-sm'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              {/* Drag Handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="mt-1 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>

                              {/* Module Content */}
                              <div
                                className="flex-1 cursor-pointer min-w-0"
                                onClick={() => setSelectedModule(module)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Badge
                                        variant="secondary"
                                        className="text-xs font-medium px-2 py-0.5"
                                      >
                                        Week {module.week}
                                      </Badge>
                                      {module.published === false ? (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-normal text-muted-foreground border-muted-foreground/30"
                                        >
                                          <EyeOff className="h-3 w-3 mr-1" />
                                          Unpublished
                                        </Badge>
                                      ) : (
                                        <Badge
                                          className="text-xs font-normal bg-green-600 hover:bg-green-700"
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          Published
                                        </Badge>
                                      )}
                                    </div>
                                    <h3 className="font-semibold text-base mb-1">{module.title}</h3>
                                    {module.description && (
                                      <div
                                        className="text-sm text-muted-foreground line-clamp-2 prose-sm"
                                        dangerouslySetInnerHTML={{ __html: module.description }}
                                      />
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
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
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(module);
                                      }}
                                      title="Edit module"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteModule(module.id);
                                      }}
                                      title="Delete module"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
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

      {/* Selected Module Content */}
      {selectedModule && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                Week {selectedModule.week}
              </Badge>
              <h3 className="text-xl font-semibold">{selectedModule.title}</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedModule)}>
              <Settings className="h-4 w-4 mr-2" />
              Module Settings
            </Button>
          </div>

          {selectedModule.description && (
            <div
              className="text-sm text-muted-foreground mb-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedModule.description }}
            />
          )}

          <div className="bg-muted/30 rounded-lg border p-6">
            <h4 className="text-sm font-medium mb-4 uppercase tracking-wide text-muted-foreground">
              Module Content
            </h4>
            <CanvasModuleContent
              moduleId={selectedModule.id}
              courseId={courseId}
              isInstructor={true}
            />
          </div>
        </div>
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