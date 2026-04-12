import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  FileText,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  Video,
  PlayCircle,
  Download,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useCourseCalendar, useCalendarEventMutations } from '@/hooks/useCourseCalendar';
import { CourseCalendarEvent, ZoomRecurrence } from '@/types/course';
import { format, isAfter, isToday, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZoomRecordingFile {
  id: string;
  meeting_id: number;
  topic: string;
  start_time: string;
  file_type: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: string;
  duration: number;
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};

const WEEKDAYS = [
  { label: 'Su', value: 1 },
  { label: 'Mo', value: 2 },
  { label: 'Tu', value: 3 },
  { label: 'We', value: 4 },
  { label: 'Th', value: 5 },
  { label: 'Fr', value: 6 },
  { label: 'Sa', value: 7 },
];

// ── Component ─────────────────────────────────────────────────────────────────

const CourseCalendar = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { canEdit } = useCoursePermissions(courseId);

  // ── Calendar state ──────────────────────────────────────────────────────
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CourseCalendarEvent | null>(null);
  const [activeFilters, setActiveFilters] = useState({ assignment: true, quiz: true, event: true });
  const [mainTab, setMainTab] = useState<'calendar' | 'recordings'>('calendar');

  // ── Add Event dialog state ──────────────────────────────────────────────
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  // Zoom state
  const [zoomLink, setZoomLink] = useState('');
  const [zoomMeetingId, setZoomMeetingId] = useState<number | null>(null);
  const [zoomStartUrl, setZoomStartUrl] = useState('');
  const [isCreatingZoom, setIsCreatingZoom] = useState(false);
  const [copied, setCopied] = useState(false);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<ZoomRecurrence['type']>('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceEndTimes, setRecurrenceEndTimes] = useState('');
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<'date' | 'count'>('date');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([2]); // Monday default

  // Recordings state
  const [recordings, setRecordings] = useState<ZoomRecordingFile[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState('');

  const { createEvent, isCreating } = useCalendarEventMutations(courseId);

  // ── Calendar data ───────────────────────────────────────────────────────
  const filterTypes = Object.entries(activeFilters)
    .filter(([_, v]) => v).map(([k]) => k);

  const { events = [], isLoading } = useCourseCalendar(courseId, {
    types: filterTypes,
    startDate: date ? startOfMonth(date) : undefined,
    endDate: date ? endOfMonth(date) : undefined,
  });

  const filteredEvents = events.filter(e => activeFilters[e.type as keyof typeof activeFilters]);
  const eventsForSelectedDate = filteredEvents.filter(e =>
    date && isSameDay(new Date(e.start_date), date)
  );
  const upcomingEvents = filteredEvents
    .filter(e => isAfter(new Date(e.start_date), new Date()))
    .slice(0, 10);

  // ── Recordings fetch ────────────────────────────────────────────────────
  const fetchRecordings = async () => {
    setRecordingsLoading(true);
    setRecordingsError('');
    try {
      const { data, error } = await supabase.functions.invoke('get-zoom-recordings', {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecordings(data.recordings ?? []);
    } catch (err: any) {
      setRecordingsError(err.message);
    } finally {
      setRecordingsLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'recordings') fetchRecordings();
  }, [mainTab]);

  // ── Zoom meeting creation ───────────────────────────────────────────────
  const handleCreateZoomMeeting = async () => {
    if (!newEventTitle.trim()) return;
    setIsCreatingZoom(true);
    try {
      const start_time = newEventDate
        ? `${newEventDate}T${newEventTime || '12:00:00'}`
        : undefined;

      const recurrence: ZoomRecurrence | undefined = isRecurring
        ? {
            type: recurrenceType,
            weekly_days: (recurrenceType === 'weekly' || recurrenceType === 'biweekly')
              ? selectedWeekdays
              : undefined,
            end_date: recurrenceEndMode === 'date' ? recurrenceEndDate || undefined : undefined,
            end_times: recurrenceEndMode === 'count' && recurrenceEndTimes
              ? parseInt(recurrenceEndTimes)
              : undefined,
          }
        : undefined;

      const { data, error } = await supabase.functions.invoke('create-zoom-meeting', {
        body: { title: newEventTitle.trim(), start_time, duration: 60, agenda: newEventDescription, recurrence },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setZoomLink(data.join_url);
      setZoomMeetingId(data.meeting_id);
      setZoomStartUrl(data.start_url);
    } catch (err: any) {
      alert(`Zoom error: ${err.message}`);
    } finally {
      setIsCreatingZoom(false);
    }
  };

  const copyZoomLink = () => {
    navigator.clipboard.writeText(zoomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setNewEventTitle(''); setNewEventDate(''); setNewEventTime('');
    setNewEventDescription(''); setNewEventLocation('');
    setZoomLink(''); setZoomMeetingId(null); setZoomStartUrl('');
    setIsRecurring(false); setRecurrenceType('weekly');
    setRecurrenceEndDate(''); setRecurrenceEndTimes(''); setRecurrenceEndMode('date');
    setSelectedWeekdays([2]);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const toggleFilter = (f: keyof typeof activeFilters) =>
    setActiveFilters(prev => ({ ...prev, [f]: !prev[f] }));

  const getDatesWithEvents = (d: Date) =>
    filteredEvents.some(e => isSameDay(new Date(e.start_date), d));

  const getEventIcon = (type: string) => {
    if (type === 'assignment') return <FileText className="h-4 w-4" />;
    if (type === 'quiz') return <ClipboardList className="h-4 w-4" />;
    return <CalendarIcon className="h-4 w-4" />;
  };

  const getEventColor = (type: string) => {
    if (type === 'assignment') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'quiz') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  };

  const handleEventClick = (event: CourseCalendarEvent) => {
    if (event.type === 'assignment' && event.related_id)
      navigate(`/courses/${courseId}/assignments/${event.related_id}`);
    else if (event.type === 'quiz' && event.related_id)
      navigate(`/courses/${courseId}/quizzes/${event.related_id}`);
    else setSelectedEvent(event);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Course Calendar</h1>
          {canEdit && (
            <Button onClick={() => setShowAddEvent(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          )}
        </div>

        {/* ── Main tabs: Calendar / Recordings ────────────────────────── */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
          <TabsList>
            <TabsTrigger value="calendar">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="recordings">
              <PlayCircle className="h-4 w-4 mr-2" />
              Recordings
            </TabsTrigger>
          </TabsList>

          {/* ── Calendar tab ──────────────────────────────────────────── */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium">Show:</span>
              <Toggle pressed={activeFilters.assignment} onPressedChange={() => toggleFilter('assignment')} size="sm">
                <FileText className="h-4 w-4 mr-1" /> Assignments
              </Toggle>
              <Toggle pressed={activeFilters.quiz} onPressedChange={() => toggleFilter('quiz')} size="sm">
                <ClipboardList className="h-4 w-4 mr-1" /> Quizzes
              </Toggle>
              <Toggle pressed={activeFilters.event} onPressedChange={() => toggleFilter('event')} size="sm">
                <CalendarIcon className="h-4 w-4 mr-1" /> Events
              </Toggle>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar grid */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Calendar View</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      className="rounded-md border"
                      modifiers={{ hasEvent: getDatesWithEvents }}
                      modifiersStyles={{ hasEvent: { fontWeight: 'bold', textDecoration: 'underline' } }}
                    />
                  </div>

                  {date && eventsForSelectedDate.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="font-semibold text-sm">Events on {format(date, 'MMMM d, yyyy')}</h3>
                      {eventsForSelectedDate.map(event => (
                        <div
                          key={event.id}
                          className={cn('p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow', getEventColor(event.type))}
                          onClick={() => handleEventClick(event)}
                        >
                          <div className="flex items-start gap-2">
                            {event.zoom_meeting_id
                              ? <Video className="h-4 w-4 text-blue-500 shrink-0" />
                              : getEventIcon(event.type)
                            }
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{event.title}</p>
                                {event.zoom_recurrence && (
                                  <Badge variant="secondary" className="text-xs">
                                    <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                    Recurring
                                  </Badge>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-xs mt-1 opacity-75">{event.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming events */}
              <Card>
                <CardHeader><CardTitle>Upcoming Events</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
                    ) : (
                      upcomingEvents.map(event => {
                        const eventDate = new Date(event.start_date);
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow',
                              isToday(eventDate) && 'ring-2 ring-primary',
                              getEventColor(event.type)
                            )}
                            onClick={() => handleEventClick(event)}
                          >
                            <div className="flex items-start gap-2">
                              {event.zoom_meeting_id
                                ? <Video className="h-4 w-4 text-blue-500 shrink-0" />
                                : getEventIcon(event.type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-medium text-sm">{event.title}</p>
                                  {event.zoom_recurrence && (
                                    <Badge variant="secondary" className="text-xs">
                                      <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                      Recurring
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span className="text-xs">{format(eventDate, 'MMM d, yyyy')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Recordings tab ────────────────────────────────────────── */}
          <TabsContent value="recordings" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Cloud recordings from the last 30 days</p>
              <Button variant="outline" size="sm" onClick={fetchRecordings} disabled={recordingsLoading}>
                <RefreshCw className={cn('h-4 w-4 mr-2', recordingsLoading && 'animate-spin')} />
                Refresh
              </Button>
            </div>

            {recordingsLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            )}

            {recordingsError && (
              <Card className="border-destructive">
                <CardContent className="pt-4 text-sm text-destructive">{recordingsError}</CardContent>
              </Card>
            )}

            {!recordingsLoading && !recordingsError && recordings.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <PlayCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No recordings yet</p>
                  <p className="text-sm mt-1">Recordings appear here after a Zoom meeting ends. Cloud recording is enabled automatically on all meetings created here.</p>
                </CardContent>
              </Card>
            )}

            {recordings.length > 0 && (
              <div className="grid gap-4">
                {recordings.map(rec => (
                  <Card key={rec.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-50">
                            <Video className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{rec.topic}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {format(new Date(rec.start_time), 'MMM d, yyyy • h:mm a')}
                              </span>
                              <span>{rec.duration} min</span>
                              {rec.file_size > 0 && <span>{formatFileSize(rec.file_size)}</span>}
                            </div>
                            <Badge variant="outline" className="mt-1.5 text-xs capitalize">
                              {rec.recording_type?.replace(/_/g, ' ') ?? 'recording'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {rec.play_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={rec.play_url} target="_blank" rel="noopener noreferrer">
                                <PlayCircle className="h-4 w-4 mr-1" /> Play
                              </a>
                            </Button>
                          )}
                          {rec.download_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={rec.download_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-1" /> Download
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Add Event Dialog ─────────────────────────────────────────── */}
        <Dialog open={showAddEvent} onOpenChange={(open) => { if (!open) resetForm(); setShowAddEvent(open); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Event</DialogTitle>
              <DialogDescription>Add a custom event to the course calendar.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="event-title">Title *</Label>
                <Input id="event-title" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Event title" />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-date">Date *</Label>
                  <Input id="event-date" type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="event-time">Time</Label>
                  <Input id="event-time" type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} />
                </div>
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="event-location">Location</Label>
                <Input id="event-location" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="Optional location" />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="event-description">Description</Label>
                <Textarea id="event-description" value={newEventDescription} onChange={e => setNewEventDescription(e.target.value)} placeholder="Optional description" rows={2} />
              </div>

              {/* ── Zoom Section ──────────────────────────────────────── */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <Video className="h-4 w-4 text-blue-500" />
                    Zoom Meeting
                  </Label>
                  <Button type="button" size="sm" variant={zoomLink ? 'secondary' : 'outline'}
                    disabled={!newEventTitle.trim() || isCreatingZoom} onClick={handleCreateZoomMeeting}>
                    {isCreatingZoom ? 'Creating...' : zoomLink ? 'Regenerate' : 'Generate Link'}
                  </Button>
                </div>

                {/* Recurring toggle */}
                <div className="flex items-center gap-3">
                  <Switch id="recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
                  <Label htmlFor="recurring" className="cursor-pointer">Recurring meeting</Label>
                </div>

                {/* Recurrence options */}
                {isRecurring && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Repeat</Label>
                      <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as any)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Day-of-week picker for weekly/biweekly */}
                    {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">On these days</Label>
                        <div className="flex gap-1">
                          {WEEKDAYS.map(d => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => setSelectedWeekdays(prev =>
                                prev.includes(d.value) ? prev.filter(v => v !== d.value) : [...prev, d.value]
                              )}
                              className={cn(
                                'w-8 h-8 rounded-full text-xs font-medium border transition-colors',
                                selectedWeekdays.includes(d.value)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted'
                              )}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* End condition */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">End</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRecurrenceEndMode('date')}
                          className={cn('px-3 py-1 rounded text-xs border', recurrenceEndMode === 'date' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                        >
                          On date
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecurrenceEndMode('count')}
                          className={cn('px-3 py-1 rounded text-xs border', recurrenceEndMode === 'count' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                        >
                          After N times
                        </button>
                      </div>
                      {recurrenceEndMode === 'date' ? (
                        <Input type="date" className="h-8 mt-2" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} />
                      ) : (
                        <Input type="number" min="1" max="50" placeholder="e.g. 10" className="h-8 mt-2" value={recurrenceEndTimes} onChange={e => setRecurrenceEndTimes(e.target.value)} />
                      )}
                    </div>
                  </div>
                )}

                {/* Zoom link result */}
                {zoomLink && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Join URL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={zoomLink} readOnly className="text-xs bg-background" />
                      <Button type="button" size="sm" variant="ghost" onClick={copyZoomLink}>
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    {isRecurring && (
                      <p className="text-xs text-muted-foreground">
                        Recurring — {RECURRENCE_LABELS[recurrenceType]} meeting created
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddEvent(false); resetForm(); }}>Cancel</Button>
              <Button
                disabled={!newEventTitle.trim() || !newEventDate || isCreating}
                onClick={() => {
                  createEvent({
                    course_id: courseId!,
                    title: newEventTitle.trim(),
                    start_date: newEventDate,
                    description: newEventDescription,
                    location: newEventLocation,
                    link: zoomLink || undefined,
                    zoom_meeting_id: zoomMeetingId ?? undefined,
                    zoom_start_url: zoomStartUrl || undefined,
                    zoom_recurrence: isRecurring ? {
                      type: recurrenceType,
                      weekly_days: (recurrenceType === 'weekly' || recurrenceType === 'biweekly') ? selectedWeekdays : undefined,
                      end_date: recurrenceEndMode === 'date' ? recurrenceEndDate || undefined : undefined,
                      end_times: recurrenceEndMode === 'count' && recurrenceEndTimes ? parseInt(recurrenceEndTimes) : undefined,
                    } : undefined,
                  });
                  setShowAddEvent(false);
                  resetForm();
                }}
              >
                {isCreating ? 'Saving...' : 'Add Event'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Event Detail Dialog ──────────────────────────────────────── */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedEvent?.zoom_meeting_id && <Video className="h-5 w-5 text-blue-500" />}
                {selectedEvent?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedEvent && format(new Date(selectedEvent.start_date), 'MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {selectedEvent?.description && (
                <p className="text-sm">{selectedEvent.description}</p>
              )}
              {selectedEvent?.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedEvent.location}
                </div>
              )}
              {selectedEvent?.zoom_recurrence && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Recurring — {RECURRENCE_LABELS[(selectedEvent.zoom_recurrence as any).type] ?? 'recurring'}
                </div>
              )}
              {selectedEvent?.link && (
                <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                  <Video className="h-4 w-4" />
                  Join Zoom Meeting
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {canEdit && selectedEvent?.zoom_start_url && (
                <a href={selectedEvent.zoom_start_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:underline">
                  <Video className="h-4 w-4" />
                  Start as Host
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Badge variant="outline">{selectedEvent?.type}</Badge>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </CourseLayout>
  );
};

export default CourseCalendar;
