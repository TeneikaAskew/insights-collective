// Canvas-style module manager for instructors
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeHTML } from '@/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, BookOpen, Clock, Settings, ChevronRight, Edit, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { CanvasModuleContent } from '../canvas/CanvasModuleContent';
import { Module } from '@/types/canvas';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
interface CanvasModuleManagerProps {
  courseId: string;
  courseDuration: number;
}
export function CanvasModuleManager({
  courseId,
  courseDuration
}: CanvasModuleManagerProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const {
    toast
  } = useToast();

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
      const {
        data,
        error
      } = await supabase.from('modules').select('*').eq('course_id', courseId).order('position', {
        ascending: true
      }).order('week', {
        ascending: true
      });
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
        const {
          data,
          error
        } = await supabase.from('modules').update({
          title: formData.title,
          description: formData.description,
          week: formData.week,
          published: formData.published,
          updated_at: new Date().toISOString()
        }).eq('id', editingModule.id).select().single();
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
        const {
          data,
          error
        } = await supabase.from('modules').insert({
          course_id: courseId,
          title: formData.title,
          description: formData.description,
          week: formData.week,
          published: formData.published,
          position: modules.length
        }).select().single();
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
    if (!(await confirm({ title: 'Delete module?', description: 'This also deletes all its content.', destructive: true, confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from('modules').delete().eq('id', moduleId);
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
    setModules(items);

    // Update positions in database
    try {
      const updates = items.map((item, index) => ({
        id: item.id,
        position: index
      }));
      for (const update of updates) {
        await supabase.from('modules').update({
          position: update.position
        }).eq('id', update.id);
      }
      toast({
        title: 'Modules reordered',
        description: 'Module order has been updated.'
      });
    } catch (error: any) {
      toast({
        title: 'Error reordering modules',
        description: error.message,
        variant: 'destructive'
      });
      loadModules(); // Reload on error
    }
  };
  const toggleModulePublished = async (module: Module) => {
    try {
      const newPublishedState = !module.published;
      const {
        data,
        error
      } = await supabase.from('modules').update({
        published: newPublishedState,
        updated_at: new Date().toISOString()
      }).eq('id', module.id).select().single();
      if (error) throw error;

      // Update selectedModule if it's the one being toggled
      if (selectedModule?.id === module.id) {
        setSelectedModule(data);
      }
      toast({
        title: newPublishedState ? 'Module published' : 'Module unpublished',
        description: newPublishedState ? 'This module is now visible to students.' : 'This module is now hidden from students.'
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
  const openEditDialog = (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description || '',
      week: module.week,
      published: module.published !== false
    });
    setShowAddDialog(true);
  };
  const resetForm = () => {
    setEditingModule(null);
    setFormData({
      title: '',
      description: '',
      week: 1,
      published: true
    });
  };
  if (loading) {
    return <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="space-y-4">
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

      {/* Empty State or Side-by-Side Layout */}
      {modules.length === 0 ? <Card>
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
        </Card> : <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Module List (2/5 width) */}
          <div className="lg:col-span-2">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="modules">
                {provided => <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {modules.map((module, index) => <Draggable key={module.id} draggableId={module.id} index={index}>
                        {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? 'opacity-50' : ''}>
                            <div className={`group bg-card rounded-lg border transition-all cursor-pointer ${selectedModule?.id === module.id ? 'border-primary shadow-md bg-primary/5' : 'border-border hover:border-primary/50 hover:shadow-sm'}`} onClick={() => setSelectedModule(module)}>
                              <div className="p-3">
                                <div className="flex items-start gap-2">
                                  {/* Drag Handle */}
                                  <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Drag to reorder" onClick={e => e.stopPropagation()}>
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>

                                  {/* Module Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="secondary" className="text-xs font-medium px-1.5 py-0">
                                        Week {module.week}
                                      </Badge>
                                      {module.published === false ? <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-muted-foreground/30 px-1.5 py-0">
                                          <EyeOff className="h-2.5 w-2.5 mr-1" />
                                          Unpublished
                                        </Badge> : <Badge className="text-xs font-normal bg-green-600 hover:bg-green-700 px-1.5 py-0">
                                          <Eye className="h-2.5 w-2.5 mr-1" />
                                          Published
                                        </Badge>}
                                    </div>
                                    <h4 className="font-semibold text-sm mb-0.5 line-clamp-2 text-left">{module.title}</h4>
                                    {module.description && <div className="text-xs text-muted-foreground line-clamp-1 prose-sm" dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(module.description)
                          }} />}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                            e.stopPropagation();
                            toggleModulePublished(module);
                          }} title={module.published === false ? 'Publish' : 'Unpublish'}>
                                      {module.published === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                            e.stopPropagation();
                            openEditDialog(module);
                          }} title="Edit">
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={e => {
                            e.stopPropagation();
                            handleDeleteModule(module.id);
                          }} title="Delete">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>}
                      </Draggable>)}
                    {provided.placeholder}
                  </div>}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Right Column: Selected Module Content (3/5 width) */}
          <div className="lg:col-span-3">
            {selectedModule ? <div className="sticky top-4">
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

                {selectedModule.description && <div className="text-sm text-muted-foreground mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{
            __html: sanitizeHTML(selectedModule.description)
          }} />}

                <div className="bg-muted/30 rounded-lg border p-6">
                  
                  <CanvasModuleContent moduleId={selectedModule.id} courseId={courseId} isInstructor={true} />
                </div>
              </div> : <Card>
                <CardContent className="text-center py-12">
                  <ChevronRight className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a module</h3>
                  <p className="text-muted-foreground">
                    Click on a module from the list to view and manage its content.
                  </p>
                </CardContent>
              </Card>}
          </div>
        </div>}

      {/* Add/Edit Module Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => {
      setShowAddDialog(open);
      if (!open) resetForm();
    }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModule ? 'Edit Module' : 'Create New Module'}
            </DialogTitle>
            <DialogDescription>
              {editingModule ? 'Update the module information below.' : 'Add a new module to organize your course content.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="week">Week Number</Label>
              <Input id="week" type="number" min="1" max={courseDuration} value={formData.week} onChange={e => setFormData({
              ...formData,
              week: parseInt(e.target.value) || 1
            })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Module Title</Label>
              <Input id="title" value={formData.title} onChange={e => setFormData({
              ...formData,
              title: e.target.value
            })} placeholder="e.g., Introduction to Course Concepts" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Module Overview (Optional)</Label>
              <UnifiedCanvasEditor content={formData.description} onChange={value => setFormData({
              ...formData,
              description: value
            })} placeholder="Provide an overview of what students will learn in this module..." minHeight="200px" showAdvancedFeatures={false} />
            </div>

            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox id="published" checked={formData.published} onCheckedChange={checked => setFormData({
              ...formData,
              published: checked as boolean
            })} />
              <div className="space-y-1">
                <Label htmlFor="published" className="cursor-pointer font-medium">
                  Publish this module
                </Label>
                <p className="text-sm text-muted-foreground">
                  Students will be able to see and access this module
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModule} disabled={!formData.title.trim()}>
              {editingModule ? 'Update Module' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}