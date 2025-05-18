import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonacoEditor } from './MonacoEditor';
import { Badge } from '@/components/ui/badge';
import { Timer, Code2 } from 'lucide-react';

interface CodeChallengeEditorProps {
  challenge: {
    id: string;
    title: string;
    prompt: string;
    testCases: Array<{
      input: string;
      expected_output: string;
    }>;
    topic_tags: string[];
    difficulty: string;
  };
  onSubmit: (code: string) => void;
}

export function CodeChallengeEditor({ challenge, onSubmit }: CodeChallengeEditorProps) {
  const [code, setCode] = useState('# Write your solution here\n');
  const [isRunning, setIsRunning] = useState(false);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-500/10 text-green-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'hard':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const handleSubmit = async () => {
    setIsRunning(true);
    try {
      await onSubmit(code);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>{challenge.title}</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className={getDifficultyColor(challenge.difficulty)}>
                  {challenge.difficulty}
                </Badge>
                {challenge.topic_tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="prose dark:prose-invert">
              <p>{challenge.prompt}</p>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Code2 className="mr-1 h-4 w-4" />
                <span>Python</span>
              </div>
              <div className="flex items-center">
                <Timer className="mr-1 h-4 w-4" />
                <span>~30 mins</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <MonacoEditor
              code={code}
              language="python"
              onChange={setCode}
              height="400px"
            />
            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit}
                disabled={isRunning}
              >
                {isRunning ? 'Running...' : 'Submit Solution'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {challenge.testCases.map((testCase, index) => (
              <div key={index} className="space-y-2">
                <div className="font-medium">Test Case {index + 1}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Input</div>
                    <pre className="mt-1 rounded-md bg-muted p-2">
                      <code>{testCase.input}</code>
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Expected Output</div>
                    <pre className="mt-1 rounded-md bg-muted p-2">
                      <code>{testCase.expected_output}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 