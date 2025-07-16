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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { format, addHours, parseISO, set } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, Video, ChevronLeft, BookText, ExternalLink } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { AvailabilityManager } from '@/components/interview-prep/AvailabilityManager';

import { createLogger } from '@/utils/logger';

const logger = createLogger('MockInterviews');

interface MockSession {
  id: string;
  user1_id: string;
  user2_id: string;
  role1: 'interviewer' | 'interviewee';
  role2: 'interviewer' | 'interviewee';
  session_time: string;
  end_time: string;
  type: 'behavioral' | 'technical';
  status: 'scheduled' | 'completed' | 'canceled';
  study_guide_id: string | null;
  video_platform: string;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: 'slot_8_9', startTime: '8:00 AM', endTime: '9:00 AM', label: '8:00 AM' },
  { id: 'slot_9_10', startTime: '9:00 AM', endTime: '10:00 AM', label: '9:00 AM' },
  { id: 'slot_10_11', startTime: '10:00 AM', endTime: '11:00 AM', label: '10:00 AM' },
  { id: 'slot_11_12', startTime: '11:00 AM', endTime: '12:00 PM', label: '11:00 AM' },
  { id: 'slot_12_13', startTime: '12:00 PM', endTime: '1:00 PM', label: '12:00 PM' },
  { id: 'slot_13_14', startTime: '1:00 PM', endTime: '2:00 PM', label: '1:00 PM' },
  { id: 'slot_14_15', startTime: '2:00 PM', endTime: '3:00 PM', label: '2:00 PM' },
  { id: 'slot_15_16', startTime: '3:00 PM', endTime: '4:00 PM', label: '3:00 PM' },
  { id: 'slot_16_17', startTime: '4:00 PM', endTime: '5:00 PM', label: '4:00 PM' },
  { id: 'slot_17_18', startTime: '5:00 PM', endTime: '6:00 PM', label: '5:00 PM' },
  { id: 'slot_18_19', startTime: '6:00 PM', endTime: '7:00 PM', label: '6:00 PM' },
  { id: 'slot_19_20', startTime: '7:00 PM', endTime: '8:00 PM', label: '7:00 PM' },
  { id: 'slot_20_21', startTime: '8:00 PM', endTime: '9:00 PM', label: '8:00 PM' },
];

