import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Users } from 'lucide-react';

interface UpcomingSessionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UpcomingSessions({ className, ...props }: UpcomingSessionsProps) {
  // This would be fetched from your backend in a real application
  const upcomingSessions = [
    {
      id: '1',
      type: 'Behavioral',
      date: '2024-03-25',
      time: '10:00 AM',
      partner: 'John Doe',
      role: 'interviewer',
    },
    {
      id: '2',
      type: 'Technical',
      date: '2024-03-26',
      time: '2:00 PM',
      partner: 'Jane Smith',
      role: 'interviewee',
    },
  ];

  return (
    <Card className={cn('col-span-3', className)} {...props}>
      <CardHeader>
        <CardTitle>Upcoming Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions scheduled.
            </p>
          ) : (
            upcomingSessions.map((session) => (
              <div key={session.id} className="flex items-start space-x-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
                  <Users className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {session.type} Interview ({session.role})
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{session.date}</span>
                    <Clock className="h-4 w-4 ml-2" />
                    <span>{session.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    with {session.partner}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
} 