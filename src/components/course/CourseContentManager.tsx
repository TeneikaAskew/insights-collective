// ABOUTME: Comprehensive course content manager for editing modules, assignments, and quizzes with rich text editing
// ABOUTME: Provides tabbed interface for managing different types of course content with full CRUD operations and WYSIWYG editing

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ModernEditor } from '@/components/ui/modern-editor';
import { QuizEditor } from './QuizEditor';
import { InteractiveQuizBuilder } from '../quiz/InteractiveQuizBuilder';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  GripVertical,
  AlertCircle,
  Clock,
  Users,
  Upload,
  Video,
  Link
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
  created_at: string;
  updated_at: string;
  content_blocks?: any[];
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  points: number;
  submission_type: string;
  course_id: string;
  created_at: string;
  updated_at: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  time_limit: number;
  total_points: number;
  attempts_allowed: number;
  course_id: string;
  created_at: string;
  updated_at: string;
}

interface CourseContentManagerProps {
  courseId: string;
  contentType: 'modules' | 'assignments' | 'quizzes';
}

export function CourseContentManager({ courseId, contentType }: CourseContentManagerProps) {
  const [items, setItems] = useState<(Module | Assignment | Quiz)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(Module | Assignment | Quiz) | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [quizEditorOpen, setQuizEditorOpen] = useState<string | null>(null);
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, [courseId, contentType]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(contentType)
        .select('*')
        .eq('course_id', courseId)
        .order(contentType === 'modules' ? 'week' : 'created_at', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        const { error } = await supabase
          .from(contentType)
          .update(formData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        
        toast({
          title: 'Updated successfully',
          description: `${contentType.slice(0, -1)} has been updated.`,
        });
      } else {
        if (contentType === 'quizzes') {
          // For quizzes, open the interactive quiz builder instead
          setDialogOpen(false);
          setQuizBuilderOpen(true);
          return;
        } else {
          const { error } = await supabase
            .from(contentType)
            .insert({ ...formData, course_id: courseId });
          
          if (error) throw error;
        }
        
        toast({
          title: 'Created successfully',
          description: `New ${contentType.slice(0, -1)} has been created.`,
        });
      }
      
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({});
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from(contentType)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Deleted successfully',
        description: `${contentType.slice(0, -1)} has been deleted.`,
      });
      
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDialog = (item?: any) => {
    if (contentType === 'quizzes' && !item) {
      // For new quizzes, open quiz builder
      setQuizBuilderOpen(true);
    } else {
      setEditingItem(item || null);
      setFormData(item || getDefaultFormData());
      setDialogOpen(true);
    }
  };

  const getDefaultFormData = () => {
    switch (contentType) {
      case 'modules':
        return { title: '', description: '', week: 1 };
      case 'assignments':
        return { title: '', description: '', due_date: '', points: 100, instructions: '', content: '' };
      case 'quizzes':
        return { title: '', description: '', time_limit: 60, attempts_allowed: 1, passing_score: 70, randomize_questions: false };
      default:
        return {};
    }
  };

  const getIcon = () => {
    switch (contentType) {
      case 'modules':
        return <BookOpen className="h-5 w-5" />;
      case 'assignments':
        return <FileText className="h-5 w-5" />;
      case 'quizzes':
        return <HelpCircle className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const renderFormFields = () => {
    switch (contentType) {
      case 'modules':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Module Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Introduction to Python"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="week">Week</Label>
                <Input
                  id="week"
                  type="number"
                  value={formData.week || 1}
                  onChange={(e) => setFormData({...formData, week: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Module Content</Label>
              <ModernEditor
                value={formData.description || ''}
                onChange={(value) => setFormData({...formData, description: value})}
                placeholder="Describe what students will learn in this module. Use the rich text editor to format your content, add images, links, and videos..."
                minHeight="300px"
              />
            </div>
          </>
        );
      case 'assignments':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Assignment Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Data Analysis Project"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points || 100}
                  onChange={(e) => setFormData({...formData, points: parseInt(e.target.value)})}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Assignment Instructions</Label>
              <ModernEditor
                value={formData.instructions || ''}
                onChange={(value) => setFormData({...formData, instructions: value})}
                placeholder="Provide detailed instructions for this assignment. Use formatting, links, images, and embedded videos to make instructions clear..."
                minHeight="400px"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Additional Content</Label>
              <ModernEditor
                value={formData.content || ''}
                onChange={(value) => setFormData({...formData, content: value})}
                placeholder="Add supplementary materials, rubrics, examples, or additional resources..."
                minHeight="300px"
              />
            </div>
          </>
        );
      case 'quizzes':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Module 1 Quiz"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit || 60}
                  onChange={(e) => setFormData({...formData, time_limit: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attempts_allowed">Attempts Allowed</Label>
                <Input
                  id="attempts_allowed"
                  type="number"
                  value={formData.attempts_allowed || 1}
                  onChange={(e) => setFormData({...formData, attempts_allowed: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passing_score">Passing Score (%)</Label>
                <Input
                  id="passing_score"
                  type="number"
                  value={formData.passing_score || 70}
                  onChange={(e) => setFormData({...formData, passing_score: parseInt(e.target.value)})}
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 py-2">
              <Switch
                id="randomize_questions"
                checked={formData.randomize_questions || false}
                onCheckedChange={(checked) => setFormData({...formData, randomize_questions: checked})}
              />
              <Label htmlFor="randomize_questions">Randomize Question Order</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Quiz Description</Label>
              <ModernEditor
                value={formData.description || ''}
                onChange={(value) => setFormData({...formData, description: value})}
                placeholder="Describe what this quiz covers, provide study tips, or include important notes..."
                minHeight="250px"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const renderItem = (item: any) => {
    switch (contentType) {
      case 'modules':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {item.week}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">Week {item.week}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  <span>{item.content_blocks?.length || 0} items</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Est. 2-3 hours</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'assignments':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(item.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.points} pts</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{item.submission_type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>0 submissions</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'quizzes':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.total_points} points • {item.time_limit} minutes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.attempts_allowed} attempts</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuizEditorOpen(item.id)}
                  >
                    <Edit className="h-4 w-4" />
                    Questions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>0 questions</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>0 attempts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {getIcon()}
            {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
          </h2>
          <p className="text-muted-foreground">
            Manage your course {contentType} - create, edit, and organize content.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add {contentType.slice(0, -1)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit' : 'Create'} {contentType.slice(0, -1)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          {getIcon()}
          <h3 className="text-lg font-semibold mt-4">No {contentType} yet</h3>
          <p className="text-muted-foreground mt-2">
            Create your first {contentType.slice(0, -1)} to get started with your course content.
          </p>
        </div>
      )}

      {/* Quiz Builder Dialog */}
      {quizBuilderOpen && (
        <Dialog open={quizBuilderOpen} onOpenChange={setQuizBuilderOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Interactive Quiz</DialogTitle>
            </DialogHeader>
            <InteractiveQuizBuilder
              courseId={courseId}
              onSave={async (quiz, questions) => {
                // Create content block first
                const { data: user } = await supabase.auth.getUser();
                const { data: contentBlock, error: contentBlockError } = await supabase
                  .from('content_blocks')
                  .insert({
                    title: quiz.title,
                    block_type: 'quiz',
                    module_id: null, // Will be set later when assigning to modules
                    created_by: user.user?.id || '',
                    position: 0
                  })
                  .select()
                  .single();

                if (contentBlockError) throw contentBlockError;

                // Create quiz with content block ID
                const { data: quizData, error: quizError } = await supabase
                  .from('quizzes')
                  .insert({
                    ...quiz,
                    course_id: courseId,
                    content_block_id: contentBlock.id
                  })
                  .select()
                  .single();

                if (quizError) throw quizError;

                // Create questions if quiz was created successfully
                if (questions.length > 0) {
                  const questionsToInsert = questions.map(q => ({
                    ...q,
                    quiz_id: quizData.id, // Use the actual quiz ID
                    id: undefined // Remove temp IDs
                  }));

                  const { error: questionsError } = await supabase
                    .from('quiz_questions')
                    .insert(questionsToInsert);

                  if (questionsError) throw questionsError;
                }

                setQuizBuilderOpen(false);
                fetchItems();
              }}
              onCancel={() => setQuizBuilderOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Quiz Editor Dialog */}
      {quizEditorOpen && (
        <Dialog open={!!quizEditorOpen} onOpenChange={() => setQuizEditorOpen(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Quiz Editor</DialogTitle>
            </DialogHeader>
            <QuizEditor 
              quizId={quizEditorOpen} 
              onClose={() => setQuizEditorOpen(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}