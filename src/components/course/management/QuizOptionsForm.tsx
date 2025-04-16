
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, Plus, Trash2, FileText, Upload, List } from 'lucide-react';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizOptionsFormProps {
  onUpdate: (options: {
    type: 'multiple-choice' | 'text' | 'file-upload';
    isMultiSelect: boolean;
    options: QuizOption[];
  }) => void;
}

export const QuizOptionsForm = ({ onUpdate }: QuizOptionsFormProps) => {
  const [answerType, setAnswerType] = useState<'multiple-choice' | 'text' | 'file-upload'>('multiple-choice');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [options, setOptions] = useState<QuizOption[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false }
  ]);

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, { id: Math.random().toString(), text: '', isCorrect: false }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(opt => opt.id !== id));
    }
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  const toggleCorrect = (id: string) => {
    setOptions(options.map(opt => {
      if (opt.id === id) {
        return { ...opt, isCorrect: !opt.isCorrect };
      }
      if (!isMultiSelect) {
        return { ...opt, isCorrect: false };
      }
      return opt;
    }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Label>Answer Type</Label>
        <RadioGroup
          defaultValue="multiple-choice"
          onValueChange={(value) => setAnswerType(value as any)}
          className="grid grid-cols-3 gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple-choice" id="multiple-choice" />
            <Label htmlFor="multiple-choice">
              <List className="h-4 w-4 inline mr-2" />
              Multiple Choice
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="text" />
            <Label htmlFor="text">
              <FileText className="h-4 w-4 inline mr-2" />
              Open Text
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="file-upload" id="file-upload" />
            <Label htmlFor="file-upload">
              <Upload className="h-4 w-4 inline mr-2" />
              File Upload
            </Label>
          </div>
        </RadioGroup>
      </div>

      {answerType === 'multiple-choice' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="multi-select"
              checked={isMultiSelect}
              onCheckedChange={() => setIsMultiSelect(!isMultiSelect)}
            />
            <Label htmlFor="multi-select">Allow multiple correct answers</Label>
          </div>

          <div className="space-y-4">
            {options.map((option, index) => (
              <div key={option.id} className="flex items-center space-x-2">
                <div className="flex-1">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                  />
                </div>
                <Checkbox
                  checked={option.isCorrect}
                  onCheckedChange={() => toggleCorrect(option.id)}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(option.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {options.length < 5 && (
            <Button
              variant="outline"
              onClick={addOption}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          )}

          {options.filter(opt => opt.isCorrect).length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <p>Please select at least one correct answer</p>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};
