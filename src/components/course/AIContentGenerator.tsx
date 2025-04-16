
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIContentGeneratorProps {
  courseId: string | undefined;
  courseTitle: string;
  courseLevel: string;
}

const AIContentGenerator = ({ courseId, courseTitle, courseLevel }: AIContentGeneratorProps) => {
  const [moduleTab, setModuleTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const { toast } = useToast();

  // Function to simulate AI-generated content
  const generateContent = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt to generate content',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll simulate the generation with setTimeout
      
      setTimeout(() => {
        const contentType = moduleTab === 'overview' ? 'course overview' : 'module content';
        const targetAudience = prompt.trim() || 'data science professionals';
        const level = courseLevel || 'Beginner';
        
        let generatedText = '';
        
        if (moduleTab === 'overview') {
          generatedText = `# ${courseTitle || 'Course'} Overview\n\nThis comprehensive ${level.toLowerCase()} course is designed for ${targetAudience}. Students will learn essential concepts and practical applications through hands-on exercises and real-world examples.\n\n## What You'll Learn\n\n- Fundamental principles and key concepts\n- Industry-standard tools and methodologies\n- Practical applications and case studies\n- Best practices and optimization techniques\n\n## Course Prerequisites\n\n- Basic understanding of related concepts\n- Familiarity with common tools in the field`;
        } else {
          generatedText = `# Module: Introduction to ${prompt}\n\n## Learning Objectives\n\n- Understand the core concepts of ${prompt}\n- Apply theoretical knowledge to practical scenarios\n- Analyze and solve common problems in the field\n\n## Content Outline\n\n### 1. Foundations and Key Principles\n- Historical context and development\n- Core theoretical frameworks\n- Modern applications and relevance\n\n### 2. Practical Techniques\n- Methodology and approach\n- Hands-on implementation\n- Troubleshooting common issues\n\n### 3. Case Studies\n- Real-world examples\n- Analysis and discussion\n- Lessons learned and best practices`;
        }
        
        setGeneratedContent(generatedText);
        setIsGenerating(false);
        
        toast({
          title: 'Content Generated',
          description: `AI-generated ${contentType} is ready to use`,
        });
      }, 1500);
      
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate content. Please try again.',
        variant: 'destructive',
      });
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Content Assistant</CardTitle>
        <CardDescription>
          Generate course content using AI suggestions. The generated content is a starting point that you can edit and enhance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={moduleTab} onValueChange={setModuleTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Course Overview</TabsTrigger>
            <TabsTrigger value="module">Module Content</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div>
              <Label htmlFor="overview-prompt">Target Audience</Label>
              <Input
                id="overview-prompt"
                placeholder="e.g., data science professionals, software engineers, etc."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground">
                Specify the target audience for this course to generate a relevant overview.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="module" className="space-y-4">
            <div>
              <Label htmlFor="module-prompt">Module Topic</Label>
              <Input
                id="module-prompt"
                placeholder="e.g., Data Visualization, Machine Learning Fundamentals, etc."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground">
                Enter a specific topic to generate content for a course module.
              </p>
            </div>
          </TabsContent>
          
          <div className="pt-2">
            <Button
              onClick={generateContent}
              disabled={isGenerating}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Suggest with AI
                </>
              )}
            </Button>
          </div>
          
          {generatedContent && (
            <div className="mt-6">
              <Label htmlFor="generated-content">Generated Content</Label>
              <Textarea
                id="generated-content"
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground mt-2">
                This content is AI-generated. Feel free to edit and refine it to better fit your needs.
              </p>
            </div>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AIContentGenerator;
