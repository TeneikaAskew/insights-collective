import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, Video } from 'lucide-react';

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
}

interface TimeBlock {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
}

const TIME_BLOCKS: TimeBlock[] = [
  { id: 'morning', label: 'Morning (9 AM - 12 PM)', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon (1 PM - 5 PM)', startHour: 13, endHour: 17 },
  { id: 'evening', label: 'Evening (6 PM - 9 PM)', startHour: 18, endHour: 21 },
];

export default function MockInterviews() {
  const { toast } = useToast();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'behavioral' | 'technical'>('behavioral');
  const [isInterviewer, setIsInterviewer] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedTimeBlock) {
      loadAvailableUsers();
    }
  }, [selectedDate, selectedTimeBlock, selectedType, isInterviewer]);

  const loadSessions = async () => {
    try {
      const { data: sessions, error } = await supabase
        .from('mock_sessions')
        .select('*')
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('session_time', { ascending: true });

      if (error) throw error;

      setSessions(sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mock interview sessions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    if (!selectedDate || !selectedTimeBlock || !user) return;

    try {
      const timeBlock = TIME_BLOCKS.find((block) => block.id === selectedTimeBlock);
      if (!timeBlock) return;

      const startTime = new Date(selectedDate);
      startTime.setHours(timeBlock.startHour, 0, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(timeBlock.endHour, 0, 0, 0);

      // Get users who are available and have matching preferences
      const { data: availableSlots, error } = await supabase
        .from('availability_slots')
        .select('user_id')
        .eq('weekday', selectedDate.getDay())
        .eq('time_block', selectedTimeBlock)
        .eq('is_available', true);

      if (error) throw error;

      if (availableSlots && availableSlots.length > 0) {
        const userIds = availableSlots.map((slot) => slot.user_id);

        // Get user profiles
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)
          .neq('id', user.id);

        if (profileError) throw profileError;

        setAvailableUsers(profiles || []);
      } else {
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('Error loading available users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users.',
        variant: 'destructive',
      });
    }
  };

  const handleSchedule = async (partnerId: string) => {
    if (!selectedDate || !selectedTimeBlock || !user) return;

    setScheduling(true);
    try {
      const timeBlock = TIME_BLOCKS.find((block) => block.id === selectedTimeBlock);
      if (!timeBlock) return;

      const sessionTime = new Date(selectedDate);
      sessionTime.setHours(timeBlock.startHour, 0, 0, 0);

      const { data: session, error } = await supabase
        .from('mock_sessions')
        .insert({
          user1_id: user.id,
          user2_id: partnerId,
          role1: isInterviewer ? 'interviewer' : 'interviewee',
          role2: isInterviewer ? 'interviewee' : 'interviewer',
          session_time: sessionTime.toISOString(),
          type: selectedType,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;

      setSessions([...sessions, session]);
      toast({
        title: 'Success',
        description: 'Mock interview session scheduled successfully.',
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedTimeBlock('');
      setSelectedType('behavioral');
      setIsInterviewer(false);
    } catch (error) {
      console.error('Error scheduling session:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule mock interview session.',
        variant: 'destructive',
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    // Navigate to the mock interview room
    window.location.href = `/mock-interview/${sessionId}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Mock Interviews</h1>
        <p className="text-muted-foreground">
          Schedule and participate in mock interviews with peers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Schedule New Session</CardTitle>
              <CardDescription>
                Find available peers for mock interviews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label>Select Date</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                    disabled={(date) => date < new Date()}
                  />
                </div>

                <div>
                  <Label>Time Block</Label>
                  <Select value={selectedTimeBlock} onValueChange={setSelectedTimeBlock}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time block" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_BLOCKS.map((block) => (
                        <SelectItem key={block.id} value={block.id}>
                          {block.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Interview Type</Label>
                  <Select value={selectedType} onValueChange={(value: 'behavioral' | 'technical') => setSelectedType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interview type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="role-switch"
                    checked={isInterviewer}
                    onCheckedChange={setIsInterviewer}
                  />
                  <Label htmlFor="role-switch">I want to be the interviewer</Label>
                </div>

                {availableUsers.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Available Users</h3>
                    {availableUsers.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-md"
                      >
                        <div>
                          <p className="font-medium">{profile.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {profile.title || 'No title'}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleSchedule(profile.id)}
                          disabled={scheduling}
                        >
                          {scheduling ? <Spinner size="sm" /> : 'Schedule'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  selectedDate && selectedTimeBlock && (
                    <p className="text-sm text-muted-foreground">
                      No users available for the selected time slot.
                    </p>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>
                Your scheduled mock interview sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming sessions scheduled.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border rounded-md space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={session.type === 'behavioral' ? 'default' : 'secondary'}>
                          {session.type}
                        </Badge>
                        <Badge
                          variant={
                            session.status === 'scheduled'
                              ? 'outline'
                              : session.status === 'completed'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {session.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          {format(new Date(session.session_time), 'MMMM d, yyyy')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(new Date(session.session_time), 'h:mm a')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span>
                          You are the{' '}
                          {session.user1_id === user?.id ? session.role1 : session.role2}
                        </span>
                      </div>

                      {session.status === 'scheduled' && (
                        <Button
                          className="w-full mt-2"
                          onClick={() => handleJoinSession(session.id)}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Join Session
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 