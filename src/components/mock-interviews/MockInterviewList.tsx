import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MockSession } from '@/types/interview';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';

interface MockInterviewListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MockInterviewList({ className, ...props }: MockInterviewListProps) {
  const [sessions] = useState<MockSession[]>([
    {
      id: '1',
      user1_id: '1',
      user2_id: '2',
      role1: 'interviewee',
      role2: 'interviewer',
      session_time: '2024-03-25T10:00:00Z',
      type: 'behavioral',
      status: 'scheduled',
      created_at: '2024-03-20T10:00:00Z',
    },
    {
      id: '2',
      user1_id: '1',
      user2_id: '3',
      role1: 'interviewer',
      role2: 'interviewee',
      session_time: '2024-03-26T14:00:00Z',
      type: 'technical',
      status: 'scheduled',
      created_at: '2024-03-20T10:00:00Z',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-500';
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'canceled':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (sessions.length === 0) {
    return (
      <Card className={className} {...props}>
        <CardHeader>
          <CardTitle>No Sessions Scheduled</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Schedule a mock interview to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle>
                  {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className={getStatusColor(session.status)}>
                    {session.status}
                  </Badge>
                  <Badge variant="secondary">
                    {session.role1 === 'interviewer' ? 'As Interviewer' : 'As Interviewee'}
                  </Badge>
                </div>
              </div>
              <Button variant="outline">View Details</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                <span>
                  {format(new Date(session.session_time), 'MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                <span>{format(new Date(session.session_time), 'h:mm a')}</span>
              </div>
              <div className="flex items-center">
                <Users className="mr-1 h-4 w-4" />
                <span>John Doe</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 