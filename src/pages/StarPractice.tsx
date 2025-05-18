import React, { useState } from 'react';
import { STARResponseForm } from '@/components/star-responses/STARResponseForm';
import { STARResponseList } from '@/components/star-responses/STARResponseList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const StarPractice: React.FC = () => {
  const [activeTab, setActiveTab] = useState('practice');

  const sampleQuestions = [
    {
      id: '1',
      text: 'Tell me about a time when you had to solve a complex technical problem.',
    },
    {
      id: '2',
      text: 'Describe a situation where you had to work with a difficult team member.',
    },
    {
      id: '3',
      text: 'Share an example of when you had to meet a tight deadline.',
    },
    {
      id: '4',
      text: 'Tell me about a time you had to learn a new technology quickly.',
    },
  ];

  const handleResponseSubmitted = () => {
    setActiveTab('responses');
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">STAR Response Practice</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What is the STAR Method?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              The STAR method is a structured way to respond to behavioral interview questions:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Situation</h3>
                <p className="text-sm text-gray-600">
                  Set the scene and provide context about the specific situation.
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Task</h3>
                <p className="text-sm text-gray-600">
                  Explain your responsibility or what was required of you.
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Action</h3>
                <p className="text-sm text-gray-600">
                  Describe the specific steps you took to address the situation.
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Result</h3>
                <p className="text-sm text-gray-600">
                  Share the outcomes of your actions and what you learned.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="responses">My Responses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="practice">
            <div className="space-y-8">
              {sampleQuestions.map((question) => (
                <STARResponseForm
                  key={question.id}
                  questionId={question.id}
                  question={question.text}
                  onSubmit={handleResponseSubmitted}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="responses">
            <STARResponseList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}; 