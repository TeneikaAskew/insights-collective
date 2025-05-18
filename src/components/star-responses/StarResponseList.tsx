import { useState } from 'react';
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

export function StarResponseList() {
  const [responses] = useState<StarResponse[]>([
    {
      id: '1',
      question_id: '1',
      user_id: '1',
      situation: 'While working on a high-traffic e-commerce platform...',
      task: 'I needed to optimize the checkout process...',
      action: 'I analyzed the performance bottlenecks...',
      result: 'The changes resulted in a 40% reduction in checkout time...',
      ai_feedback: {
        clarity_score: 4,
        completeness_score: 5,
        relevance_score: 4,
        feedback: 'Strong response with clear impact metrics.',
        suggestions: [
          'Add more context about the technical challenges',
          'Include specific optimization techniques used',
        ],
      },
      submitted_at: '2024-03-20T10:00:00Z',
    },
  ]);

  const handleEdit = async (id: string) => {
    // Implement edit functionality
    console.log('Edit response:', id);
  };

  const handleDelete = async (id: string) => {
    // Implement delete functionality
    console.log('Delete response:', id);
  };

  if (responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No STAR Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start practicing your behavioral interview responses using the STAR format.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Scores</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="w-[70px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {responses.map((response) => (
          <TableRow key={response.id}>
            <TableCell>
              <div className="space-y-1">
                <p className="font-medium">Tell me about a time you solved a complex technical problem</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {response.situation}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  <span className="text-sm font-medium">
                    {((response.ai_feedback?.clarity_score || 0) +
                      (response.ai_feedback?.completeness_score || 0) +
                      (response.ai_feedback?.relevance_score || 0)) /
                      3}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {response.ai_feedback?.feedback}
                </div>
              </div>
            </TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(response.submitted_at), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(response.id)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Response
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(response.id)}
                    className="text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 