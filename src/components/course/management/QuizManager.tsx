// ABOUTME: Comprehensive quiz management interface for listing, creating, editing, and managing course quizzes
// ABOUTME: Provides table view with filtering, sorting, and quiz builder integration similar to educational platforms

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QuizEditor } from '@/components/course/QuizEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy,
  HelpCircle,
  Calendar,
  Users,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Quiz {
  id: string;
  content_item_id?: string;
  title: string;
  description?: string;
  quiz_type?: string;
  points_possible?: number;
  time_limit?: number;
  allowed_attempts?: number;
  shuffle_answers?: boolean;
  shuffle_questions?: boolean;
  show_correct_answers?: boolean;
  due_at?: string;
  published?: boolean;
  created_at: string;
  updated_at: string;
  question_count?: number;
}

interface QuizManagerProps {
  courseId: string;
  modules?: Array<{ id: string; title: string }>;
}

export function QuizManager({ courseId, modules = [] }: QuizManagerProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchQuizzes();
  }, [courseId]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);

      // Fetch quizzes that belong to content_items in this course
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select(`
          *,
          content_item:content_items!inner(
            id,
            course_id,
            module_id,
            title,
            published,
            created_at,
            updated_at
          )
        `)
        .eq('content_items.course_id', courseId)
        .order('created_at', { ascending: false });

      if (quizzesError) throw quizzesError;

      // For each quiz, get question count
      const quizzesWithCounts = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          const { count } = await supabase
            .from('quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', quiz.id);

          // Merge quiz data with content_item data
          return {
            id: quiz.id,
            content_item_id: quiz.content_item_id,
            title: quiz.title,
            description: quiz.description,
            quiz_type: quiz.quiz_type,
            points_possible: quiz.points_possible,
            time_limit: quiz.time_limit,
            allowed_attempts: quiz.allowed_attempts,
            shuffle_answers: quiz.shuffle_answers,
            shuffle_questions: quiz.shuffle_questions,
            show_correct_answers: quiz.show_correct_answers,
            due_at: quiz.due_at,
            published: (quiz.content_item as any)?.published || false,
            created_at: quiz.created_at,
            updated_at: quiz.updated_at,
            question_count: count || 0,
          };
        })
      );

      setQuizzes(quizzesWithCounts as Quiz[]);
    } catch (error: any) {
      console.error('Error fetching quizzes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load quizzes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'published' && quiz.published) ||
      (filterStatus === 'draft' && !quiz.published);
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    try {
      // Create a new quiz (content item)
      const { data: newQuiz, error } = await supabase
        .from('content_items')
        .insert({
          course_id: courseId,
          type: 'quiz',
          title: 'Untitled Quiz',
          content: '',
          position: quizzes.length,
          published: false,
        })
        .select()
        .single();

      if (error) throw error;

      setEditingQuizId(newQuiz.id);
      setShowEditor(true);
      fetchQuizzes();
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to create quiz',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (quizId: string) => {
    setEditingQuizId(quizId);
    setShowEditor(true);
  };

  const handleDelete = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete quiz questions first
      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('quiz_id', quizId);

      if (questionsError) throw questionsError;

      // Delete the quiz content item
      const { error: quizError } = await supabase
        .from('content_items')
        .delete()
        .eq('id', quizId);

      if (quizError) throw quizError;

      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      });

      fetchQuizzes();
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete quiz',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (quiz: Quiz) => {
    try {
      // Create duplicate quiz
      const { data: newQuiz, error: quizError } = await supabase
        .from('content_items')
        .insert({
          course_id: courseId,
          type: 'quiz',
          title: `${quiz.title} (Copy)`,
          content: quiz.description || '',
          position: quizzes.length,
          published: false,
          settings: quiz,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Duplicate quiz questions
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id);

      if (questionsError) throw questionsError;

      if (questions && questions.length > 0) {
        const duplicatedQuestions = questions.map(q => ({
          ...q,
          id: undefined,
          quiz_id: newQuiz.id,
        }));

        const { error: insertError } = await supabase
          .from('quiz_questions')
          .insert(duplicatedQuestions);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: 'Quiz duplicated successfully',
      });

      fetchQuizzes();
    } catch (error: any) {
      console.error('Error duplicating quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate quiz',
        variant: 'destructive',
      });
    }
  };

  const togglePublish = async (quiz: Quiz) => {
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ published: !quiz.published })
        .eq('id', quiz.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Quiz ${quiz.published ? 'unpublished' : 'published'} successfully`,
      });

      fetchQuizzes();
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to update quiz status',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (quiz: Quiz) => {
    if (!quiz.published) {
      return <Badge variant="secondary">Draft</Badge>;
    }
    return <Badge variant="default">Published</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Quizzes
              </CardTitle>
              <CardDescription>
                Create and manage quizzes for your course
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Quiz
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quizzes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All ({quizzes.length})
              </Button>
              <Button
                variant={filterStatus === 'published' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('published')}
              >
                Published ({quizzes.filter(q => q.published).length})
              </Button>
              <Button
                variant={filterStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('draft')}
              >
                Draft ({quizzes.filter(q => !q.published).length})
              </Button>
            </div>
          </div>

          {/* Quizzes Table */}
          {filteredQuizzes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No quizzes match your search.' : 'Get started by creating your first quiz.'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Time Limit</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{quiz.title}</span>
                          {quiz.description && (
                            <span className="text-sm text-muted-foreground line-clamp-1">
                              {quiz.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{quiz.question_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {quiz.time_limit ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {quiz.time_limit} min
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No limit</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{quiz.points_possible || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{quiz.allowed_attempts || 'Unlimited'}</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(quiz)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(quiz.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Questions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePublish(quiz)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {quiz.published ? 'Unpublish' : 'Publish'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(quiz)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(quiz.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz Editor Dialog */}
      {editingQuizId && (
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quiz Questions</DialogTitle>
            </DialogHeader>
            <QuizEditor
              quizId={editingQuizId}
              onClose={() => {
                setShowEditor(false);
                setEditingQuizId(null);
                fetchQuizzes();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
