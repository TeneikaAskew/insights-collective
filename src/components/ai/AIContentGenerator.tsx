
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wand2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIContentGeneratorProps {
  onContentGenerated: (content: string) => void;
  contextType: 'course' | 'module' | 'lesson';
  buttonVariant?: 'default' | 'outline' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg';
  className?: string;
}

const AIContentGenerator = ({
  onContentGenerated,
  contextType,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className = '',
}: AIContentGeneratorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Default prompts based on context
  const defaultPrompts = {
    course: "Write a comprehensive course description for a course about [topic] for [audience] level students.",
    module: "Create a detailed module overview about [topic] for a [audience] level course.",
    lesson: "Write a lesson plan about [specific topic] for [audience] level students."
  };

  const generateContent = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Empty Prompt",
        description: "Please enter a prompt to generate content.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Mock API call for now - in production, connect to an actual AI service
      // In a real implementation, this would call an edge function or API
      setTimeout(() => {
        const mockResponses = {
          course: `# Course Overview\n\nThis comprehensive course explores the fascinating world of ${
            prompt.includes('topic') ? prompt.split('topic')[1]?.split(' ')[0] || 'the selected topic' : 'the selected topic'
          }. Students will gain practical skills through hands-on projects and theoretical knowledge through expert lectures.\n\n## Learning Outcomes\n\n- Understand core principles and methodologies\n- Apply practical techniques to real-world scenarios\n- Develop critical thinking and analytical skills\n- Master the latest tools and technologies in the field`,
          module: `# Module Overview\n\nThis module focuses on key aspects of ${
            prompt.includes('topic') ? prompt.split('topic')[1]?.split(' ')[0] || 'the selected topic' : 'the selected topic'
          }. Students will explore practical applications and theoretical frameworks.\n\n## Module Objectives\n\n- Grasp fundamental concepts\n- Implement practical techniques\n- Analyze case studies and examples\n- Complete hands-on exercises`,
          lesson: `# Lesson Plan\n\nThis lesson introduces students to ${
            prompt.includes('specific topic') ? prompt.split('specific topic')[1]?.split(' ')[0] || 'this specific topic' : 'this specific topic'
          }. Through guided examples and interactive activities, students will develop a thorough understanding of the subject matter.\n\n## Lesson Structure\n\n1. Introduction (10 minutes)\n2. Key Concepts (20 minutes)\n3. Practical Exercise (30 minutes)\n4. Discussion and Q&A (15 minutes)\n5. Summary and Next Steps (5 minutes)`
        };

        setGeneratedContent(mockResponses[contextType]);
        setIsGenerating(false);
      }, 1500);
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating content. Please try again.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  const handleUseContent = () => {
    onContentGenerated(generatedContent);
    setIsOpen(false);
    setPrompt('');
    setGeneratedContent('');
    toast({
      title: "Content Applied",
      description: `The AI-generated ${contextType} content has been added.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={buttonVariant} 
          size={buttonSize}
          className={`flex items-center ${className}`}
          onClick={() => {
            setPrompt(defaultPrompts[contextType]);
            setGeneratedContent('');
          }}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Suggest with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI Content Generator</DialogTitle>
          <DialogDescription>
            Use AI to suggest content for your {contextType}. Customize the prompt or use the default.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={defaultPrompts[contextType]}
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">
              Replace [topic], [audience], etc. with specific details for better results.
            </p>
          </div>
          
          <Button 
            onClick={generateContent} 
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Content'
            )}
          </Button>
          
          {generatedContent && (
            <div className="grid gap-2 mt-4">
              <Label htmlFor="generated-content">Generated Content</Label>
              <Textarea
                id="generated-content"
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[200px]"
                readOnly={isGenerating}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUseContent} 
            disabled={!generatedContent || isGenerating}
          >
            Use This Content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIContentGenerator;
