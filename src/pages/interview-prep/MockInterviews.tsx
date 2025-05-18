import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, Video } from 'lucide-react';

interface AvailabilitySlot {
  id: string;
  user_id: string;
  weekday: number;
  time_block: 'morning' | 'afternoon' | 'evening';
  is_available: boolean;
}

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

interface PeerReview {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rubric_scores: {
    communication: number;
    technical_knowledge: number;
    problem_solving: number;
    overall_impression: number;
  };
  notes: string;
  created_at: string;
}

const TIME_BLOCKS = [
  { value: 'morning', label: 'Morning (9 AM - 12 PM)' },
  { value: 'afternoon', label: 'Afternoon (1 PM - 5 PM)' },
  { value: 'evening', label: 'Evening (6 PM - 9 PM)' },
];

const SESSION_TYPES = [
  { value: 'behavioral', label: 'Behavioral Interview' },
  { value: 'technical', label: 'Technical Interview' },
];

export default function MockInterviews() {
  const { toast } = useToast();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('schedule');
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [selectedRole, setSelectedRole] = useState<'interviewer' | 'interviewee'>('interviewee');

  useEffect(() => {
    loadAvailability();
    loadSessions();
    loadReviews();
  }, []);

  const loadAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error loading availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your availability',
        variant: 'destructive',
      });
    }
  };

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('mock_sessions')
        .select('*')
        .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
        .order('session_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your mock interview sessions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('peer_reviews')
        .select('*')
        .or(`reviewer_id.eq.${user?.id},reviewee_id.eq.${user?.id}`);

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to load peer reviews',
        variant: 'destructive',
      });
    }
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTimeBlock || !selectedType || !selectedRole) {
      toast({
        title: 'Incomplete Form',
        description: 'Please fill out all fields to schedule a mock interview',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Find a matching peer
      const { data: peers, error: peersError } = await supabase
        .from('availability_slots')
        .select('user_id')
        .eq('weekday', selectedDate.getDay())
        .eq('time_block', selectedTimeBlock)
        .eq('is_available', true)
        .neq('user_id', user?.id);

      if (peersError) throw peersError;

      if (!peers || peers.length === 0) {
        toast({
          title: 'No Peers Available',
          description: 'No peers are available at the selected time. Please try another time slot.',
          variant: 'destructive',
        });
        return;
      }

      // Randomly select a peer
      const peer = peers[Math.floor(Math.random() * peers.length)];

      // Create the session
      const { data: session, error: sessionError } = await supabase
        .from('mock_sessions')
        .insert({
          user1_id: user?.id,
          user2_id: peer.user_id,
          role1: selectedRole,
          role2: selectedRole === 'interviewer' ? 'interviewee' : 'interviewer',
          session_time: selectedDate.toISOString(),
          type: selectedType,
          status: 'scheduled',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setSessions(prev => [...prev, session]);
      toast({
        title: 'Session Scheduled',
        description: 'Your mock interview has been scheduled successfully',
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedTimeBlock(undefined);
      setSelectedType(undefined);
      setSelectedRole('interviewee');
    } catch (error) {
      console.error('Error scheduling session:', error);
      toast({
        title: 'Scheduling Error',
        description: 'An error occurred while scheduling the mock interview',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList>
          <TabsTrigger value="schedule">Schedule Interview</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Sessions</TabsTrigger>
          <TabsTrigger value="past">Past Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Schedule a Mock Interview</CardTitle>
                <CardDescription>
                  Select your preferred date, time, and type of interview.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Select Date</h3>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Select Time Block</h3>
                  <Select value={selectedTimeBlock} onValueChange={setSelectedTimeBlock}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time block" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_BLOCKS.map((block) => (
                        <SelectItem key={block.value} value={block.value}>
                          {block.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Interview Type</h3>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interview type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Your Role</h3>
                  <Select value={selectedRole} onValueChange={(value: 'interviewer' | 'interviewee') => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interviewer">Interviewer</SelectItem>
                      <SelectItem value="interviewee">Interviewee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSchedule} className="w-full">
                  Schedule Interview
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Availability</CardTitle>
                <CardDescription>
                  Set your weekly availability for mock interviews.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                    <div key={day} className="space-y-2">
                      <h3 className="font-medium">{day}</h3>
                      <div className="flex flex-wrap gap-2">
                        {TIME_BLOCKS.map((block) => {
                          const isAvailable = availability.some(
                            slot => slot.weekday === index && slot.time_block === block.value && slot.is_available
                          );
                          return (
                            <Badge
                              key={block.value}
                              variant={isAvailable ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                // Toggle availability
                              }}
                            >
                              {block.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upcoming">
          <div className="space-y-8">
            {sessions
              .filter(session => new Date(session.session_time) > new Date() && session.status === 'scheduled')
              .map((session) => (
                <Card key={session.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(session.session_time), 'PPP p')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {session.user1_id === user?.id ? session.role1 : session.role2}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {TIME_BLOCKS.find(block => block.value === session.session_time)?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Paired with {session.user1_id === user?.id ? 'User 2' : 'User 1'}
                          </span>
                        </div>
                      </div>
                      <Button>
                        <Video className="h-4 w-4 mr-2" />
                        Join Room
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {sessions.filter(session => new Date(session.session_time) > new Date() && session.status === 'scheduled').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No upcoming sessions. Schedule a mock interview to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="past">
          <div className="space-y-8">
            {sessions
              .filter(session => new Date(session.session_time) <= new Date() || session.status === 'completed')
              .map((session) => {
                const review = reviews.find(r => r.session_id === session.id);
                return (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(session.session_time), 'PPP p')}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {session.user1_id === user?.id ? session.role1 : session.role2}
                          </Badge>
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {review && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm font-medium">Communication</p>
                              <Badge variant="outline">
                                {review.rubric_scores.communication}/10
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Technical Knowledge</p>
                              <Badge variant="outline">
                                {review.rubric_scores.technical_knowledge}/10
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Problem Solving</p>
                              <Badge variant="outline">
                                {review.rubric_scores.problem_solving}/10
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Overall Impression</p>
                              <Badge variant="outline">
                                {review.rubric_scores.overall_impression}/10
                              </Badge>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Feedback Notes</h4>
                            <p className="text-sm text-muted-foreground">{review.notes}</p>
                          </div>
                        </div>
                      )}

                      {!review && session.status === 'completed' && (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground">
                            No feedback provided yet.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

            {sessions.filter(session => new Date(session.session_time) <= new Date() || session.status === 'completed').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No past sessions. Complete a mock interview to see your history here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 