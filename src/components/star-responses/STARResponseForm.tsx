import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

interface STARResponseFormProps {
  questionId: string;
  question: string;
  onSubmit?: () => void;
}

export const STARResponseForm: React.FC<STARResponseFormProps> = ({
  questionId,
  question,
  onSubmit
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    situation: '',
    task: '',
    action: '',
    result: ''
  });

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('star_responses').insert({
        question_id: questionId,
        situation: formData.situation,
        task: formData.task,
        action: formData.action,
        result: formData.result
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Your STAR response has been saved.',
      });

      if (onSubmit) onSubmit();
      
      // Clear form
      setFormData({
        situation: '',
        task: '',
        action: '',
        result: ''
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save your response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Situation
              <span className="text-xs text-gray-500 ml-2">
                Describe the context and background
              </span>
            </label>
            <Textarea
              value={formData.situation}
              onChange={handleChange('situation')}
              placeholder="Describe the situation you were in..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Task
              <span className="text-xs text-gray-500 ml-2">
                What were you responsible for?
              </span>
            </label>
            <Textarea
              value={formData.task}
              onChange={handleChange('task')}
              placeholder="What was your responsibility or goal?"
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Action
              <span className="text-xs text-gray-500 ml-2">
                What steps did you take?
              </span>
            </label>
            <Textarea
              value={formData.action}
              onChange={handleChange('action')}
              placeholder="Describe the specific actions you took..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Result
              <span className="text-xs text-gray-500 ml-2">
                What was the outcome?
              </span>
            </label>
            <Textarea
              value={formData.result}
              onChange={handleChange('result')}
              placeholder="What were the results of your actions?"
              className="min-h-[100px]"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Response'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}; 