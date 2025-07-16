import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  Active,
  Over,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  GripVertical, 
  ChevronDown, 
  ChevronRight,
  BookOpen,
  FileText,
  ClipboardList,
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Lesson {
  id: string;
  title: string;
  type: 'lesson' | 'assignment' | 'quiz';
  order_index: number;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  order_index: number;
  lessons: Lesson[];
}

interface ModuleDragDropOrganizerProps {
  courseId: string;
  modules: Module[];
  onSave: (modules: Module[]) => Promise<void>;
  canEdit: boolean;
}

function DraggableModule({ 
  module, 
  isOpen, 
  onToggle,
  isDragging 
}: { 
  module: Module; 
  isOpen: boolean;
  onToggle: () => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-4",
        isDragging && "opacity-50"
      )}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                {...attributes}
                {...listeners}
                className="cursor-move touch-none"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{module.title}</CardTitle>
                {module.description && (
                  <CardDescription className="mt-1">
                    {module.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {module.lessons.length} items
              </Badge>
              <CollapsibleTrigger asChild onClick={onToggle}>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <SortableContext
                items={module.lessons.map(l => `${module.id}-${l.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {module.lessons.map((lesson) => (
                  <DraggableLesson
                    key={lesson.id}
                    lesson={lesson}
                    moduleId={module.id}
                  />
                ))}
              </SortableContext>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </div>
  );
}

function DraggableLesson({ 
  lesson, 
  moduleId,
  isDragging 
}: { 
  lesson: Lesson; 
  moduleId: string;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `${moduleId}-${lesson.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getIcon = () => {
    switch (lesson.type) {
      case 'assignment':
        return <FileText className="h-4 w-4" />;
      case 'quiz':
        return <ClipboardList className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-muted/50 rounded-lg",
        isDragging && "opacity-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-move touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </div>
      <div className="flex items-center gap-2 flex-1">
        {getIcon()}
        <span className="text-sm font-medium">{lesson.title}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {lesson.type}
      </Badge>
    </div>
  );
}

export const ModuleDragDropOrganizer: React.FC<ModuleDragDropOrganizerProps> = ({
  courseId,
  modules: initialModules,
  onSave,
  canEdit,
}) => {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're moving modules
    const activeModuleIndex = modules.findIndex(m => m.id === activeId);
    const overModuleIndex = modules.findIndex(m => m.id === overId);

    if (activeModuleIndex !== -1 && overModuleIndex !== -1) {
      // Moving modules
      setModules((items) => {
        const newModules = arrayMove(items, activeModuleIndex, overModuleIndex);
        // Update order indices
        return newModules.map((mod, index) => ({
          ...mod,
          order_index: index,
        }));
      });
      setHasChanges(true);
    } else {
      // Moving lessons
      const [activeModuleId, activeLessonId] = activeId.split('-');
      const [overModuleId, overLessonId] = overId.split('-');

      if (activeModuleId && activeLessonId && overModuleId && overLessonId) {
        setModules((currentModules) => {
          const newModules = [...currentModules];
          
          const sourceModule = newModules.find(m => m.id === activeModuleId);
          const targetModule = newModules.find(m => m.id === overModuleId);
          
          if (!sourceModule || !targetModule) return currentModules;

          const sourceLessonIndex = sourceModule.lessons.findIndex(l => l.id === activeLessonId);
          const targetLessonIndex = targetModule.lessons.findIndex(l => l.id === overLessonId);

          if (sourceLessonIndex === -1 || targetLessonIndex === -1) return currentModules;

          if (activeModuleId === overModuleId) {
            // Moving within the same module
            sourceModule.lessons = arrayMove(
              sourceModule.lessons,
              sourceLessonIndex,
              targetLessonIndex
            );
          } else {
            // Moving between modules
            const [movedLesson] = sourceModule.lessons.splice(sourceLessonIndex, 1);
            targetModule.lessons.splice(targetLessonIndex, 0, movedLesson);
          }

          // Update lesson order indices
          newModules.forEach(module => {
            module.lessons = module.lessons.map((lesson, index) => ({
              ...lesson,
              order_index: index,
            }));
          });

          return newModules;
        });
        setHasChanges(true);
      }
    }

    setActiveId(null);
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(modules);
      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Module order saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save module order',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to reorder course content.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course Content Organizer</CardTitle>
              <CardDescription>
                Drag and drop modules and lessons to reorder them
              </CardDescription>
            </div>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {modules.map((module) => (
            <Collapsible
              key={module.id}
              open={openModules.has(module.id)}
            >
              <DraggableModule
                module={module}
                isOpen={openModules.has(module.id)}
                onToggle={() => toggleModule(module.id)}
                isDragging={activeId === module.id}
              />
            </Collapsible>
          ))}
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-75">
              {/* Render preview of dragged item */}
              {modules.find(m => m.id === activeId) ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {modules.find(m => m.id === activeId)?.title}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ) : (
                <div className="p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Moving lesson...</span>
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};