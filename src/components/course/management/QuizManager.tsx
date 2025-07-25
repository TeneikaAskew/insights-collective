// ABOUTME: Quiz management component for course editing interface
// ABOUTME: Handles listing, creating, editing, and deleting quizzes within course context

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QuizEditor } from '@/components/course/QuizEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  HelpCircle, 
  MoreHorizontal,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Quiz {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  time_limit?: number;
  attempt_limit?: number;
  show_correct_answers: boolean;
  shuffle_questions: boolean;
  is_published: boolean;
  due_date?: string;
  created_at: string;
  updated_at: string;
  course_id: string;
}

interface QuizManagerProps {
  courseId: string;
}

export function QuizManager({ courseId }: QuizManagerProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchQuizzes();
  }, [courseId]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading quizzes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const quizData = {
        ...formData,
        course_id: courseId,
        time_limit: formData.time_limit ? parseInt(formData.time_limit) : null,
        attempt_limit: formData.attempt_limit ? parseInt(formData.attempt_limit) : null,
      };

      if (editingQuiz) {
        const { error } = await supabase
          .from('quizzes')
          .update(quizData)
          .eq('id', editingQuiz.id);

        if (error) throw error;

        toast({
          title: 'Quiz updated',
          description: 'Quiz has been updated successfully.',
        });
      } else {
        const { data, error } = await supabase
          .from('quizzes')
          .insert(quizData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Quiz created',
          description: 'New quiz has been created successfully.',
        });

        // Open the quiz editor for the newly created quiz
        setSelectedQuizId(data.id);
        setEditorOpen(true);
      }

      setDialogOpen(false);
      setEditingQuiz(null);
      setFormData({});
      fetchQuizzes();
    } catch (error: any) {
      toast({
        title: 'Error saving quiz',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Quiz deleted',
        description: 'Quiz has been deleted successfully.',
      });

      fetchQuizzes();
    } catch (error: any) {
      toast({
        title: 'Error deleting quiz',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const togglePublished = async (quiz: Quiz) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_published: !quiz.is_published })
        .eq('id', quiz.id);

      if (error) throw error;

      toast({
        title: `Quiz ${!quiz.is_published ? 'published' : 'unpublished'}`,
        description: `Quiz has been ${!quiz.is_published ? 'published' : 'unpublished'} successfully.`,
      });

      fetchQuizzes();
    } catch (error: any) {
      toast({
        title: 'Error updating quiz',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDialog = (quiz?: Quiz) => {
    setEditingQuiz(quiz || null);
    if (quiz) {
      setFormData(quiz);
    } else {
      setFormData({
        title: '',
        description: '',
        instructions: '',
        time_limit: '',
        attempt_limit: '',
        show_correct_answers: false,
        shuffle_questions: false,
        is_published: false,
        due_date: '',
      });
    }
    setDialogOpen(true);
  };

  const openEditor = (quizId: string) => {
    setSelectedQuizId(quizId);
    setEditorOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (editorOpen && selectedQuizId) {
    return (
      <QuizEditor 
        quizId={selectedQuizId} 
        onClose={() => {
          setEditorOpen(false);
          setSelectedQuizId(null);
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Course Quizzes</h3>
          <p className="text-sm text-muted-foreground">
            {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      <div className="grid gap-4">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{quiz.title}</h4>
                    <Badge variant={quiz.is_published ? "default" : "secondary"}>
                      {quiz.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {quiz.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quiz.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditor(quiz.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Questions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openDialog(quiz)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Quiz Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => togglePublished(quiz)}>
                      {quiz.is_published ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Publish
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(quiz.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {quiz.time_limit && (
                  <div className="flex items-center gap-1">
                    <span>{quiz.time_limit} min limit</span>
                  </div>
                )}
                {quiz.attempt_limit && (
                  <div className="flex items-center gap-1">
                    <span>{quiz.attempt_limit} attempts</span>
                  </div>
                )}
                {quiz.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due {format(new Date(quiz.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span>Created {format(new Date(quiz.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {quizzes.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first quiz to get started.
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Quiz
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingQuiz ? 'Edit Quiz Settings' : 'Create New Quiz'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Quiz title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the quiz"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions || ''}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Instructions for students taking the quiz"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit || ''}
                  onChange={(e) => setFormData({ ...formData, time_limit: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attempt_limit">Attempt Limit</Label>
                <Input
                  id="attempt_limit"
                  type="number"
                  value={formData.attempt_limit || ''}
                  onChange={(e) => setFormData({ ...formData, attempt_limit: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show_correct_answers">Show Correct Answers</Label>
                <Switch
                  id="show_correct_answers"
                  checked={formData.show_correct_answers || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_correct_answers: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="shuffle_questions">Shuffle Questions</Label>
                <Switch
                  id="shuffle_questions"
                  checked={formData.shuffle_questions || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, shuffle_questions: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_published">Publish Quiz</Label>
                <Switch
                  id="is_published"
                  checked={formData.is_published || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}