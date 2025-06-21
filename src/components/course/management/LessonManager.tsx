
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, FolderOpen, Clock } from 'lucide-react';
import { useLessons, Lesson } from '@/hooks/useLessons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface LessonManagerProps {
  moduleId: string;
  moduleName: string;
  onEditLesson: (lessonId: string, lessonTitle: string) => void;
}

const LessonManager: React.FC<LessonManagerProps> = ({
  moduleId,
  moduleName,
  onEditLesson
}) => {
  const { lessons, loading, addLesson, updateLesson, deleteLesson } = useLessons(moduleId);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [editLessonOpen, setEditLessonOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const [newLessonContent, setNewLessonContent] = useState('');
  const [newLessonDuration, setNewLessonDuration] = useState('');

  const handleAddLesson = async () => {
    if (!newLessonTitle) return;

    const orderNum = lessons.length + 1;
    
    await addLesson({
      title: newLessonTitle,
      description: newLessonDescription || `Lesson ${orderNum}`,
      content: newLessonContent || '',
      duration: newLessonDuration || '30 minutes',
      order_num: orderNum,
      estimated_duration: 30, // Default 30 minutes
      completion_required: true,
      completion_criteria: { type: 'all_blocks' },
      module_id: moduleId
    });

    setNewLessonTitle('');
    setNewLessonDescription('');
    setNewLessonContent('');
    setNewLessonDuration('');
    setAddLessonOpen(false);
  };

  const handleEditLesson = async () => {
    if (!editingLesson || !newLessonTitle) return;

    await updateLesson(editingLesson.id, {
      title: newLessonTitle,
      description: newLessonDescription,
      content: newLessonContent,
      duration: newLessonDuration,
    });

    setEditLessonOpen(false);
    setEditingLesson(null);
    setNewLessonTitle('');
    setNewLessonDescription('');
    setNewLessonContent('');
    setNewLessonDuration('');
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (window.confirm('Are you sure you want to delete this lesson? This will also delete all content blocks within it.')) {
      await deleteLesson(lessonId);
    }
  };

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setNewLessonTitle(lesson.title);
    setNewLessonDescription(lesson.description);
    setNewLessonContent(lesson.content);
    setNewLessonDuration(lesson.duration || '');
    setEditLessonOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{moduleName} - Lessons</h3>
          <p className="text-sm text-gray-600">
            Manage lessons and their content for this module
          </p>
        </div>
        
        <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
          <DialogTrigger asChild>
            <Button>
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Lesson Title</Label>
                <Input
                  id="title"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Enter lesson title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newLessonDescription}
                  onChange={(e) => setNewLessonDescription(e.target.value)}
                  placeholder="Enter lesson description"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={newLessonDuration}
                  onChange={(e) => setNewLessonDuration(e.target.value)}
                  placeholder="e.g., 30 minutes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddLessonOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLesson}>Add Lesson</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="text-4xl">📖</div>
              <h3 className="text-lg font-medium">No lessons yet</h3>
              <p className="text-gray-600 max-w-md">
                Start building your module by adding lessons. Each lesson can contain multiple content blocks.
              </p>
              <Button onClick={() => setAddLessonOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Lesson
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {lessons.map((lesson, index) => (
            <AccordionItem key={lesson.id} value={lesson.id}>
              <Card>
                <AccordionTrigger className="hover:no-underline">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 w-full">
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">{index + 1}</Badge>
                      <div className="text-left">
                        <CardTitle className="text-base">{lesson.title}</CardTitle>
                        <p className="text-sm text-gray-600">{lesson.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span>{lesson.duration}</span>
                      <Badge variant="secondary">
                        {lesson.content_blocks_count || 0} blocks
                      </Badge>
                    </div>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {lesson.content || 'No content description available.'}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditLesson(lesson.id, lesson.title)}
                        >
                          <FolderOpen className="h-4 w-4 mr-1" />
                          Edit Content
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(lesson)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLesson(lesson.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={editLessonOpen} onOpenChange={setEditLessonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update the lesson details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Lesson Title</Label>
              <Input
                id="edit-title"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="Enter lesson title"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newLessonDescription}
                onChange={(e) => setNewLessonDescription(e.target.value)}
                placeholder="Enter lesson description"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={newLessonContent}
                onChange={(e) => setNewLessonContent(e.target.value)}
                placeholder="Enter lesson content overview"
              />
            </div>
            <div>
              <Label htmlFor="edit-duration">Duration</Label>
              <Input
                id="edit-duration"
                value={newLessonDuration}
                onChange={(e) => setNewLessonDuration(e.target.value)}
                placeholder="e.g., 30 minutes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLessonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLesson}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LessonManager;
