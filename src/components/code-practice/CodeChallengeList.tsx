import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeChallenge } from '@/types/interview';
import { cn } from '@/lib/utils';
import { Code2, Timer } from 'lucide-react';

interface CodeChallengeListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CodeChallengeList({ className, ...props }: CodeChallengeListProps) {
  const [challenges] = useState<CodeChallenge[]>([
    {
      id: '1',
      title: 'Binary Tree Level Order Traversal',
      prompt: 'Given the root of a binary tree, return the level order traversal of its nodes values.',
      test_cases: [
        {
          input: '[3,9,20,null,null,15,7]',
          expected_output: '[[3],[9,20],[15,7]]',
        },
      ],
      topic_tags: ['Binary Tree', 'BFS', 'Tree'],
      difficulty: 'medium',
      created_at: '2024-03-20T10:00:00Z',
    },
    {
      id: '2',
      title: 'Two Sum',
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      test_cases: [
        {
          input: '[2,7,11,15], target = 9',
          expected_output: '[0,1]',
        },
      ],
      topic_tags: ['Array', 'Hash Table'],
      difficulty: 'easy',
      created_at: '2024-03-20T10:00:00Z',
    },
  ]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
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

  if (challenges.length === 0) {
    return (
      <Card className={className} {...props}>
        <CardHeader>
          <CardTitle>No Challenges Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No coding challenges are available at the moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {challenges.map((challenge) => (
        <Card key={challenge.id}>
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
              <Button>Start Challenge</Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{challenge.prompt}</p>
            <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Code2 className="mr-1 h-4 w-4" />
                <span>Python, JavaScript</span>
              </div>
              <div className="flex items-center">
                <Timer className="mr-1 h-4 w-4" />
                <span>~30 mins</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 