export default function MockInterviews() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'behavioral' | 'technical'>('behavioral');
  const [isInterviewer, setIsInterviewer] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [previousSessions, setPreviousSessions] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [hasSetAvailability, setHasSetAvailability] = useState(false);

  useEffect(() => {
    if (user) {
      loadSessions();
      checkAvailabilityStatus();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDate && selectedTimeSlot && user) {
      loadAvailableUsers();
    } else {
      setAvailableUsers([]);
    }
  }, [selectedDate, selectedTimeSlot, selectedType, isInterviewer, user]);

  const checkAvailabilityStatus = async () => {
    if (!user?.id) return;
    
    try {
      const { data: availabilitySlots, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      
      setHasSetAvailability(availabilitySlots && availabilitySlots.length > 0);
    } catch (error: any) {
      logger.error('Error checking availability status:', error);
    }
  };

  const loadSessions = async () => {
    if (!user?.id) return;
    
    try {
      const { data: sessions, error } = await supabase
        .from('mock_sessions')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('session_time', { ascending: true });

      if (error) throw error;

      // Calculate previous sessions with each partner
      const sessionCounts: Record<string, number> = {};
      sessions?.forEach(session => {
        const partnerId = session.user1_id === user.id ? session.user2_id : session.user1_id;
        sessionCounts[partnerId] = (sessionCounts[partnerId] || 0) + 1;
      });

      setPreviousSessions(sessionCounts);
      setSessions(sessions || []);
    } catch (error: any) {
      logger.error('Error loading sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mock interview sessions: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeFromSlotId = (slotId: string): { hour: number, minute: number } => {
    const slot = TIME_SLOTS.find(s => s.id === slotId);
    if (!slot) return { hour: 8, minute: 0 }; // Default to 8:00 AM
    
    const timeStr = slot.startTime;
    const isPM = timeStr.includes('PM') && !timeStr.includes('12:00');
    const [hourStr, minuteStr] = timeStr.replace(/ AM| PM/g, '').split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    return { hour, minute };
  };

  const loadAvailableUsers = async () => {
    if (!selectedDate || !selectedTimeSlot || !user) return;

    try {
      // Get the weekday (0-6, where 0 is Sunday)
      const weekday = selectedDate.getDay();

      // Get users who are available for this specific time slot and weekday
      const { data: availableSlots, error } = await supabase
        .from('availability_slots')
        .select('user_id')
        .eq('weekday', weekday)
        .eq('time_slot', selectedTimeSlot)
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
      logger.error('Error loading available users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users.',
        variant: 'destructive',
      });
    }
  };

  const handleSchedule = async (partnerId: string) => {
    if (!selectedDate || !selectedTimeSlot || !user?.id) return;

    setScheduling(true);
    try {
      // Get the time details from the selected slot
      const { hour, minute } = getTimeFromSlotId(selectedTimeSlot);
      
      // Create session time (start time)
      const sessionTime = new Date(selectedDate);
      sessionTime.setHours(hour, minute, 0, 0);
      
      // Calculate end time (1 hour after start time)
      const sessionEndTime = addHours(sessionTime, 1);
      
      // Determine roles based on previous sessions
      const sessionCount = previousSessions[partnerId] || 0;
      const shouldBeInterviewer = sessionCount % 2 === 0 ? isInterviewer : !isInterviewer;

      const { data: session, error } = await supabase
        .from('mock_sessions')
        .insert({
          user1_id: user.id,
          user2_id: partnerId,
          role1: shouldBeInterviewer ? 'interviewer' : 'interviewee',
          role2: shouldBeInterviewer ? 'interviewee' : 'interviewer',
          session_time: sessionTime.toISOString(),
          end_time: sessionEndTime.toISOString(),
          type: selectedType,
          status: 'scheduled',
          video_platform: 'Google Meet',
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
      setSelectedTimeSlot('');
      setSelectedType('behavioral');
      setIsInterviewer(false);
    } catch (error: any) {
      logger.error('Error scheduling session:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule mock interview session: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    // Navigate to the mock interview room with correct route
    navigate(`/interview-prep/mock-interview-room/${sessionId}`);
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
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Interview Prep
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-2">Mock Interviews</h1>
          <p className="text-muted-foreground">
            Schedule and participate in mock interviews with peers.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 w-full grid grid-cols-4 md:w-auto">
            <TabsTrigger value="schedule">Find Sessions</TabsTrigger>
            <TabsTrigger value="availability">Set Availability</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Sessions</TabsTrigger>
            <TabsTrigger value="guidelines">
              <BookText className="h-4 w-4 mr-2" />
              Guidelines
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            {!hasSetAvailability && (
              <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <p>Please set your availability first to help others find matching times.</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab('availability')}
                    >
                      Set Availability
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Find Available Partners</CardTitle>
                <CardDescription>
                  Find available peers for mock interviews. Sessions are 1 hour long via Google Meet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
                  <div>
                    <Label>Select Date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border p-3 pointer-events-auto"
                      disabled={(date) => date < new Date()}
                    />
                    <div className="text-sm text-muted-foreground mt-2">
                      Your local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </div>
                  </div>

                  <div>
                    {selectedDate ? (
                      <>
                        <Label className="block mb-2">Available Time Slots</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[350px] overflow-y-auto p-1">
                          {TIME_SLOTS.map((slot) => (
                            <div key={slot.id} className="flex items-center space-x-2">
                              <input 
                                type="radio" 
                                id={`time-${slot.id}`}
                                name="timeSlot"
                                value={slot.id}
                                checked={selectedTimeSlot === slot.id}
                                onChange={() => setSelectedTimeSlot(slot.id)}
                                className="w-4 h-4"
                              />
                              <label htmlFor={`time-${slot.id}`} className="text-sm cursor-pointer">
                                {slot.startTime} - {slot.endTime}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        <div className="space-y-4 mt-6">
                          <div>
                            <Label>Interview Type</Label>
                            <Select value={selectedType} onValueChange={(value: 'behavioral' | 'technical') => setSelectedType(value)}>
                              <SelectTrigger className="mt-1">
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
                            <Label htmlFor="role-switch">
                              I want to be the interviewer for this session
                              <span className="block text-xs text-muted-foreground mt-1">
                                (Roles alternate with each new session with the same partner)
                              </span>
                            </Label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Please select a date first</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedDate && selectedTimeSlot && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium mb-3">Available Users</h3>
                    {availableUsers.length > 0 ? (
                      <div className="space-y-4">
                        {availableUsers.map((profile) => {
                          const sessionCount = previousSessions[profile.id] || 0;
                          const roleText = sessionCount > 0 
                            ? `Next role: ${(sessionCount % 2 === 0) === isInterviewer ? 'Interviewer' : 'Interviewee'}`
                            : 'No previous sessions';
                            
                          return (
                            <div
                              key={profile.id}
                              className="flex items-center justify-between p-4 border rounded-md"
                            >
                              <div>
                                <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {roleText} • {sessionCount} previous sessions
                                </p>
                              </div>
                              <Button
                                onClick={() => handleSchedule(profile.id)}
                                disabled={scheduling}
                              >
                                {scheduling ? <Spinner size="sm" /> : 'Schedule'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No users available for the selected time slot.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="availability">
            <Card>
              <CardHeader>
                <CardTitle>Set Your Availability</CardTitle>
                <CardDescription>
                  Select the specific hours you're available for mock interviews.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvailabilityManager 
                  onAvailabilityChange={checkAvailabilityStatus} 
                  timeBlocks={TIME_SLOTS} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming">
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
                            {format(new Date(session.session_time), 'h:mm a')} - 
                            {session.end_time ? 
                              format(new Date(session.end_time), ' h:mm a') : 
                              format(addHours(new Date(session.session_time), 1), ' h:mm a')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
                          <span>
                            You are the{' '}
                            {session.user1_id === user?.id ? session.role1 : session.role2}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Video className="h-4 w-4" />
                          <span>
                            {session.video_platform || 'Google Meet'}
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
          </TabsContent>

          {/* New Guidelines Tab */}
          <TabsContent value="guidelines">
            <Card>
              <CardHeader>
                <CardTitle>Interview Guidelines</CardTitle>
                <CardDescription>
                  Essential guidance for conducting effective mock interviews and study sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 max-w-5xl">
                {/* Introduction Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold border-b pb-2">Purpose & Benefits</h3>
                  <p>One of the best ways to prepare for a job interview is to participate in mock interviews. This platform provides a streamlined place for fellows to schedule mock interviews and study sessions with their peers, facilitating coordination across time zones and availability.</p>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Why Mock Interviews Matter</h4>
                    <ul className="space-y-2 text-blue-700 dark:text-blue-200">
                      <li>Increase confidence and boost overall morale</li>
                      <li>Reduce stress and anxiety before real job interviews</li>
                      <li>Gain useful feedback in a low-stress environment</li>
                      <li>Better prepare for sessions with DS4A Mentors or CSC</li>
                      <li>Coordinate study sessions with other fellows in the program</li>
                    </ul>
                  </div>
                </div>
                
                {/* How to Conduct Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold border-b pb-2">How to Conduct a Mock Interview</h3>
                  <p>A mock interview is time for you and an interview partner to practice answering questions as if you were in a real live interview.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium">Structure</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>30-45 minutes each to answer questions</li>
                        <li>5 minutes for meaningful feedback</li>
                        <li>Total session should not exceed 90 minutes</li>
                        <li>Mock, receive feedback, reflect, switch roles & repeat</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">Question Selection</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Leverage DS4A resources or outside resources for practice questions</li>
                        <li>Inform your partner which questions you want to review</li>
                        <li>Share why you want to practice specific questions</li>
                        <li>Try to solve your partner's questions in advance for better feedback</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Performing & Feedback Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold border-b pb-2">Performing a Mock</h3>
                    <div className="space-y-3">
                      <p>During the mock interview:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Be prepared to answer your provided question and any follow-ups</li>
                        <li>Interviewers should gauge detail and clarity</li>
                        <li>Ask follow-up questions such as:</li>
                        <ul className="list-disc pl-5 ml-4 space-y-1">
                          <li>"Why did you choose this approach?"</li>
                          <li>"What would you do differently?"</li>
                          <li>"Are there any alternative ways to solve this problem?"</li>
                        </ul>
                        <li>Always ask at least one follow-up question to simulate real-world situations</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold border-b pb-2">Giving Feedback</h3>
                    <p>Avoid vague feedback like "You did well" or "I liked your answer." Be constructive, useful, and actionable by highlighting strengths and areas for improvement.</p>
                    <h4 className="font-medium mt-4">Questions to consider:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Were responses concise and well-structured?</li>
                      <li>Did they fully answer the question?</li>
                      <li>How convincing was their answer?</li>
                      <li>Did they justify every decision?</li>
                      <li>Were solutions too vague?</li>
                      <li>What would they change if asked again?</li>
                      <li>How was their body language, speaking pace, and mannerisms?</li>
                      <li>Did they maintain eye contact with the camera?</li>
                      <li>Was their demeanor positive or negative?</li>
                      <li>Were they exhaustive or too general?</li>
                    </ul>
                  </div>
                </div>
                
                {/* Resources Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold border-b pb-2">Interview Resources</h3>
                  <p className="font-medium">Review the resources in the Professional Development section of the training website for technical and behavioral interviews.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium">General Resources</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://www.linkedin.com/pulse/top-12-questions-interviewee-ask-get-hired-by-linkedin-news/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Top 12 Questions for an Interviewee to Ask
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://www.linkedin.com/pulse/10-most-common-interview-questions-how-answer-/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            10 Most Common Interview Questions and How to Answer
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://static1.squarespace.com/static/58b82141197aea3090513b2b/t/613b748fc3a1ce125eca5e52/1631286416347/Leadership+Principle+interview+questions+by+principle.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Amazon Leadership Principles Interview Questions
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://www.theguardian.com/careers/careers-blog/common-interview-questions" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Common Interview Questions
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://bit.ly/jobinterviewsguide" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            General Interview Guide with Behavioral and Technical Resources
                          </a>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">Technical Resources</h4>
                      <p className="text-sm text-muted-foreground mb-2">SQL Resources:</p>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://www.stratascratch.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            StrataScratch
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://leetcode.com/problemset/database/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Leetcode (Database Problems)
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://www.interviewquery.com/p/data-science-sql-interview-questions" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Strategies for Successful Tech Interviews
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://sql.datainterview.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Data Interview SQL Pad
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Preparing Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold border-b pb-2">Additional Preparation Tips</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium">Practice Material</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Review Modules, Extended Cases, and Lectures</li>
                        <li>Try solving problems within a 30-minute timeframe</li>
                        <li>For Technical Mocks, solve coding problems or answer technical questions live</li>
                        <li>Use platforms like Google Colab for collaborative coding</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">Reverse Interviewing</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://github.com/viraptor/reverse-interview" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Questions to Ask Interviewers
                          </a>
                        </li>
                        <li className="flex items-start">
                          <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                          <a href="https://blog.pragmaticengineer.com/reverse-interviewing/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Questions for Your Future Manager
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800 mt-6">
                    <h4 className="font-medium text-green-800 dark:text-green-300 mb-2">Final Reminders</h4>
                    <ul className="space-y-2 text-green-700 dark:text-green-200">
                      <li><strong>Consistency:</strong> Regular practice makes interviews feel more natural</li>
                      <li><strong>Feedback:</strong> Actively seek and incorporate feedback to improve</li>
                      <li><strong>Reflection:</strong> After each mock, reflect on what worked and what didn't</li>
                      <li><strong>Balance:</strong> Practice both technical skills and behavioral responses</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
