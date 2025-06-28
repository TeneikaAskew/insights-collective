import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface QuizQuestion {
  id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';
  options: string[];
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

interface QuizBuilderProps {
  contentBlockId: string;
  existingQuiz?: Quiz;
  onSave: (quiz: Quiz, questions: QuizQuestion[]) => void;
  onCancel: () => void;
}

const QuizBuilder: React.FC<QuizBuilderProps> = ({
  contentBlockId,
  existingQuiz,
  onSave,
  onCancel
}) => {
  const [quiz, setQuiz] = useState<Quiz>({
    title: '',
    description: '',
    time_limit: undefined,
    attempts_allowed: 1,
    passing_score: 70,
    randomize_questions: false,
    content_block_id: contentBlockId,
    ...existingQuiz
  });
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
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
        .order('position');
      
      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load quiz questions',
        variant: 'destructive'
      });
    }
  };

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: '',
      points: 1,
      position: questions.length
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    // Update positions
    updated.forEach((q, i) => q.position = i);
    setQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) {
      return;
    }
    
    const updated = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    
    // Update positions
    updated.forEach((q, i) => q.position = i);
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options.push('');
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options.splice(optionIndex, 1);
    // Adjust correct answer if needed
    if (updated[questionIndex].correct_answer >= updated[questionIndex].options.length) {
      updated[questionIndex].correct_answer = Math.max(0, updated[questionIndex].options.length - 1);
    }
    setQuestions(updated);
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

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast({
          title: 'Error',
          description: `Question ${i + 1} text is required`,
          variant: 'destructive'
        });
        return;
      }
      
      if (q.question_type === 'multiple_choice' && q.options.some(opt => !opt.trim())) {
        toast({
          title: 'Error',
          description: `All options for question ${i + 1} must be filled`,
          variant: 'destructive'
        });
        return;
      }
    }

    setLoading(true);
    try {
      await onSave(quiz, questions);
      toast({
        title: 'Success',
        description: 'Quiz saved successfully'
      });
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to save quiz',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionEditor = (question: QuizQuestion, index: number) => (
    <Card key={index} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveQuestion(index, 'up')}
              disabled={index === 0}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveQuestion(index, 'down')}
              disabled={index === questions.length - 1}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeQuestion(index)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Question Text</Label>
          <Textarea
            value={question.question_text}
            onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
            placeholder="Enter your question"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Question Type</Label>
            <Select
              value={question.question_type}
              onValueChange={(value) => updateQuestion(index, 'question_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="true_false">True/False</SelectItem>
                <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Points</Label>
            <Input
              type="number"
              value={question.points}
              onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>
        </div>

        {question.question_type === 'multiple_choice' && (
          <div>
            <Label>Options</Label>
            <div className="space-y-2 mt-2">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={question.correct_answer === optionIndex}
                    onChange={() => updateQuestion(index, 'correct_answer', optionIndex)}
                    className="text-blue-600"
                  />
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                    placeholder={`Option ${optionIndex + 1}`}
                    className="flex-1"
                  />
                  {question.options.length > 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index, optionIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption(index)}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {question.question_type === 'true_false' && (
          <div>
            <Label>Correct Answer</Label>
            <Select
              value={question.correct_answer?.toString() || 'true'}
              onValueChange={(value) => updateQuestion(index, 'correct_answer', value === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {question.question_type === 'fill_blank' && (
          <div>
            <Label>Correct Answer</Label>
            <Input
              value={question.correct_answer || ''}
              onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
              placeholder="Enter the correct answer"
            />
          </div>
        )}

        <div>
          <Label>Explanation (Optional)</Label>
          <Textarea
            value={question.explanation || ''}
            onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
            placeholder="Explain why this is the correct answer"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Quiz Title</Label>
            <Input
              id="title"
              value={quiz.title}
              onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter quiz title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={quiz.description || ''}
              onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this quiz covers"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="time-limit">Time Limit (minutes)</Label>
              <Input
                id="time-limit"
                type="number"
                value={quiz.time_limit || ''}
                onChange={(e) => setQuiz(prev => ({ ...prev, time_limit: parseInt(e.target.value) || undefined }))}
                placeholder="No limit"
              />
            </div>
            <div>
              <Label htmlFor="attempts">Attempts Allowed</Label>
              <Input
                id="attempts"
                type="number"
                value={quiz.attempts_allowed}
                onChange={(e) => setQuiz(prev => ({ ...prev, attempts_allowed: parseInt(e.target.value) || 1 }))}
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="passing-score">Passing Score (%)</Label>
              <Input
                id="passing-score"
                type="number"
                value={quiz.passing_score}
                onChange={(e) => setQuiz(prev => ({ ...prev, passing_score: parseInt(e.target.value) || 70 }))}
                min="0"
                max="100"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="randomize"
                checked={quiz.randomize_questions}
                onCheckedChange={(checked) => setQuiz(prev => ({ ...prev, randomize_questions: checked }))}
              />
              <Label htmlFor="randomize">Randomize Questions</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Questions</h3>
          <Button onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500 mb-4">No questions added yet</p>
              <Button onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          questions.map((question, index) => renderQuestionEditor(question, index))
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Quiz'}
        </Button>
      </div>
    </div>
  );
};

export default QuizBuilder;