
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Check, 
  FileText, 
  Upload, 
  List, 
  Plus, 
  Trash, 
  AlertCircle 
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

type QuizOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuizQuestionData = {
  questionType: 'multiple-choice' | 'text' | 'file-upload';
  multipleCorrect: boolean;
  options: QuizOption[];
  points: number;
};

interface QuizOptionsFormProps {
  onChange: (data: QuizQuestionData) => void;
  initialData?: Partial<QuizQuestionData>;
}

const QuizOptionsForm = ({ onChange, initialData }: QuizOptionsFormProps) => {
  const [questionType, setQuestionType] = useState<'multiple-choice' | 'text' | 'file-upload'>(
    initialData?.questionType || 'multiple-choice'
  );
  const [multipleCorrect, setMultipleCorrect] = useState<boolean>(
    initialData?.multipleCorrect || false
  );
  const [options, setOptions] = useState<QuizOption[]>(
    initialData?.options || [
      { id: '1', text: '', isCorrect: false },
      { id: '2', text: '', isCorrect: false }
    ]
  );
  const [points, setPoints] = useState<number>(initialData?.points || 1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Ensure we always have at least 2 options for multiple choice
  useEffect(() => {
    if (questionType === 'multiple-choice' && options.length < 2) {
      const newOptions = [...options];
      while (newOptions.length < 2) {
        newOptions.push({ id: Date.now().toString(), text: '', isCorrect: false });
      }
      setOptions(newOptions);
    }
  }, [questionType, options]);

  // Validate and update parent component when data changes
  useEffect(() => {
    // Validation for multiple choice
    if (questionType === 'multiple-choice') {
      const hasCorrectOption = options.some(option => option.isCorrect);
      const hasEmptyOptions = options.some(option => !option.text.trim());
      
      if (!hasCorrectOption) {
        setValidationError('At least one option must be marked as correct');
      } else if (hasEmptyOptions) {
        setValidationError('All options must have text');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }

    // Update parent component
    onChange({
      questionType,
      multipleCorrect,
      options,
      points
    });
  }, [questionType, multipleCorrect, options, points, onChange]);

  const handleOptionChange = (id: string, field: 'text' | 'isCorrect', value: string | boolean) => {
    setOptions(prevOptions => 
      prevOptions.map(option => 
        option.id === id ? { ...option, [field]: value } : option
      )
    );
  };

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, { id: Date.now().toString(), text: '', isCorrect: false }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(option => option.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>Question Type</Label>
        <RadioGroup 
          value={questionType}
          onValueChange={(value) => setQuestionType(value as any)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple-choice" id="multiple-choice" />
            <Label htmlFor="multiple-choice" className="flex items-center">
              <List className="h-4 w-4 mr-2" /> Multiple Choice
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="text" />
            <Label htmlFor="text" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" /> Open Text
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="file-upload" id="file-upload" />
            <Label htmlFor="file-upload" className="flex items-center">
              <Upload className="h-4 w-4 mr-2" /> File Upload
            </Label>
          </div>
        </RadioGroup>
      </div>

      {questionType === 'multiple-choice' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch 
              checked={multipleCorrect}
              onCheckedChange={setMultipleCorrect}
              id="multi-select"
            />
            <Label htmlFor="multi-select">
              Allow multiple correct answers
            </Label>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Answer Options (2-5)</Label>
              {options.length < 5 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addOption}
                  className="flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Option
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-start space-x-2">
                  <div className="flex-1">
                    <div className="flex space-x-2 items-center">
                      {multipleCorrect ? (
                        <Checkbox 
                          checked={option.isCorrect}
                          onCheckedChange={(checked) => 
                            handleOptionChange(option.id, 'isCorrect', Boolean(checked))
                          }
                          id={`option-${option.id}`}
                        />
                      ) : (
                        <RadioGroup 
                          value={options.find(o => o.isCorrect)?.id || ''}
                          onValueChange={(value) => {
                            setOptions(options.map(o => ({
                              ...o,
                              isCorrect: o.id === value
                            })));
                          }}
                          className="flex"
                        >
                          <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                        </RadioGroup>
                      )}
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => handleOptionChange(option.id, 'text', e.target.value)}
                        className="flex-1"
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {questionType === 'text' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Students will answer with free text
            </div>
          </CardContent>
        </Card>
      )}

      {questionType === 'file-upload' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Students will upload a file as their answer
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="points">Points</Label>
        <Input
          id="points"
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value) || 1)}
          className="w-full max-w-[100px]"
        />
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default QuizOptionsForm;
