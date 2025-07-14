// ABOUTME: Interactive quiz builder for creating comprehensive quizzes with multiple question types
// ABOUTME: Supports auto-grading, question banks, and full quiz management with drag-and-drop functionality

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ModernEditor } from '@/components/ui/modern-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  GripVertical,
  HelpCircle,
  CheckCircle,
  XCircle,
  FileText,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Settings
} from 'lucide-react';

interface QuizQuestion {
  id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options?: string[];
  correct_answer: any;
  explanation?: string;
  points: number;
  position: number;
}

interface Quiz {
  id?: string;
  title: string;
  description?: string;
  time_limit?: number;
  attempts_allowed: number;
  passing_score: number;
  randomize_questions: boolean;
  content_block_id: string;
}

interface InteractiveQuizBuilderProps {
  courseId: string;
  onSave: (quiz: Quiz, questions: QuizQuestion[]) => Promise<void>;
  onCancel: () => void;
  existingQuiz?: Quiz;
}

export function InteractiveQuizBuilder({ 
  courseId, 
  onSave, 
  onCancel, 
  existingQuiz 
}: InteractiveQuizBuilderProps) {
  const [quiz, setQuiz] = useState<Quiz>({
    title: existingQuiz?.title || '',
    description: existingQuiz?.description || '',
    time_limit: existingQuiz?.time_limit || 60,
    attempts_allowed: existingQuiz?.attempts_allowed || 1,
    passing_score: existingQuiz?.passing_score || 70,
    randomize_questions: existingQuiz?.randomize_questions || false,
    content_block_id: existingQuiz?.content_block_id || ''
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (existingQuiz?.id) {
      fetchQuestions();
    }
  }, [existingQuiz]);

  const fetchQuestions = async () => {
    if (!existingQuiz?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', existingQuiz.id)
        .order('position', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      explanation: '',
      points: 1,
      position: questions.length + 1
    };
    setEditingQuestion(newQuestion);
    setDialogOpen(true);
  };

  const editQuestion = (question: QuizQuestion) => {
    setEditingQuestion({ ...question });
    setDialogOpen(true);
  };

  const saveQuestion = () => {
    if (!editingQuestion) return;

    if (editingQuestion.id) {
      // Update existing question
      setQuestions(prev => prev.map(q => 
        q.id === editingQuestion.id ? editingQuestion : q
      ));
    } else {
      // Add new question
      setQuestions(prev => [...prev, { 
        ...editingQuestion, 
        id: `temp-${Date.now()}`,
        position: prev.length + 1 
      }]);
    }
    
    setDialogOpen(false);
    setEditingQuestion(null);
  };

  const deleteQuestion = (questionId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newQuestions.length) {
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
      
      // Update positions
      newQuestions.forEach((q, i) => {
        q.position = i + 1;
      });
      
      setQuestions(newQuestions);
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return <CheckCircle className="h-4 w-4" />;
      case 'true_false':
        return <XCircle className="h-4 w-4" />;
      case 'short_answer':
        return <FileText className="h-4 w-4" />;
      case 'essay':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const handleSave = async () => {
    if (!quiz.title.trim()) {
      toast({
        title: 'Error',
        description: 'Quiz title is required',
        variant: 'destructive'
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one question is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      await onSave(quiz, questions);
      toast({
        title: 'Success',
        description: 'Quiz created successfully'
      });
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to create quiz',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionForm = () => {
    if (!editingQuestion) return null;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question_text">Question Text</Label>
          <ModernEditor
            value={editingQuestion.question_text}
            onChange={(value) => setEditingQuestion({...editingQuestion, question_text: value})}
            placeholder="Enter your question here..."
            minHeight="150px"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="question_type">Question Type</Label>
            <Select
              value={editingQuestion.question_type}
              onValueChange={(value: any) => setEditingQuestion({
                ...editingQuestion, 
                question_type: value,
                options: value === 'multiple_choice' ? ['', '', '', ''] : 
                        value === 'true_false' ? ['True', 'False'] : undefined
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="true_false">True/False</SelectItem>
                <SelectItem value="short_answer">Short Answer</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="points">Points</Label>
            <Input
              type="number"
              value={editingQuestion.points}
              onChange={(e) => setEditingQuestion({...editingQuestion, points: parseInt(e.target.value) || 1})}
              min="1"
            />
          </div>
        </div>

        {(editingQuestion.question_type === 'multiple_choice' || editingQuestion.question_type === 'true_false') && (
          <div className="space-y-2">
            <Label>Answer Options</Label>
            {editingQuestion.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(editingQuestion.options || [])];
                    newOptions[index] = e.target.value;
                    setEditingQuestion({...editingQuestion, options: newOptions});
                  }}
                  placeholder={`Option ${index + 1}`}
                  disabled={editingQuestion.question_type === 'true_false'}
                />
                <Switch
                  checked={editingQuestion.correct_answer === option}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEditingQuestion({...editingQuestion, correct_answer: option});
                    }
                  }}
                />
                <Label className="text-sm">Correct</Label>
              </div>
            ))}
          </div>
        )}

        {editingQuestion.question_type === 'short_answer' && (
          <div className="space-y-2">
            <Label htmlFor="correct_answer">Correct Answer (for auto-grading)</Label>
            <Input
              value={editingQuestion.correct_answer || ''}
              onChange={(e) => setEditingQuestion({...editingQuestion, correct_answer: e.target.value})}
              placeholder="Enter the correct answer"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="explanation">Explanation (optional)</Label>
          <ModernEditor
            value={editingQuestion.explanation || ''}
            onChange={(value) => setEditingQuestion({...editingQuestion, explanation: value})}
            placeholder="Provide an explanation for the correct answer..."
            minHeight="100px"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Quiz Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quiz Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Quiz Title</Label>
            <Input
              value={quiz.title}
              onChange={(e) => setQuiz({...quiz, title: e.target.value})}
              placeholder="Enter quiz title"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time_limit">Time Limit (minutes)</Label>
              <Input
                type="number"
                value={quiz.time_limit || ''}
                onChange={(e) => setQuiz({...quiz, time_limit: parseInt(e.target.value) || undefined})}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attempts_allowed">Attempts Allowed</Label>
              <Input
                type="number"
                value={quiz.attempts_allowed}
                onChange={(e) => setQuiz({...quiz, attempts_allowed: parseInt(e.target.value) || 1})}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passing_score">Passing Score (%)</Label>
              <Input
                type="number"
                value={quiz.passing_score}
                onChange={(e) => setQuiz({...quiz, passing_score: parseInt(e.target.value) || 70})}
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={quiz.randomize_questions}
              onCheckedChange={(checked) => setQuiz({...quiz, randomize_questions: checked})}
            />
            <Label>Randomize Question Order</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Quiz Description</Label>
            <ModernEditor
              value={quiz.description || ''}
              onChange={(value) => setQuiz({...quiz, description: value})}
              placeholder="Describe what this quiz covers..."
              minHeight="100px"
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Questions ({questions.length})
            </CardTitle>
            <Button onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
              <p className="text-muted-foreground">Add your first question to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getQuestionIcon(question.question_type)}
                          <Badge variant="secondary">
                            {question.question_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{question.points} pts</Badge>
                        </div>
                        <div 
                          className="text-sm font-medium mb-2"
                          dangerouslySetInnerHTML={{ __html: question.question_text }}
                        />
                        {question.options && (
                          <div className="text-xs text-muted-foreground">
                            Options: {question.options.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveQuestion(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveQuestion(index, 'down')}
                          disabled={index === questions.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editQuestion(question)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteQuestion(question.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Creating...' : 'Create Quiz'}
        </Button>
      </div>

      {/* Question Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion?.id ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
          </DialogHeader>
          {renderQuestionForm()}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveQuestion}>
              <Save className="h-4 w-4 mr-2" />
              Save Question
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}