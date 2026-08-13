// ABOUTME: The user's calendar — month picker plus the events for the selected day
// ABOUTME: and an upcoming list. Extracted from the former standalone /calendar page
// ABOUTME: so it can render inside the Dashboard's Calendar tab.
//
// Deliberately renders no page chrome (no AppLayout, no <h1>): it is a panel, and the
// surrounding tab supplies the heading. That is what lets it drop into the Dashboard
// without a nested layout or a duplicate title.

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Calendar as CalendarIcon, GraduationCap, BookOpen, FileText, Clock } from 'lucide-react';
import { useUserCalendar } from '@/hooks/useCourseCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { format, isSameDay, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import { htmlToPlainText } from '@/utils/htmlToPlainText';
import { cn } from '@/lib/utils';

type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  start_date: string;
  course_id?: string;
  course_title?: string;
  description?: string;
  related_id?: string;
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'assignment': return 'bg-ss-teal-chip text-ss-teal';
    case 'quiz': return 'bg-ss-lav-chip text-ss-lav-deep';
    case 'event': return 'bg-ss-good-chip text-ss-good';
    case 'announcement': return 'bg-ss-warn-chip text-ss-warn';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getNavigationUrl = (event: CalendarEvent) => {
  if (event.type === 'assignment' && event.related_id) {
    return `/courses/${event.course_id}/assignments/${event.related_id}`;
  }
  if (event.type === 'quiz' && event.related_id) {
    return `/courses/${event.course_id}/quizzes/${event.related_id}`;
  }
  return `/courses/${event.course_id}/calendar`;
};

