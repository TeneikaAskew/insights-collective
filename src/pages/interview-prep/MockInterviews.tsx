
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, User } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface MockSession {
  id: string;
  user1_id: string;
  user2_id: string;
  role1: 'interviewer' | 'interviewee';
  role2: 'interviewer' | 'interviewee';
  session_time: string;
  type: 'behavioral' | 'technical';
  status: 'scheduled' | 'completed' | 'canceled';
  study_guide_id: string | null;
  user1_profile: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  user2_profile: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
}

export default function MockInterviews() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [user?.id]);

  const loadSessions = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('mock_sessions')
        .select(`
          *,
          user1_profile: profiles!user1_id(*),
          user2_profile: profiles!user2_id(*)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('session_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading mock sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mock interview sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const joinSession = (sessionId: string) => {
    navigate(`/interview-prep/mock-interview/${sessionId}`);
  };

  const scheduleSession = () => {
    // This would open a modal to schedule a new session
    toast({
      title: 'Coming Soon',
      description: 'The scheduling functionality will be available soon',
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mock Interviews</h1>
            <p className="text-muted-foreground">
              Practice interviews with peers to prepare for the real thing.
            </p>
          </div>
          <Button onClick={scheduleSession}>Schedule Mock Interview</Button>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                You don't have any mock interview sessions scheduled yet. 
                Click the button above to schedule one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Your Sessions</h2>
            {sessions.map((session) => {
              const isUser1 = session.user1_id === user?.id;
              const partnerProfile = isUser1 ? session.user2_profile : session.user1_profile;
              const userRole = isUser1 ? session.role1 : session.role2;
              const sessionTime = new Date(session.session_time);
              const isPast = sessionTime < new Date();
              
              return (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>
                          {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
                        </CardTitle>
                        <CardDescription>
                          Session {session.status === 'completed' ? 'completed' : 'scheduled'}
                        </CardDescription>
                      </div>
                      <Badge variant={session.status === 'completed' ? 'outline' : 'default'}>
                        {session.status === 'scheduled' ? 'Upcoming' : 
                         session.status === 'completed' ? 'Completed' : 'Canceled'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(sessionTime, 'PPP')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(sessionTime, 'p')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          With: {partnerProfile ? 
                            `${partnerProfile.first_name} ${partnerProfile.last_name}` : 
                            'Unknown User'}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Badge variant="outline">
                          You are the {userRole}
                        </Badge>
                        {session.status === 'scheduled' && !isPast && (
                          <Button onClick={() => joinSession(session.id)}>
                            Join Session
                          </Button>
                        )}
                        {session.status === 'scheduled' && isPast && (
                          <Button onClick={() => joinSession(session.id)}>
                            View Session
                          </Button>
                        )}
                        {session.status === 'completed' && (
                          <Button variant="outline" onClick={() => joinSession(session.id)}>
                            View Feedback
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
