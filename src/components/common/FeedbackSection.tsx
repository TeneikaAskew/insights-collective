
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useFeedbackSubmission, FEEDBACK_CATEGORIES } from '@/hooks/useFeedbackSubmission';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackSectionProps {
  pagePath: string;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ pagePath }) => {
  const [wasUseful, setWasUseful] = useState<boolean | null>(null);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { submitFeedback, isLoading } = useFeedbackSubmission(pagePath);

  const handleSubmit = async () => {
    if (wasUseful !== null) {
      await submitFeedback(
        wasUseful, 
        additionalFeedback || undefined, 
        selectedCategory || undefined
      );
      
      // Reset state after submission
      setWasUseful(null);
      setAdditionalFeedback('');
      setSelectedCategory('');
    }
  };

  return (
    <div className="bg-muted/30 p-6 rounded-lg mt-8 space-y-4">
      <h3 className="text-lg font-semibold">Was this information useful?</h3>
      
      <div className="flex space-x-4">
        <Button 
          variant={wasUseful === true ? 'default' : 'outline'}
          onClick={() => setWasUseful(true)}
          className="flex items-center gap-2"
        >
          <ThumbsUp className="h-4 w-4" /> Yes
        </Button>
        <Button 
          variant={wasUseful === false ? 'destructive' : 'outline'}
          onClick={() => setWasUseful(false)}
          className="flex items-center gap-2"
        >
          <ThumbsDown className="h-4 w-4" /> No
        </Button>
      </div>

      {wasUseful !== null && (
        <div className="space-y-4">
          <Select 
            value={selectedCategory} 
            onValueChange={setSelectedCategory}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${wasUseful ? 'why it was useful' : 'what was not helpful'}`} />
            </SelectTrigger>
            <SelectContent>
              {(wasUseful 
                ? FEEDBACK_CATEGORIES.useful 
                : FEEDBACK_CATEGORIES.notUseful
              ).map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea 
            placeholder="Would you like to provide more detailed feedback?"
            value={additionalFeedback}
            onChange={(e) => setAdditionalFeedback(e.target.value)}
          />

          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
          >
            Submit Feedback
          </Button>
        </div>
      )}
    </div>
  );
};