function EventCard({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
  return (
    // `block` is load-bearing: an <a> is display:inline by default, and vertical
    // margins do not apply to inline elements — so the `space-y-3` on the list
    // resolved to a measured 0px between every card and they read as one slab.
    <Link to={getNavigationUrl(event)} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{event.title}</h3>
              <p className="text-sm text-muted-foreground">{event.course_title}</p>
              {event.description && (
                // Assignment and quiz descriptions are stored as rich text, so
                // the raw markup was being printed at the reader: "<h3>Clean and
                // Transform Data</h3> <p>Take the provided <code>…".
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {htmlToPlainText(event.description)}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                {showDate && (
                  <>
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(event.start_date), 'EEE, MMM d')}
                    <span className="mx-1" />
                  </>
                )}
                <Clock className="h-3 w-3" />
                {format(new Date(event.start_date), 'h:mm a')}
              </div>
            </div>
            <Badge className={getEventColor(event.type)}>{event.type}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// The inner view (month day list vs. upcoming list) is controllable from outside so the
// Dashboard's "Upcoming Deadlines" stat can deep-link straight to the Upcoming list.
export type CalendarPanelView = 'selectedDay' | 'upcoming';

export function CalendarPanel({
  view,
  onViewChange,
}: {
  view?: CalendarPanelView;
  onViewChange?: (view: CalendarPanelView) => void;
} = {}) {
  const { user } = useAuth();
  const [uncontrolledView, setUncontrolledView] = useState<CalendarPanelView>('selectedDay');
  const activeView = view ?? uncontrolledView;
  const handleViewChange = (next: string) => {
    const value = next === 'upcoming' ? 'upcoming' : 'selectedDay';
    setUncontrolledView(value);
    onViewChange?.(value);
  };

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [activeFilters, setActiveFilters] = useState({
    quiz: true,
    assignment: true,
    event: true,
    announcement: true,
  });

  const filterTypes = Object.entries(activeFilters)
    .filter(([, enabled]) => enabled)
    .map(([type]) => type);

  const { events = [], isLoading, error: calendarError } = useUserCalendar(user?.id, {
    types: filterTypes,
  });

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const eventsForSelectedDate = events.filter(
    (event) => date && isSameDay(new Date(event.start_date), date),
  );

  const upcomingEvents = events
    .filter((event) => isAfter(new Date(event.start_date), new Date()))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const getDatesWithEvents = (checkDate: Date): boolean =>
    events.some((event) => isSameDay(new Date(event.start_date), checkDate));

  // One message for both tabs so a failed load never reads as "nothing scheduled",
  // which is the same thing an empty calendar looks like.
  const errorMessage = calendarError
    ? `Failed to load your calendar: ${calendarError instanceof Error ? calendarError.message : 'Please try again.'}`
    : null;

  const filters = [
    { key: 'quiz', label: 'Quizzes & Exams', icon: BookOpen },
    { key: 'assignment', label: 'Assignments', icon: FileText },
    { key: 'event', label: 'Events', icon: GraduationCap },
    { key: 'announcement', label: 'Announcements', icon: CalendarIcon },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        {filters.map(({ key, label, icon: Icon }) => (
          <Toggle
            key={key}
            pressed={activeFilters[key]}
            onPressedChange={() => toggleFilter(key)}
            className="data-[state=on]:bg-primary/20"
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </Toggle>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[350px_1fr]">
        <div>
          <Card>
            <CardContent className="p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="w-full"
                // react-day-picker sizes its month to fixed-width cells, which
                // leaves the card padded out with dead space. Stretch the month,
                // grid and rows so the grid fills the column at every width.
                //
                // THESE KEYS WERE v8's, AND v9 IGNORES THE ONES IT DOES NOT KNOW.
                //
                // `table`, `head_row`, `head_cell`, `row` and `cell` were renamed
                // to `month_grid`, `weekdays`, `weekday`, `week` and `day` in
                // react-day-picker v9 (`day` in turn renamed to `day_button`).
                // Unknown keys are not an error — they are dropped — so every
                // stretch rule above except `months`/`month` did nothing, and the
                // `day` rule landed on the CELL instead of the button. Measured on
                // /dashboard?tab=calendar at 414px before this change:
                //
                //     weekday headers   7 x 36px = 252px   (base calendar's w-9)
                //     day columns       7 x 51px = 357px   (flex-1, stretched)
                //     day button        36px at the cell's LEFT edge, cell 51px
                //
                // so "Su Mo Tu ..." sat above the wrong columns — Sa was a full
                // column short of Saturday — the numbers sat 7.5px left of their
                // own column's centre, and the selected/today/hasEvent background
                // (v9 puts modifier classNames on the cell, not the button) painted
                // the full 51x36 cell as an off-centre oval around a number that
                // was nowhere near its middle.
                //
                // v9 names throughout now, and the button fills its cell so the
                // number and every pill share one square, centred box.
                classNames={{
                  months: 'w-full',
                  month: 'w-full space-y-4',
                  month_grid: 'w-full border-collapse',
                  weekdays: 'flex w-full',
                  weekday: 'flex-1 text-muted-foreground font-normal text-[0.8rem] text-center',
                  week: 'flex w-full mt-2',
                  day: 'flex-1 aspect-square relative p-0 text-center text-sm rounded-full focus-within:relative focus-within:z-20',
                  day_button: cn(
                    buttonVariants({ variant: 'ghost' }),
                    'h-full w-full p-0 font-normal rounded-full aria-selected:opacity-100',
                  ),
                  // Cell-level backgrounds have to be circles now that the cell is
                  // the pill: the base classNames leave them square-cornered.
                  selected:
                    'rounded-full bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                  today: 'rounded-full bg-accent text-accent-foreground',
                }}
                modifiers={{ hasEvent: getDatesWithEvents }}
                modifiersClassNames={{ hasEvent: 'bg-primary/20 rounded-full' }}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Tabs value={activeView} onValueChange={handleViewChange}>
            <TabsList>
              <TabsTrigger value="selectedDay">Selected Day</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            </TabsList>

            <TabsContent value="selectedDay" className="space-y-4 mt-4">
              <h3 className="text-xl font-medium">
                {date
                  ? date.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Select a date'}
              </h3>

              {isLoading ? (
                <LoadingCards count={3} />
              ) : errorMessage ? (
                <p className="text-destructive" role="alert">{errorMessage}</p>
              ) : eventsForSelectedDate.length > 0 ? (
                <div className="space-y-3">
                  {eventsForSelectedDate.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No events scheduled for this day.</p>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4 mt-4">
              <h3 className="text-xl font-medium">Upcoming Events</h3>

              {isLoading ? (
                <LoadingCards count={5} />
              ) : errorMessage ? (
                <p className="text-destructive" role="alert">{errorMessage}</p>
              ) : upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 10).map((event) => (
                    <EventCard key={event.id} event={event} showDate />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No upcoming events.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default CalendarPanel;
