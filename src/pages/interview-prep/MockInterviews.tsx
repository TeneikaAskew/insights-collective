import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { format, addHours, startOfDay } from 'date-fns';
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
  meeting_url?: string | null;
}

// Jitsi rooms need no account, no API key, and no vendor setup — they are
// the fallback whenever the Zoom integration is unavailable. The room name
// is derived from the session id so it is unguessable.
const jitsiRoomUrl = (sessionId: string) => `https://meet.jit.si/insights-mock-${sessionId}`;

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

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const statusChipClass: Record<MockSession['status'], string> = {
  scheduled: 'bg-ss-good-chip text-ss-good',
  completed: 'bg-ss-track text-muted-foreground',
  canceled: 'bg-ss-bad-chip text-ss-bad',
};

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

  // Both effects key on user?.id, not the user object: useUser emits a new
  // object for every auth event (getUser resolving, TOKEN_REFRESHED), and each
  // identity change re-ran these fetches for the same signed-in user.
  useEffect(() => {
    if (user) {
      loadSessions();
      checkAvailabilityStatus();
    } else {
      // Logged out: render the page instead of spinning forever
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (selectedDate && selectedTimeSlot && user) {
      loadAvailableUsers();
    } else {
      setAvailableUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedTimeSlot, selectedType, isInterviewer, user?.id]);

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
      setSessions((sessions || []) as unknown as MockSession[]);
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
    const isPM = timeStr.includes('PM');
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

      // Get users who are available for this specific time slot and weekday.
      // Goes through an RPC rather than selecting availability_slots directly:
      // the table is readable only by its owner, and this function returns just
      // the user ids that match — not everyone's full schedule.
      const { data: availableSlots, error } = await supabase.rpc('find_available_peers', {
        p_weekday: weekday,
        p_time_slot: selectedTimeSlot,
      });

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

      // Give the session a joinable video link. Zoom when the integration is
      // configured; otherwise a Jitsi room (no account needed on either side).
      // A link failure must never lose the booking, so this is best-effort.
      let meetingUrl = jitsiRoomUrl(session.id);
      let platform = 'Jitsi Meet';
      let startUrl: string | null = null;
      let meetingId: string | null = null;
      try {
        const { data: zoom, error: zoomError } = await supabase.functions.invoke('create-zoom-meeting', {
          body: {
            title: `Mock Interview — ${capitalize(selectedType)}`,
            start_time: sessionTime.toISOString(),
            duration: 60,
            agenda: 'Peer mock interview scheduled from Insights Collective',
          },
        });
        if (!zoomError && zoom?.join_url) {
          meetingUrl = zoom.join_url;
          startUrl = zoom.start_url ?? null;
          meetingId = zoom.meeting_id ? String(zoom.meeting_id) : null;
          platform = 'Zoom';
        }
      } catch (linkError) {
        logger.error('Zoom meeting creation failed, using Jitsi room:', linkError);
      }

      const { data: linked, error: linkPersistError } = await supabase
        .from('mock_sessions')
        .update({
          meeting_url: meetingUrl,
          start_url: startUrl,
          meeting_id: meetingId,
          video_platform: platform,
        })
        .eq('id', session.id)
        .select()
        .single();

      // The session row is what the OTHER participant reads. This update was
      // unchecked and supabase-js does not throw, so the surrounding catch could
      // not fire: a failure here left the booker with a working link in local
      // state and a success toast, while their counterpart opened a session with
      // no meeting URL at all. The booking itself is real and already saved, so
      // this warns rather than fails — but it must not claim success.
      setSessions([...sessions, (linked || { ...session, meeting_url: meetingUrl, video_platform: platform }) as unknown as MockSession]);

      if (linkPersistError) {
        logger.error('Meeting link did not persist to the session', linkPersistError);
        toast({
          title: 'Session booked, but the meeting link did not save',
          description:
            "Your slot is reserved. The video link may not be visible to the other participant — reopen the session to add it again.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Mock interview session scheduled successfully.',
        });
      }

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

  const now = new Date();
  const upcomingSessions = sessions.filter(
    (s) =>
      s.status === 'scheduled' &&
      new Date(s.end_time || addHours(new Date(s.session_time), 1)) >= now
  );
  const pastSessions = sessions.filter((s) => !upcomingSessions.includes(s));

  const sessionRow = (session: MockSession) => (
    <div key={session.id} className="rounded-2xl border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            session.type === 'behavioral' ? 'bg-ss-lav-chip text-ss-lav-deep' : 'bg-ss-teal-chip text-ss-teal'
          }`}
        >
          {capitalize(session.type)}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusChipClass[session.status]}`}>
          {capitalize(session.status)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <CalendarIcon className="h-4 w-4 text-ss-lav-deep" />
        <span>{format(new Date(session.session_time), 'MMMM d, yyyy')}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-ss-lav-deep" />
        <span>
          {format(new Date(session.session_time), 'h:mm a')} -
          {session.end_time ?
            format(new Date(session.end_time), ' h:mm a') :
            format(addHours(new Date(session.session_time), 1), ' h:mm a')}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-ss-lav-deep" />
        <span>
          You are the{' '}
          {capitalize(session.user1_id === user?.id ? session.role1 : session.role2)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Video className="h-4 w-4 text-ss-lav-deep" />
        <span>{session.video_platform || 'Google Meet'}</span>
      </div>

      {session.status === 'scheduled' && (
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            className="flex-1 rounded-full font-bold"
            onClick={() => window.open(session.meeting_url || jitsiRoomUrl(session.id), '_blank', 'noopener')}
          >
            <Video className="h-4 w-4 mr-2" />
            Join video call
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-full font-bold"
            onClick={() => handleJoinSession(session.id)}
          >
            Open prep room
          </Button>
        </div>
      )}
    </div>
  );

  const pillTab =
    'rounded-full font-bold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none';

  if (loading) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="flex items-center justify-center py-8">
                <Spinner size="lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/interview-prep')}
                className="rounded-full font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Interview prep
              </Button>
              <span className="text-sm text-muted-foreground">· Step 04</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Mock Interviews</h1>
            <p className="text-muted-foreground text-lg">
              Schedule and participate in mock interviews with peers.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 flex flex-wrap h-auto gap-2 bg-transparent p-0 justify-start">
              <TabsTrigger value="schedule" className={pillTab}>Find Sessions</TabsTrigger>
              <TabsTrigger value="availability" className={pillTab}>Set Availability</TabsTrigger>
              <TabsTrigger value="upcoming" className={pillTab}>Upcoming Sessions</TabsTrigger>
              <TabsTrigger value="guidelines" className={pillTab}>
                <BookText className="h-4 w-4 mr-2" />
                Guidelines
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              {!hasSetAvailability && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ss-warn/30 bg-ss-warn-chip px-5 py-4">
                  <p className="text-sm font-medium text-ss-warn">
                    Please set your availability first to help others find matching times.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold"
                    onClick={() => setActiveTab('availability')}
                  >
                    Set Availability
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                {/* Left rail: date, time, type, role */}
                <Card className="ss-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Find Available Partners</CardTitle>
                    <CardDescription>
                      Find available peers for mock interviews. Sessions are 1 hour long via Google Meet.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Select Date
                      </Label>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="mt-2 rounded-2xl border p-3 pointer-events-auto bg-card"
                        disabled={(date) => date < startOfDay(new Date())}
                      />
                      <div className="text-sm text-muted-foreground mt-2">
                        Your local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                      </div>
                    </div>

                    {selectedDate && (
                      <>
                        <div>
                          <Label className="block mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Available Time Slots
                          </Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto p-1">
                            {TIME_SLOTS.map((slot) => (
                              <label
                                key={slot.id}
                                htmlFor={`time-${slot.id}`}
                                className={`cursor-pointer rounded-full border px-3 py-2 text-center text-xs font-bold transition-colors ${
                                  selectedTimeSlot === slot.id
                                    ? 'border-ss-lav bg-ss-lav-chip text-ss-lav-deep'
                                    : 'bg-card text-foreground hover:border-ss-lav'
                                }`}
                              >
                                <input
                                  type="radio"
                                  id={`time-${slot.id}`}
                                  name="timeSlot"
                                  value={slot.id}
                                  checked={selectedTimeSlot === slot.id}
                                  onChange={() => setSelectedTimeSlot(slot.id)}
                                  className="sr-only"
                                />
                                {slot.startTime} - {slot.endTime}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Interview Type
                          </Label>
                          <Select value={selectedType} onValueChange={(value: 'behavioral' | 'technical') => setSelectedType(value)}>
                            <SelectTrigger className="mt-1 rounded-xl bg-card">
                              <SelectValue placeholder="Select interview type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="behavioral">Behavioral</SelectItem>
                              <SelectItem value="technical">Technical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-start space-x-3">
                          <Switch
                            id="role-switch"
                            checked={isInterviewer}
                            onCheckedChange={setIsInterviewer}
                          />
                          <Label htmlFor="role-switch">
                            I want to be the interviewer for this session
                            <span className="block text-xs text-muted-foreground mt-1 font-normal">
                              (Roles alternate with each new session with the same partner)
                            </span>
                          </Label>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Right pane: partners + upcoming */}
                <div className="lg:col-span-3 space-y-6">
                  <Card className="ss-card">
                    <CardHeader>
                      <CardTitle>Available Users</CardTitle>
                      {selectedDate && (
                        <CardDescription>
                          {format(selectedDate, 'EEEE, MMMM d')}
                          {selectedTimeSlot &&
                            ` · ${TIME_SLOTS.find((s) => s.id === selectedTimeSlot)?.startTime} - ${TIME_SLOTS.find((s) => s.id === selectedTimeSlot)?.endTime}`}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {!selectedDate ? (
                        <p className="text-muted-foreground py-6 text-center">Please select a date first</p>
                      ) : !selectedTimeSlot ? (
                        <p className="text-muted-foreground py-6 text-center">
                          Choose a time slot to see who's available.
                        </p>
                      ) : availableUsers.length > 0 ? (
                        <div className="space-y-3">
                          {availableUsers.map((profile) => {
                            const sessionCount = previousSessions[profile.id] || 0;
                            const roleText = sessionCount > 0
                              ? `Next role: ${(sessionCount % 2 === 0) === isInterviewer ? 'Interviewer' : 'Interviewee'}`
                              : 'No previous sessions';

                            return (
                              <div
                                key={profile.id}
                                className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ss-lav-chip text-sm font-bold text-ss-lav-deep">
                                    {(profile.first_name?.[0] || '') + (profile.last_name?.[0] || '')}
                                  </span>
                                  <div>
                                    <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {sessionCount > 0
                                        ? `${roleText} · ${sessionCount} previous session${sessionCount === 1 ? '' : 's'}`
                                        : roleText}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleSchedule(profile.id)}
                                  disabled={scheduling}
                                  className="rounded-full font-bold"
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
                    </CardContent>
                  </Card>

                  <Card className="ss-card bg-ss-card-warm">
                    <CardHeader>
                      <CardTitle>Upcoming Sessions</CardTitle>
                      <CardDescription>Your scheduled mock interview sessions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {upcomingSessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
                      ) : (
                        <div className="space-y-3">{upcomingSessions.map(sessionRow)}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="availability">
              <Card className="ss-card">
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
              <Card className="ss-card">
                <CardHeader>
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <CardDescription>
                    Your scheduled mock interview sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingSessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No upcoming sessions scheduled.
                      </p>
                    ) : (
                      upcomingSessions.map(sessionRow)
                    )}

                    {pastSessions.length > 0 && (
                      <div className="pt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Past sessions
                        </h3>
                        <div className="space-y-3">{pastSessions.map(sessionRow)}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guidelines">
              <Card className="ss-card">
                <CardHeader>
                  <CardTitle>Interview Guidelines</CardTitle>
                  <CardDescription>
                    Essential guidance for conducting effective mock interviews and study sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 max-w-5xl">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold border-b pb-2">Purpose & Benefits</h3>
                    <p>One of the best ways to prepare for a job interview is to participate in mock interviews. This platform provides a streamlined place for fellows to schedule mock interviews and study sessions with their peers, facilitating coordination across time zones and availability.</p>

                    <div className="rounded-2xl bg-ss-lav-chip p-4">
                      <h4 className="font-medium text-ss-lav-deep mb-2">Why Mock Interviews Matter</h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>Increase confidence and boost overall morale</li>
                        <li>Reduce stress and anxiety before real job interviews</li>
                        <li>Gain useful feedback in a low-stress environment</li>
                        <li>Better prepare for sessions with mentors and career coaches</li>
                        <li>Coordinate study sessions with other fellows in the program</li>
                      </ul>
                    </div>
                  </div>

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
                          <li>Leverage community resources or outside resources for practice questions</li>
                          <li>Inform your partner which questions you want to review</li>
                          <li>Share why you want to practice specific questions</li>
                          <li>Try to solve your partner's questions in advance for better feedback</li>
                        </ul>
                      </div>
                    </div>
                  </div>

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

                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold border-b pb-2">Interview Resources</h3>
                    <p className="font-medium">Review the resources in the Professional Development section of the training website for technical and behavioral interviews.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-medium">General Resources</h4>
                        <ul className="space-y-2">
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://www.linkedin.com/pulse/top-12-questions-interviewee-ask-get-hired-by-linkedin-news/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Top 12 Questions for an Interviewee to Ask
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://www.linkedin.com/pulse/10-most-common-interview-questions-how-answer-/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              10 Most Common Interview Questions and How to Answer
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://static1.squarespace.com/static/58b82141197aea3090513b2b/t/613b748fc3a1ce125eca5e52/1631286416347/Leadership+Principle+interview+questions+by+principle.pdf" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Amazon Leadership Principles Interview Questions
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://www.theguardian.com/careers/careers-blog/common-interview-questions" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Common Interview Questions
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://bit.ly/jobinterviewsguide" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
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
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://www.stratascratch.com/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              StrataScratch
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://leetcode.com/problemset/database/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Leetcode (Database Problems)
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://www.interviewquery.com/p/data-science-sql-interview-questions" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Strategies for Successful Tech Interviews
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://sql.datainterview.com/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Data Interview SQL Pad
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

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
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://github.com/viraptor/reverse-interview" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Questions to Ask Interviewers
                            </a>
                          </li>
                          <li className="flex items-start">
                            <ExternalLink className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-ss-lav-deep" />
                            <a href="https://blog.pragmaticengineer.com/reverse-interviewing/" target="_blank" rel="noopener noreferrer" className="text-ss-lav-deep hover:underline">
                              Questions for Your Future Manager
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-ss-good-chip p-4 mt-6">
                      <h4 className="font-medium text-ss-good mb-2">Final Reminders</h4>
                      <ul className="list-disc pl-5 space-y-2">
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
      </div>
    </AppLayout>
  );
}
