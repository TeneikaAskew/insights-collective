
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLessons } from '@/hooks/useLessons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, BookOpen, Clock, Pencil, Trash2, Edit } from 'lucide-react';
// EnhancedModuleContentEditor removed - using Canvas system now

import { createLogger } from '@/utils/logger';

const logger = createLogger('ModuleManager');

interface ModuleManagerProps {
  courseId: string;
  moduleId: string;
  module: any;
  onUpdate: () => void;
}

const ModuleManager = ({ courseId, moduleId, module, onUpdate }: ModuleManagerProps) => {
  const { lessons, loading: lessonsLoading, addLesson, updateLesson, deleteLesson, refetch } = useLessons(moduleId);
  const { toast } = useToast();
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [editLessonOpen, setEditLessonOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    order_num: 1,
    duration: '',
    estimated_duration: 0,
    completion_required: true
  });
  const [moduleData, setModuleData] = useState({
    title: module?.title || '',
    description: module?.description || '',
    week: module?.week || 1
  });

  // Reset form when lessons change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      order_num: lessons.length + 1
    }));
  }, [lessons]);

  const handleAddLesson = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a lesson title",
        variant: "destructive",
      });
      return;
    }

    try {
      const newLesson = await addLesson({
        title: formData.title,
        description: formData.description,
        content: formData.content,
        order_num: formData.order_num,
        duration: formData.duration,
        estimated_duration: formData.estimated_duration,
        completion_required: formData.completion_required,
        completion_criteria: { type: 'all_blocks' },
        module_id: moduleId
      });

      if (newLesson) {
        resetForm();
        setAddLessonOpen(false);
        onUpdate(); // Refresh parent component
        toast({
          title: "Success",
          description: "Lesson added successfully",
        });
      }
    } catch (error) {
      logger.error('Error creating lesson:', error);
      toast({
        title: "Error",
        description: "Failed to create lesson",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      order_num: lessons.length + 1,
      duration: '',
      estimated_duration: 0,
      completion_required: true
    });
  };

  const handleEditLesson = async () => {
    if (!selectedLesson) return;

    const success = await updateLesson(selectedLesson.id, formData);
    if (success) {
      setEditLessonOpen(false);
      setSelectedLesson({ ...selectedLesson, ...formData });
      onUpdate();
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson? All content blocks will be moved back to the module level.')) {
      return;
    }

    try {
      // Move content blocks back to module level before deleting lesson
      await supabase
        .from('content_blocks')
        .update({ lesson_id: null })
        .eq('lesson_id', lessonId);

      const success = await deleteLesson(lessonId);
      if (success && selectedLesson?.id === lessonId) {
        setSelectedLesson(null);
        onUpdate();
      }
    } catch (error) {
      logger.error('Error deleting lesson:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lesson',
        variant: 'destructive',
      });
    }
  };

  const startEditLesson = (lesson: any) => {
    setFormData({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      order_num: lesson.order_num,
      duration: lesson.duration || '',
      estimated_duration: lesson.estimated_duration || 0,
      completion_required: lesson.completion_required
    });
    setSelectedLesson(lesson);
    setEditLessonOpen(true);
  };

  const handleUpdateModule = async () => {
    try {
      const { error } = await supabase
        .from('modules')
        .update(moduleData)
        .eq('id', moduleId);

      if (error) throw error;

      setEditingModule(false);
      onUpdate();
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

  if (lessonsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Module {module?.week}: {module?.title}</CardTitle>
              <CardDescription>{module?.description}</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setEditingModule(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Module
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Course Lessons</h3>
          <p className="text-sm text-muted-foreground">Organize content into structured learning modules</p>
        </div>
        
        <Button onClick={() => { resetForm(); setAddLessonOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lesson
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lessons ({lessons.length})</CardTitle>
              <CardDescription>Select a lesson to manage its content</CardDescription>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No lessons yet.</p>
                  <p className="text-xs mt-1">Create your first lesson to get started.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {lessons.map((lesson) => (
                    <AccordionItem key={lesson.id} value={lesson.id}>
                      <AccordionTrigger
                        className={`hover:bg-muted/50 p-2 rounded text-left ${
                          selectedLesson?.id === lesson.id ? 'bg-primary/10 text-primary' : ''
                        }`}
                        onClick={() => setSelectedLesson(lesson)}
                      >
                        <div className="flex-1">
                          <div className="font-medium">Lesson {lesson.order_num}</div>
                          <div className="text-sm font-normal truncate">{lesson.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {lesson.content_blocks_count || 0} blocks
                            </Badge>
                            {lesson.duration && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {lesson.duration}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-2">
                        <p className="text-sm text-muted-foreground mb-3">{lesson.description}</p>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditLesson(lesson);
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
                              handleDeleteLesson(lesson.id);
                            }}
                            className="text-destructive hover:bg-destructive/10"
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
        
        <div className="lg:col-span-2">
          {selectedLesson ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Lesson {selectedLesson.order_num}: {selectedLesson.title}</CardTitle>
                    <CardDescription>{selectedLesson.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedLesson(null)}>
                      Back to Module Content
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEditLesson(selectedLesson)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Lesson Info
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-6 text-center text-muted-foreground">
                  <p>Content management for lessons is now handled through the Canvas-style content system.</p>
                  <p className="mt-2">Use the module detail page to manage content items.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Module Content</CardTitle>
                <CardDescription>
                  Create content directly at the module level, or organize it into structured lessons using the sidebar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-6 text-center text-muted-foreground">
                  <p>Content management is now handled through the Canvas-style content system.</p>
                  <p className="mt-2">Use the module detail page to manage content items.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Lesson Dialog */}
      <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Lesson</DialogTitle>
            <DialogDescription>
              Create a new lesson for this module.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lesson-title">Lesson Title</Label>
                <Input
                  id="lesson-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter lesson title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lesson-order">Order Number</Label>
                <Input
                  id="lesson-order"
                  type="number"
                  min="1"
                  value={formData.order_num}
                  onChange={(e) => setFormData(prev => ({ ...prev, order_num: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter lesson description"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lesson-content">Lesson Overview</Label>
              <Textarea
                id="lesson-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter lesson overview content"
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLessonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLesson}>
              Create Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog */}
      <Dialog open={editLessonOpen} onOpenChange={setEditLessonOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update lesson details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lesson-title">Lesson Title</Label>
                <Input
                  id="edit-lesson-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-lesson-order">Order Number</Label>
                <Input
                  id="edit-lesson-order"
                  type="number"
                  min="1"
                  value={formData.order_num}
                  onChange={(e) => setFormData(prev => ({ ...prev, order_num: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-lesson-description">Description</Label>
              <Textarea
                id="edit-lesson-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-lesson-content">Lesson Overview</Label>
              <Textarea
                id="edit-lesson-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLessonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLesson}>
              Update Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={editingModule} onOpenChange={setEditingModule}>
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
                value={moduleData.title}
                onChange={(e) => setModuleData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter module title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-module-description">Description</Label>
              <Textarea
                id="edit-module-description"
                value={moduleData.description}
                onChange={(e) => setModuleData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter module description"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingModule(false)}>
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

export default ModuleManager;
