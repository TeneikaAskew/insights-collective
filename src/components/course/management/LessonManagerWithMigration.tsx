import React, { useState } from 'react';
import { useLessons } from '@/hooks/useLessons';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Edit, Trash2, Clock } from 'lucide-react';

interface LessonManagerWithMigrationProps {
  moduleId: string;
}

const LessonManagerWithMigration = ({ moduleId }: LessonManagerWithMigrationProps) => {
  const { toast } = useToast();
  const { lessons, loading, addLesson, updateLesson, deleteLesson, refetch } = useLessons(moduleId);
  
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [editLessonOpen, setEditLessonOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    duration: '',
    estimated_duration: 0,
    completion_required: true,
    order_num: 1
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      duration: '',
      estimated_duration: 0,
      completion_required: true,
      order_num: lessons.length + 1
    });
  };

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
        content: formData.content || '',
        duration: formData.duration,
        estimated_duration: formData.estimated_duration,
        completion_required: formData.completion_required,
        order_num: formData.order_num,
        completion_criteria: { type: 'all_blocks' },
        module_id: moduleId
      });

      if (newLesson) {
        resetForm();
        setAddLessonOpen(false);
        refetch(); // Refresh the lessons list
      }
    } catch (error) {
      console.error('Error creating lesson:', error);
    }
  };

  const handleEditLesson = async () => {
    if (!selectedLesson || !formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a lesson title",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateLesson(selectedLesson.id, {
        title: formData.title,
        description: formData.description,
        content: formData.content,
        duration: formData.duration,
        estimated_duration: formData.estimated_duration,
        completion_required: formData.completion_required,
        order_num: formData.order_num
      });

      setEditLessonOpen(false);
      setSelectedLesson(null);
      resetForm();
    } catch (error) {
      console.error('Error updating lesson:', error);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson? All content will be permanently removed.')) {
      return;
    }

    try {
      await deleteLesson(lessonId);
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  const startEditLesson = (lesson: any) => {
    setSelectedLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description || '',
      content: lesson.content || '',
      duration: lesson.duration || '',
      estimated_duration: lesson.estimated_duration || 0,
      completion_required: lesson.completion_required ?? true,
      order_num: lesson.order_num
    });
    setEditLessonOpen(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Lessons</h3>
          <p className="text-sm text-muted-foreground">Create and organize lessons for this module</p>
        </div>
        
        <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setAddLessonOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lesson
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                  <Label htmlFor="lesson-order">Order</Label>
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
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lesson-content">Content</Label>
                <Textarea
                  id="lesson-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter lesson content"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lesson-duration">Duration (text)</Label>
                  <Input
                    id="lesson-duration"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 30 minutes"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lesson-estimated-duration">Estimated Duration (minutes)</Label>
                  <Input
                    id="lesson-estimated-duration"
                    type="number"
                    min="0"
                    value={formData.estimated_duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: parseInt(e.target.value) }))}
                  />
                </div>
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
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No lessons yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first lesson to start building your module content
            </p>
            <Button onClick={() => { resetForm(); setAddLessonOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Lesson
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lessons.map((lesson, index) => (
            <Card key={lesson.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Lesson {lesson.order_num}
                      </span>
                      {lesson.duration && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{lesson.duration}</span>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-lg">{lesson.title}</CardTitle>
                    {lesson.description && (
                      <CardDescription className="mt-1">
                        {lesson.description}
                      </CardDescription>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditLesson(lesson)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteLesson(lesson.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {lesson.content && (
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
                    {lesson.content.substring(0, 200)}
                    {lesson.content.length > 200 && '...'}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Lesson Dialog */}
      <Dialog open={editLessonOpen} onOpenChange={setEditLessonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update the lesson details.
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
                  placeholder="Enter lesson title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-lesson-order">Order</Label>
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
                placeholder="Enter lesson description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-lesson-content">Content</Label>
              <Textarea
                id="edit-lesson-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter lesson content"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lesson-duration">Duration (text)</Label>
                <Input
                  id="edit-lesson-duration"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 30 minutes"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-lesson-estimated-duration">Estimated Duration (minutes)</Label>
                <Input
                  id="edit-lesson-estimated-duration"
                  type="number"
                  min="0"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: parseInt(e.target.value) }))}
                />
              </div>
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
    </div>
  );
};

export default LessonManagerWithMigration;
