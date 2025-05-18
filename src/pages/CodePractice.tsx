import React, { useState } from 'react';
import { CodeChallengeList } from '@/components/code-practice/CodeChallengeList';
import { CodeChallengeEditor } from '@/components/code-practice/CodeChallengeEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodingStats } from '@/components/code-practice/CodingStats';

export const CodePractice: React.FC = () => {
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('challenges');

  const challenges = [
    {
      id: '1',
      title: 'Binary Tree Level Order Traversal',
      prompt: 'Given the root of a binary tree, return the level order traversal of its nodes values.',
      testCases: [
        {
          input: '[3,9,20,null,null,15,7]',
          expected_output: '[[3],[9,20],[15,7]]',
        },
      ],
      topic_tags: ['Binary Tree', 'BFS', 'Tree'],
      difficulty: 'medium',
    },
    {
      id: '2',
      title: 'Two Sum',
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      testCases: [
        {
          input: '[2,7,11,15], target = 9',
          expected_output: '[0,1]',
        },
      ],
      topic_tags: ['Array', 'Hash Table'],
      difficulty: 'easy',
    },
  ];

  const handleChallengeSelect = (challengeId: string) => {
    setSelectedChallenge(challengeId);
    setActiveTab('editor');
  };

  const selectedChallengeData = challenges.find(c => c.id === selectedChallenge);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Code Practice</h1>
          <CodingStats />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="editor" disabled={!selectedChallenge}>
              Code Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="challenges">
            <Card>
              <CardHeader>
                <CardTitle>Available Challenges</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeChallengeList
                  onChallengeSelect={handleChallengeSelect}
                  challenges={challenges}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editor">
            {selectedChallengeData && (
              <CodeChallengeEditor
                title={selectedChallengeData.title}
                prompt={selectedChallengeData.prompt}
                testCases={selectedChallengeData.testCases}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}; 