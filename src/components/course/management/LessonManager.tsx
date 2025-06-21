// ABOUTME: Component for managing lessons within a module, including add/edit/delete operations
// ABOUTME: Provides lesson selection and CRUD interface for lesson management

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, CheckCircle, Clock } from 'lucide-react';
import { useLessons, Lesson } from '@/hooks/useLessons';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LessonManagerProps {
  moduleId: string;
  onLessonSelect: (lesson: Lesson | null) => void;
  selectedLesson: Lesson | null;
}

const LessonManager: React.FC<LessonManagerProps> = ({
  moduleId,
  onLessonSelect,
  selectedLesson
}) => {
  const { lessons, loading, addLesson, updateLesson, deleteLesson } = useLessons(moduleId);
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newLessonData, setNewLessonData] = useState({
    title: '',
    description: '',
    content: '',
    duration: '',
    completion_required: true
  });

  const handleAddLesson = async () => {
    if (!newLessonData.title) return;

    const lessonData = {
      ...newLessonData,
      module_id: moduleId,
      order_num: lessons.length + 1,
      completion_criteria: { type: 'all_blocks' },
      content_blocks_count: 0,
      estimated_duration: 0
    };

    const result = await addLesson(lessonData);
    if (result) {
      setNewLessonData({
        title: '',
        description: '',
        content: '',
        duration: '',
        completion_required: true
      });
      setAddDialogOpen(false);
    }
  };

  const handleEditLesson = async () => {
    if (!selectedLesson || !newLessonData.title) return;

    const result = await updateLesson(selectedLesson.id, newLessonData);
    if (result) {
      setEditDialogOpen(false);
      onLessonSelect(result);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson? This will also delete all content blocks within it.')) {
      return;
    }

    const result = await deleteLesson(lessonId);
    if (result && selectedLesson?.id === lessonId) {
      onLessonSelect(null);
    }
  };

  const startEditLesson = (lesson: Lesson) => {
    setNewLessonData({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      duration: lesson.duration || '',
      completion_required: lesson.completion_required
    });
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>Manage lessons for this module</CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                <div className="space-y-2">
                  <Label htmlFor="lesson-title">Lesson Title</Label>
                  <Input
                    id="lesson-title"
                    value={newLessonData.title}
                    onChange={(e) => setNewLessonData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter lesson title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lesson-description">Description</Label>
                  <Textarea
                    id="lesson-description"
                    value={newLessonData.description}
                    onChange={(e) => setNewLessonData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter lesson description"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lesson-duration">Duration (optional)</Label>
                  <Input
                    id="lesson-duration"
                    value={newLessonData.duration}
                    onChange={(e) => setNewLessonData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g. 30 minutes"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddLesson}>
                  Add Lesson
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-sm">No lessons yet.</p>
            <p className="text-xs mt-1">Add your first lesson to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                isSelected={selectedLesson?.id === lesson.id}
                onSelect={() => onLessonSelect(lesson)}
                onEdit={() => startEditLesson(lesson)}
                onDelete={() => handleDeleteLesson(lesson.id)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update lesson details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lesson-title">Lesson Title</Label>
              <Input
                id="edit-lesson-title"
                value={newLessonData.title}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-lesson-description">Description</Label>
              <Textarea
                id="edit-lesson-description"
                value={newLessonData.description}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-lesson-duration">Duration (optional)</Label>
              <Input
                id="edit-lesson-duration"
                value={newLessonData.duration}
                onChange={(e) => setNewLessonData(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g. 30 minutes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLesson}>
              Update Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

interface LessonCardProps {
  lesson: Lesson;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  isSelected,
  onSelect,
  onEdit,
  onDelete
}) => {
  const { progress } = useLessonProgress(lesson.id);

  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/5 border-primary' : 'bg-card hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{lesson.title}</h4>
            {progress?.completed && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            {lesson.duration && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {lesson.duration}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{lesson.description}</p>
          {progress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 bg-muted rounded-full h-1">
                <div 
                  className="bg-primary h-1 rounded-full transition-all"
                  style={{ width: `${progress.completion_percentage}%` }}
                />
              </div>
              <span>{progress.completion_percentage}%</span>
            </div>
          )}
        </div>
        <div className="flex space-x-1 ml-2">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LessonManager;