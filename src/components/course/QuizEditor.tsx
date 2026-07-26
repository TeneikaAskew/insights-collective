// ABOUTME: Comprehensive quiz editor for creating and managing quiz questions with different types
// ABOUTME: Supports multiple choice, true/false, short answer, and essay questions with rich text editing

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHTML } from '@/utils/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CanvasEditor } from '@/components/ui/canvas-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  HelpCircle,
  CheckCircle,
  XCircle,
  FileText,
  MessageSquare
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer?: any;
  explanation?: string;
  points: number;
  position: number;
}

interface QuizEditorProps {
  quizId: string;
  onClose: () => void;
}

export function QuizEditor({ quizId, onClose }: QuizEditorProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [quizId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      // Reads the answer key, so it goes through the authoring RPC: table-level
      // SELECT on quiz_questions is revoked and `select('*')` now fails.
      const { data, error } = await supabase.rpc('get_quiz_questions_for_authoring', {
        p_quiz_id: quizId,
      });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const questionData = {
        ...formData,
        quiz_id: quizId,
        position: editingQuestion ? editingQuestion.position : questions.length + 1,
        points: parseInt(formData.points) || 1,
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from('quiz_questions')
          .update(questionData)
          .eq('id', editingQuestion.id);
        
        if (error) throw error;
        
        toast({
          title: 'Question updated',
          description: 'Quiz question has been updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('quiz_questions')
          .insert(questionData);
        
        if (error) throw error;
        
        toast({
          title: 'Question added',
          description: 'New quiz question has been added successfully.',
        });
      }
      
      setDialogOpen(false);
      setEditingQuestion(null);
      setFormData({});
      fetchQuestions();
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
        .from('quiz_questions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Question deleted',
        description: 'Quiz question has been deleted successfully.',
      });
      
      fetchQuestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDialog = (question?: QuizQuestion) => {
    setEditingQuestion(question || null);
    if (question) {
      setFormData(question);
    } else {
      setFormData({
        question_text: '',
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
        explanation: '',
        points: 1
      });
    }
    setDialogOpen(true);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(formData.options || ['', '', '', ''])];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...(formData.options || []), ''];
    setFormData({ ...formData, options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = (formData.options || []).filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, options: newOptions });
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

  const renderFormFields = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="question_text">Question</Label>
        <CanvasEditor
          content={formData.question_text || ''}
          onChange={(value) => setFormData({ ...formData, question_text: value })}
          placeholder="Enter your question here. You can use formatting, images, and links..."
          minHeight="200px"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="question_type">Question Type</Label>
          <Select
            value={formData.question_type || 'multiple_choice'}
            onValueChange={(value) => setFormData({ ...formData, question_type: value })}
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
            id="points"
            type="number"
            value={formData.points || 1}
            onChange={(e) => setFormData({ ...formData, points: e.target.value })}
            min="1"
          />
        </div>
      </div>

      {(formData.question_type === 'multiple_choice' || formData.question_type === 'true_false') && (
        <div className="space-y-4">
          <Label>Answer Options</Label>
          {formData.question_type === 'true_false' ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="true"
                  name="correct_answer"
                  value="true"
                  checked={formData.correct_answer === 'true'}
                  onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                />
                <Label htmlFor="true">True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="false"
                  name="correct_answer"
                  value="false"
                  checked={formData.correct_answer === 'false'}
                  onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                />
                <Label htmlFor="false">False</Label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(formData.options || ['', '', '', '']).map((option: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_answer"
                    value={index}
                    checked={formData.correct_answer === index.toString()}
                    onChange={() => setFormData({ ...formData, correct_answer: index.toString() })}
                  />
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                  />
                  {index >= 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addOption}>
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="explanation">Explanation (Optional)</Label>
        <CanvasEditor
          content={formData.explanation || ''}
          onChange={(value) => setFormData({ ...formData, explanation: value })}
          placeholder="Provide an explanation for the correct answer..."
          minHeight="150px"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quiz Questions</h3>
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {questions.map((question, index) => (
          <Card key={question.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getQuestionIcon(question.question_type)}
                      <Badge variant="secondary">
                        {question.question_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                      <Badge variant="outline">{question.points} pts</Badge>
                    </div>
                    <div 
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(question.question_text) }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(question)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(question.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {questions.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first question to get started.
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Question
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              {editingQuestion ? 'Update' : 'Add'} Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}