import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import { QuestionBankQuestion, QuestionType, MatchingQuestion, FillBlankQuestion, OrderingQuestion, MultipleAnswerQuestion, CalculatedQuestion } from '@/types/course';
import { CanvasEditor } from '@/components/ui/canvas-editor';
import { Badge } from '@/components/ui/badge';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

interface QuestionEditorProps {
  question?: QuestionBankQuestion;
  onSave: (question: Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => void;
  onCancel: () => void;
  bankId: string;
}

const questionTypes: { value: QuestionType; label: string; disabled?: boolean }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True/False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  // These types have no editing UI yet. They are listed disabled so that
  // (a) users cannot create a question of a type that cannot be edited, and
  // (b) an existing question of one of these types still shows its type
  // instead of an empty selector.
  { value: 'matching', label: 'Matching (not yet available)', disabled: true },
  { value: 'fill_blank', label: 'Fill in the Blank (not yet available)', disabled: true },
  { value: 'ordering', label: 'Ordering (not yet available)', disabled: true },
  { value: 'multiple_answer', label: 'Multiple Answer (not yet available)', disabled: true },
  { value: 'calculated', label: 'Calculated (not yet available)', disabled: true },
];

const difficultyLevels = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  onSave,
  onCancel,
  bankId,
}) => {
  const [formData, setFormData] = useState<Partial<QuestionBankQuestion>>({
    bank_id: bankId,
    question_type: question?.question_type || 'multiple_choice',
    question_text: question?.question_text || '',
    points: question?.points || 1,
    difficulty_level: question?.difficulty_level || 'medium',
    topic_tags: question?.topic_tags || [],
    options: question?.options || {},
    correct_answer: question?.correct_answer || {},
    explanation: question?.explanation || '',
    feedback: question?.feedback || {},
  });

  const [newTag, setNewTag] = useState('');

  const handleSubmit = () => {
    onSave(formData as Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.topic_tags?.includes(newTag.trim())) {
      setFormData({
        ...formData,
        topic_tags: [...(formData.topic_tags || []), newTag.trim()],
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      topic_tags: formData.topic_tags?.filter(t => t !== tag) || [],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{question ? 'Edit Question' : 'Create New Question'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Question Type</Label>
            <Select
              value={formData.question_type}
              onValueChange={(value: QuestionType) => setFormData({ ...formData, question_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map(type => (
                  <SelectItem key={type.value} value={type.value} disabled={type.disabled}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty Level</Label>
            <Select
              value={formData.difficulty_level}
              onValueChange={(value) => setFormData({ ...formData, difficulty_level: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficultyLevels.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Question Text</Label>
          <CanvasEditor
            content={formData.question_text || ''}
            onChange={(content) => setFormData({ ...formData, question_text: content })}
            placeholder="Enter your question..."
          />
        </div>

        <div>
          <Label>Points</Label>
          <Input
            type="number"
            value={formData.points}
            onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) || 1 })}
            min="0"
            step="0.5"
          />
        </div>

        {/* Question Type Specific Options */}
        {renderQuestionTypeOptions()}

        <div>
          <Label>Explanation (shown after answer)</Label>
          <Textarea
            value={formData.explanation || ''}
            onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
            placeholder="Explain the correct answer..."
            rows={3}
          />
        </div>

        <div>
          <Label>Topic Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.topic_tags?.map(tag => (
              <Badge key={tag} variant="secondary">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add a tag..."
            />
            <Button type="button" onClick={addTag}>Add</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Question</Button>
        </div>
      </CardContent>
    </Card>
  );

  function renderQuestionTypeOptions() {
    switch (formData.question_type) {
      case 'multiple_choice':
        return <MultipleChoiceOptions />;
      case 'true_false':
        return <TrueFalseOptions />;
      case 'short_answer':
        return <ShortAnswerOptions />;
      case 'essay':
        return <EssayOptions />;
      case 'matching':
        return <MatchingOptions />;
      case 'fill_blank':
        return <FillBlankOptions />;
      case 'ordering':
        return <OrderingOptions />;
      case 'multiple_answer':
        return <MultipleAnswerOptions />;
      case 'calculated':
        return <CalculatedOptions />;
      default:
        return null;
    }
  }

  function MultipleChoiceOptions() {
    const options = formData.options?.choices || [
      { id: '1', text: '', isCorrect: false },
      { id: '2', text: '', isCorrect: false },
      { id: '3', text: '', isCorrect: false },
      { id: '4', text: '', isCorrect: false },
    ];

    const updateOption = (index: number, updates: any) => {
      const newOptions = [...options];
      newOptions[index] = { ...newOptions[index], ...updates };
      setFormData({ 
        ...formData, 
        options: { choices: newOptions },
        correct_answer: newOptions.find(o => o.isCorrect)?.id 
      });
    };

    return (
      <div className="space-y-2">
        <Label>Answer Choices</Label>
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <Switch
              checked={option.isCorrect}
              onCheckedChange={(checked) => {
                const newOptions = options.map((o, i) => ({
                  ...o,
                  isCorrect: i === index ? checked : false
                }));
                setFormData({ 
                  ...formData, 
                  options: { choices: newOptions },
                  correct_answer: checked ? option.id : null
                });
              }}
            />
            <Input
              value={option.text}
              onChange={(e) => updateOption(index, { text: e.target.value })}
              placeholder={`Option ${index + 1}`}
              className="flex-1"
            />
          </div>
        ))}
      </div>
    );
  }

  function TrueFalseOptions() {
    return (
      <div>
        <Label>Correct Answer</Label>
        <Select
          value={formData.correct_answer?.value || 'true'}
          onValueChange={(value) => setFormData({ ...formData, correct_answer: { value } })}
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
    );
  }

  function ShortAnswerOptions() {
    const answers = formData.correct_answer?.answers || [''];

    const updateAnswer = (index: number, value: string) => {
      const newAnswers = [...answers];
      newAnswers[index] = value;
      setFormData({ 
        ...formData, 
        correct_answer: { 
          answers: newAnswers,
          caseSensitive: formData.correct_answer?.caseSensitive || false
        } 
      });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label>Acceptable Answers</Label>
          {answers.map((answer, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <Input
                value={answer}
                onChange={(e) => updateAnswer(index, e.target.value)}
                placeholder="Enter acceptable answer"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newAnswers = answers.filter((_, i) => i !== index);
                  setFormData({ 
                    ...formData, 
                    correct_answer: { 
                      ...formData.correct_answer,
                      answers: newAnswers 
                    } 
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormData({ 
                ...formData, 
                correct_answer: { 
                  ...formData.correct_answer,
                  answers: [...answers, ''] 
                } 
              });
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Answer
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.correct_answer?.caseSensitive || false}
            onCheckedChange={(checked) => 
              setFormData({ 
                ...formData, 
                correct_answer: { 
                  ...formData.correct_answer,
                  caseSensitive: checked 
                } 
              })
            }
          />
          <Label>Case Sensitive</Label>
        </div>
      </div>
    );
  }

  function EssayOptions() {
    return (
      <div>
        <Label>Grading Instructions</Label>
        <Textarea
          value={formData.feedback?.gradingInstructions || ''}
          onChange={(e) => setFormData({ 
            ...formData, 
            feedback: { gradingInstructions: e.target.value } 
          })}
          placeholder="Provide grading guidelines for this essay question..."
          rows={3}
        />
      </div>
    );
  }

  // Honest placeholders for question types that do not have an editing UI yet.
  // Creating these types is disabled in the type selector above; an existing
  // question of one of these types keeps its stored options untouched on save.
  function UnavailableTypeNotice({ typeLabel }: { typeLabel: string }) {
    return (
      <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground" role="status">
        Editing {typeLabel} answer options is not yet available. Existing answer options are
        preserved when you save this question.
      </div>
    );
  }
  function MatchingOptions() { return <UnavailableTypeNotice typeLabel="matching" />; }
  function FillBlankOptions() { return <UnavailableTypeNotice typeLabel="fill-in-the-blank" />; }
  function OrderingOptions() { return <UnavailableTypeNotice typeLabel="ordering" />; }
  function MultipleAnswerOptions() { return <UnavailableTypeNotice typeLabel="multiple answer" />; }
  function CalculatedOptions() { return <UnavailableTypeNotice typeLabel="calculated" />; }
};