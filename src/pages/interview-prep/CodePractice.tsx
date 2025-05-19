
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Editor from '@monaco-editor/react';
import { Badge } from '@/components/ui/badge';
import { Check, Code } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

export default function CodePractice() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('question');
  const [code, setCode] = useState('// Write your solution here');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleCodeChange = (value) => {
    setCode(value);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Implement code submission and evaluation logic
      // This would typically call an API endpoint
      
      // Simulating API call with timeout
      setTimeout(() => {
        setFeedback({
          correct: true,
          runtime: '42ms',
          memory: '8.2MB',
          feedback: 'Your solution is correct and efficient.',
          suggestions: [
            'Consider handling edge cases for empty arrays',
            'You could optimize space complexity further'
          ]
        });
        setActiveTab('feedback');
        setLoading(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting code:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit code. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Code Challenge Practice</h1>
          <p className="text-muted-foreground">
            Practice technical coding challenges with real-time feedback.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Two Sum</CardTitle>
                <CardDescription>Easy</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
                  You may assume that each input would have exactly one solution, and you may not use the same element twice.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Example:</h3>
                    <pre className="bg-muted p-2 rounded-md text-xs">
                      Input: nums = [2,7,11,15], target = 9<br/>
                      Output: [0,1]<br/>
                      Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Constraints:</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>2 &lt;= nums.length &lt;= 10^4</li>
                      <li>-10^9 &lt;= nums[i] &lt;= 10^9</li>
                      <li>-10^9 &lt;= target &lt;= 10^9</li>
                      <li>Only one valid answer exists.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="question">Problem</TabsTrigger>
                    <TabsTrigger value="code">Code Editor</TabsTrigger>
                    <TabsTrigger value="feedback" disabled={!feedback}>Feedback</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0">
                  <TabsContent value="question">
                    <div className="prose max-w-none">
                      <h3>Two Sum</h3>
                      <p>
                        This is a classic algorithmic problem that appears frequently in technical interviews. 
                        The problem asks you to find two numbers in an array that add up to a target value.
                      </p>
                      <p>
                        A naive approach would be to use nested loops to check every pair of numbers, 
                        but this would have a time complexity of O(n²). Can you think of a more efficient solution?
                      </p>
                      <h4>Hints:</h4>
                      <ol>
                        <li>Consider using a hash map to store values you've seen so far.</li>
                        <li>For each number, check if its complement (target - num) exists in the hash map.</li>
                        <li>This can be solved in a single pass through the array.</li>
                      </ol>
                      
                      <Button onClick={() => setActiveTab('code')} className="mt-4">
                        Start Coding
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="code">
                    <div className="h-[500px] border rounded-md">
                      <Editor
                        height="100%"
                        language="javascript"
                        theme="vs-dark"
                        value={code}
                        onChange={handleCodeChange}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Spinner size="sm" className="mr-2" /> : null}
                        Submit Solution
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="feedback">
                    {feedback && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {feedback.correct ? (
                              <Badge className="bg-green-100 text-green-800 mr-2">
                                <Check className="h-4 w-4 mr-1" />
                                Correct
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="mr-2">
                                Incorrect
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs">
                              <span className="font-medium">Runtime:</span> {feedback.runtime}
                            </div>
                            <div className="text-xs">
                              <span className="font-medium">Memory:</span> {feedback.memory}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-2">Code Review</h3>
                          <p className="text-sm">{feedback.feedback}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-2">Suggestions</h3>
                          <ul className="list-disc list-inside space-y-1">
                            {feedback.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button variant="outline" onClick={() => setActiveTab('code')}>
                            <Code className="h-4 w-4 mr-2" />
                            Continue Editing
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
