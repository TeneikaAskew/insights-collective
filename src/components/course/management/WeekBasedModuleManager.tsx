import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  rectIntersection,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Edit, Trash2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import ModuleManager from './ModuleManager';

import { createLogger } from '@/utils/logger';

const logger = createLogger('WeekBasedModuleManager');

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
}

interface WeekBasedModuleManagerProps {
  courseId: string;
  courseDuration: number;
}

function DroppableColumn({ 
  id, 
  children, 
  className 
}: { 
  id: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
    >
      {children}
    </div>
  );
}

function ModuleCard({ module, onEdit, onDelete, onSelect }: { module: Module; onEdit: (module: Module) => void; onDelete: (id: string) => void; onSelect: (module: Module) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-background shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(module)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing flex-shrink-0"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-semibold text-sm leading-tight truncate">{module.title}</h4>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(module)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(module.id)}
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {module.description && (
              <p className="text-xs text-muted-foreground truncate">
                {module.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const WeekBasedModuleManager = ({ courseId, courseDuration }: WeekBasedModuleManagerProps) => {
  const { toast } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [editModuleOpen, setEditModuleOpen] = useState(false);
  const [draggingModule, setDraggingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    week: 1
  });

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  // Fetch modules for the course
  useEffect(() => {
    fetchModules();
  }, [courseId]);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('week', { ascending: true });

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      logger.error('Error fetching modules:', error);
      toast({
        title: "Error",
        description: "Failed to load modules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a module title",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: formData.title,
          description: formData.description,
          week: formData.week,
          course_id: courseId
        })
        .select()
        .single();

      if (error) throw error;

      setModules(prev => [...prev, data]);
      resetForm();
      setAddModuleOpen(false);
      toast({
        title: "Success",
        description: "Module added successfully",
      });
    } catch (error) {
      logger.error('Error creating module:', error);
      toast({
        title: "Error",
        description: "Failed to create module",
        variant: "destructive",
      });
    }
  };

  const handleUpdateModule = async () => {
    if (!selectedModule || !formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a module title",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('modules')
        .update({
          title: formData.title,
          description: formData.description,
          week: formData.week
        })
        .eq('id', selectedModule.id)
        .select()
        .single();

      if (error) throw error;

      setModules(prev => prev.map(m => m.id === selectedModule.id ? data : m));
      setSelectedModule(null);
      setEditModuleOpen(false);
      toast({
        title: "Success",
        description: "Module updated successfully",
      });
    } catch (error) {
      logger.error('Error updating module:', error);
      toast({
        title: "Error",
        description: "Failed to update module",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      week: 1
    });
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module? All content will be permanently removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      setModules(prev => prev.filter(m => m.id !== moduleId));
      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
      }
      toast({
        title: "Success",
        description: "Module deleted successfully",
      });
    } catch (error) {
      logger.error('Error deleting module:', error);
      toast({
        title: "Error",
        description: "Failed to delete module",
        variant: "destructive",
      });
    }
  };

  const handleEditModule = (module: Module) => {
    setSelectedModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      week: module.week
    });
    setEditModuleOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const moduleId = active.id as string;
    const module = modules.find(m => m.id === moduleId);
    
    if (module) {
      setDraggingModule(module);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setDraggingModule(null);
    
    if (!over || !active) {
      return;
    }
    
    const moduleId = active.id as string;
    const newWeek = parseInt(over.id as string);
    
    // Validate that the new week is valid
    if (newWeek < 1 || newWeek > courseDuration) {
      return;
    }
    
    // Only update if the week actually changed
    const module = modules.find(m => m.id === moduleId);
    if (module && module.week !== newWeek) {
      // Optimistically update local state
      setModules(prevModules => 
        prevModules.map(m => 
          m.id === moduleId 
            ? { ...m, week: newWeek }
            : m
        )
      );
      
      // Update in database
      updateModuleWeek(moduleId, newWeek);
    }
  };

  const updateModuleWeek = async (moduleId: string, newWeek: number) => {
    try {
      const { error } = await supabase
        .from('modules')
        .update({ week: newWeek })
        .eq('id', moduleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Module moved to week ${newWeek}`,
      });
    } catch (error) {
      logger.error('Error updating module week:', error);
      toast({
        title: "Error",
        description: "Failed to update module week",
        variant: "destructive",
      });
      // Revert local state on error
      fetchModules();
    }
  };

  const getModulesByWeek = (week: number) => {
    return modules.filter(module => module.week === week);
  };

  const generateWeekOptions = () => {
    const options = [];
    for (let i = 1; i <= courseDuration; i++) {
      options.push(
        <SelectItem key={i} value={i.toString()}>Week {i}</SelectItem>
      );
    }
    return options;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: courseDuration }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Course Modules</h3>
          <p className="text-sm text-muted-foreground">
            Organize your course content by weeks. Drag modules between weeks to reorder them.
          </p>
        </div>
        
        <Button onClick={() => { resetForm(); setAddModuleOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={rectIntersection}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: courseDuration }).map((_, index) => {
            const week = index + 1;
            const weekModules = getModulesByWeek(week);
            
            return (
              <DroppableColumn
                key={week}
                id={week.toString()}
                className="rounded-lg border p-4 bg-muted/30 min-h-[200px] transition-all duration-200"
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-sm">Week {week}</h4>
                  <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    {weekModules.length}
                  </span>
                </div>
                
                <div className="space-y-2 min-h-[150px]">
                  <SortableContext
                    items={weekModules.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {weekModules.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        onEdit={handleEditModule}
                        onDelete={handleDeleteModule}
                        onSelect={setSelectedModule}
                      />
                    ))}
                  </SortableContext>
                  
                  {weekModules.length === 0 && (
                    <div className="border border-dashed rounded-lg p-4 text-center text-muted-foreground text-sm h-24 flex items-center justify-center">
                      Drop modules here
                    </div>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
        
        {draggingModule && createPortal(
          <DragOverlay>
            <div className="opacity-80 rotate-1 scale-105">
              <Card className="bg-background shadow-lg border-2 border-primary">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{draggingModule.title}</h4>
                      {draggingModule.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {draggingModule.description.length > 50 
                            ? draggingModule.description.substring(0, 50) + '...' 
                            : draggingModule.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {/* Module Details Section */}
      {selectedModule && (
        <div className="mt-8">
          <ModuleManager 
            courseId={courseId}
            moduleId={selectedModule.id}
            module={selectedModule}
            onUpdate={fetchModules}
          />
        </div>
      )}

      {/* Add Module Dialog */}
      <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Module</DialogTitle>
            <DialogDescription>
              Create a new module for this course.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="module-title">Module Title</Label>
              <Input
                id="module-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter module title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="module-week">Week</Label>
              <Select 
                value={formData.week.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, week: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateWeekOptions()}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="module-description">Description</Label>
              <Textarea
                id="module-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter module description"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModuleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddModule}>
              Create Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={editModuleOpen} onOpenChange={setEditModuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
            <DialogDescription>
              Update module details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-module-title">Module Title</Label>
              <Input
                id="edit-module-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter module title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-module-week">Week</Label>
              <Select 
                value={formData.week.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, week: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateWeekOptions()}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-module-description">Description</Label>
              <Textarea
                id="edit-module-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter module description"
                rows={3}
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
  );
};

export default WeekBasedModuleManager;