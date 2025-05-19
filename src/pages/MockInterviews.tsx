
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
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, Video, BookText, ExternalLink } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('schedule');

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
        <div className="bg-gradient-to-r from-[#1F75FE] to-[#5ED3B5] p-6 rounded-lg shadow-lg mb-6">
          <h1 className="text-4xl font-bold mb-2 text-white">Mock Interviews</h1>
          <p className="text-white/90">
            Schedule and participate in mock interviews with peers to enhance your interview skills.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 mb-8 bg-slate-100 p-1">
          <TabsTrigger 
            value="schedule" 
            className="data-[state=active]:bg-[#1F75FE] data-[state=active]:text-white"
          >
            Schedule
          </TabsTrigger>
          <TabsTrigger 
            value="upcoming"
            className="data-[state=active]:bg-[#1F75FE] data-[state=active]:text-white"
          >
            Upcoming Sessions
          </TabsTrigger>
          <TabsTrigger 
            value="guidelines"
            className="data-[state=active]:bg-[#1F75FE] data-[state=active]:text-white"
          >
            <BookText className="h-4 w-4 mr-2" />
            Guidelines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card className="border-[#5ED3B5]/20 shadow-md">
            <CardHeader className="bg-gradient-to-r from-[#5ED3B5]/10 to-transparent">
              <CardTitle>Schedule New Session</CardTitle>
              <CardDescription>
                Find available peers for mock interviews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <Label>Select Date</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border border-[#1F75FE]/20 p-1"
                    disabled={(date) => date < new Date()}
                  />
                </div>

                <div>
                  <Label>Time Block</Label>
                  <Select value={selectedTimeBlock} onValueChange={setSelectedTimeBlock}>
                    <SelectTrigger className="border-[#5ED3B5]/30 focus:ring-[#1F75FE]/30">
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

                  <div className="mt-6">
                    <Label>Interview Type</Label>
                    <Select value={selectedType} onValueChange={(value: 'behavioral' | 'technical') => setSelectedType(value)}>
                      <SelectTrigger className="border-[#5ED3B5]/30 focus:ring-[#1F75FE]/30 mt-2">
                        <SelectValue placeholder="Select interview type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 mt-6">
                    <Switch
                      id="role-switch"
                      checked={isInterviewer}
                      onCheckedChange={setIsInterviewer}
                      className="data-[state=checked]:bg-[#F9A826]"
                    />
                    <Label htmlFor="role-switch">I want to be the interviewer</Label>
                  </div>
                </div>
              </div>

              {availableUsers.length > 0 ? (
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold text-[#1F75FE]">Available Users</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableUsers.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-md hover:border-[#5ED3B5] hover:bg-[#5ED3B5]/5 transition-colors"
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
                          className="bg-[#1F75FE] hover:bg-[#1F75FE]/90"
                        >
                          {scheduling ? <Spinner size="sm" /> : 'Schedule'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                selectedDate && selectedTimeBlock && (
                  <div className="mt-8 p-4 bg-[#F9A826]/10 border border-[#F9A826]/30 rounded-md">
                    <p className="text-center text-[#F9A826]">
                      No users available for the selected time slot.
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className="border-[#1F75FE]/20 shadow-md">
            <CardHeader className="bg-gradient-to-r from-[#1F75FE]/10 to-transparent">
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>
                Your scheduled mock interview sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-muted-foreground">
                      No upcoming sessions scheduled.
                    </p>
                    <Button 
                      onClick={() => setActiveTab('schedule')} 
                      variant="outline" 
                      className="mt-4 border-[#5ED3B5] text-[#5ED3B5] hover:bg-[#5ED3B5]/10"
                    >
                      Schedule a Session
                    </Button>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow space-y-3 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={session.type === 'behavioral' ? 'default' : 'secondary'} className={
                          session.type === 'behavioral' ? 'bg-[#5ED3B5] hover:bg-[#5ED3B5]/90' : 'bg-[#F9A826] hover:bg-[#F9A826]/90'
                        }>
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
                          className={
                            session.status === 'scheduled' 
                              ? 'border-[#1F75FE] text-[#1F75FE]' 
                              : session.status === 'completed'
                                ? 'bg-green-500 hover:bg-green-600'
                                : ''
                          }
                        >
                          {session.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-[#1F75FE]" />
                        <span>
                          {format(new Date(session.session_time), 'MMMM d, yyyy')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-[#1F75FE]" />
                        <span>
                          {format(new Date(session.session_time), 'h:mm a')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-[#1F75FE]" />
                        <span>
                          You are the{' '}
                          <span className="font-medium">{session.user1_id === user?.id ? session.role1 : session.role2}</span>
                        </span>
                      </div>

                      {session.status === 'scheduled' && (
                        <Button
                          className="w-full mt-2 bg-gradient-to-r from-[#1F75FE] to-[#5ED3B5] hover:opacity-90"
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

        <TabsContent value="guidelines">
          <Card className="border-[#1F75FE]/20 shadow-md">
            <CardHeader className="bg-gradient-to-r from-[#1F75FE]/10 to-transparent">
              <CardTitle>Interview Guidelines</CardTitle>
              <CardDescription>
                Essential guidance for conducting effective mock interviews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Introduction Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">Purpose & Benefits</h3>
                <p>One of the best ways to prepare for a job interview is to participate in mock interviews. This platform provides a streamlined place for fellows to schedule mock interviews and study sessions with their peers, facilitating coordination across time zones and availability.</p>
                
                <div className="bg-[#1F75FE]/5 p-4 rounded-md border border-[#1F75FE]/20">
                  <h4 className="font-medium text-[#1F75FE] mb-2">Why Mock Interviews Matter</h4>
                  <ul className="space-y-2 text-[#1C2D5A]">
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
                <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">How to Conduct a Mock Interview</h3>
                <p>A mock interview is time for you and an interview partner to practice answering questions as if you were in a real live interview.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 bg-[#5ED3B5]/5 p-4 rounded-md border border-[#5ED3B5]/20">
                    <h4 className="font-medium text-[#5ED3B5]">Structure</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>30-45 minutes each to answer questions</li>
                      <li>5 minutes for meaningful feedback</li>
                      <li>Total session should not exceed 90 minutes</li>
                      <li>Mock, receive feedback, reflect, switch roles & repeat</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3 bg-[#F9A826]/5 p-4 rounded-md border border-[#F9A826]/20">
                    <h4 className="font-medium text-[#F9A826]">Question Selection</h4>
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
                  <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">Performing a Mock</h3>
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
                  <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">Giving Feedback</h3>
                  <p>Avoid vague feedback like "You did well" or "I liked your answer." Be constructive, useful, and actionable by highlighting strengths and areas for improvement.</p>
                  <h4 className="font-medium mt-4 text-[#5ED3B5]">Questions to consider:</h4>
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
                <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">Interview Resources</h3>
                <p className="font-medium">Review the resources in the Professional Development section of the training website for technical and behavioral interviews.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-[#5ED3B5]">General Resources</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.youtube.com/playlist?list=PLpZimxTCBwRXVuVaeFL4UV8x7wyhYserS" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          YouTube Playlist of Questions Teneika's Had/Heard from Others
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.linkedin.com/pulse/top-12-questions-interviewee-ask-get-hired-by-linkedin-news/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Top 12 Questions for an Interviewee to Ask
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.linkedin.com/pulse/10-most-common-interview-questions-how-answer-/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          10 Most Common Interview Questions and How to Answer
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://static1.squarespace.com/static/58b82141197aea3090513b2b/t/613b748fc3a1ce125eca5e52/1631286416347/Leadership+Principle+interview+questions+by+principle.pdf" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Amazon Leadership Principles Interview Questions
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.theguardian.com/careers/careers-blog/common-interview-questions" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Common Interview Questions
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://bit.ly/jobinterviewsguide" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          General Interview Guide with Behavioral and Technical Resources
                        </a>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-[#5ED3B5]">Technical Resources</h4>
                    <p className="text-sm text-muted-foreground mb-2">SQL Resources:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.stratascratch.com/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          StrataScratch
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://leetcode.com/problemset/database/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Leetcode (Database Problems)
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://www.interviewquery.com/p/data-science-sql-interview-questions" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Strategies for Successful Tech Interviews
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://sql.datainterview.com/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Data Interview SQL Pad
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Preparing Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold border-b border-[#5ED3B5]/30 pb-2 text-[#1F75FE]">Additional Preparation Tips</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 bg-white p-4 rounded-md border border-[#1F75FE]/20 shadow-sm">
                    <h4 className="font-medium text-[#1F75FE]">Practice Material</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Review Modules, Extended Cases, and Lectures</li>
                      <li>Try solving problems within a 30-minute timeframe</li>
                      <li>For Technical Mocks, solve coding problems or answer technical questions live</li>
                      <li>Use platforms like Google Colab for collaborative coding</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3 bg-white p-4 rounded-md border border-[#1F75FE]/20 shadow-sm">
                    <h4 className="font-medium text-[#1F75FE]">Reverse Interviewing</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://github.com/viraptor/reverse-interview" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Questions to Ask Interviewers
                        </a>
                      </li>
                      <li className="flex items-start">
                        <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-[#F9A826]" />
                        <a href="https://blog.pragmaticengineer.com/reverse-interviewing/" target="_blank" rel="noopener noreferrer" className="text-[#1F75FE] hover:underline">
                          Questions for Your Future Manager
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-[#5ED3B5]/10 p-6 rounded-md border border-[#5ED3B5]/20 mt-6">
                  <h4 className="font-medium text-[#5ED3B5] mb-4 text-center text-lg">Final Reminders</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-md shadow-sm text-center">
                      <h5 className="font-bold text-[#1F75FE] mb-2">Consistency</h5>
                      <p className="text-sm">Regular practice makes interviews feel more natural</p>
                    </div>
                    <div className="bg-white p-4 rounded-md shadow-sm text-center">
                      <h5 className="font-bold text-[#F9A826] mb-2">Feedback</h5>
                      <p className="text-sm">Actively seek and incorporate feedback to improve</p>
                    </div>
                    <div className="bg-white p-4 rounded-md shadow-sm text-center">
                      <h5 className="font-bold text-[#5ED3B5] mb-2">Reflection</h5>
                      <p className="text-sm">After each mock, reflect on what worked and what didn't</p>
                    </div>
                    <div className="bg-white p-4 rounded-md shadow-sm text-center">
                      <h5 className="font-bold text-[#C7BCF5] mb-2">Balance</h5>
                      <p className="text-sm">Practice both technical skills and behavioral responses</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
