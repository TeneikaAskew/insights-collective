import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash, Star } from 'lucide-react';
import { StarResponse } from '@/types/interview';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

interface STARResponse {
  id: string;
  question_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  ai_feedback: {
    clarity: number;
    completeness: number;
    relevance: number;
    suggestions: string[];
  } | null;
  submitted_at: string;
}

export const STARResponseList: React.FC = () => {
  const [responses, setResponses] = useState<STARResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('star_responses')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching STAR responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderFeedback = (feedback: STARResponse['ai_feedback']) => {
    if (!feedback) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">AI Feedback</h4>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Clarity</div>
            <div className="text-lg font-medium">{feedback.clarity}/10</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Completeness</div>
            <div className="text-lg font-medium">{feedback.completeness}/10</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Relevance</div>
            <div className="text-lg font-medium">{feedback.relevance}/10</div>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 mb-2">Suggestions for Improvement</div>
          <ul className="list-disc list-inside space-y-1">
            {feedback.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm">{suggestion}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading responses...</div>;
  }

  return (
    <div className="space-y-6">
      {responses.map((response) => (
        <Card key={response.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              Response from {new Date(response.submitted_at).toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Situation</h4>
                <p className="text-gray-700">{response.situation}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Task</h4>
                <p className="text-gray-700">{response.task}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Action</h4>
                <p className="text-gray-700">{response.action}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Result</h4>
                <p className="text-gray-700">{response.result}</p>
              </div>
              {renderFeedback(response.ai_feedback)}
            </div>
          </CardContent>
        </Card>
      ))}
      {responses.length === 0 && (
        <div className="text-center text-gray-500">
          No STAR responses yet. Start practicing by adding your first response!
        </div>
      )}
    </div>
  );
}; 