import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export function StudyGuideGenerator() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateStudyGuide = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/generate-study-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobDescription }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate study guide');
      }

      const data = await response.json();
      
      toast({
        title: 'Study Guide Generated',
        description: 'Your personalized study guide has been created.',
      });

      // Handle the generated study guide data
      console.log(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate study guide. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Study Guide</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="min-h-[200px]"
        />
        <Button
          onClick={generateStudyGuide}
          disabled={!jobDescription.trim() || loading}
          className="w-full"
        >
          {loading ? 'Generating...' : 'Generate Study Guide'}
        </Button>
      </CardContent>
    </Card>
  );
} 