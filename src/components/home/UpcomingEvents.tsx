// ABOUTME: Upcoming events on the landing page, from the real `events` table.
// ABOUTME: Renders nothing when there are no events, so the section can never sit empty.
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, stagger } from './motion/Reveal';

type Event = {
  id: string;
  title: string;
  description: string;
  type: string;
  location: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  format?: string;
  capacity?: number | null;
  calendly_link?: string | null;
  image?: string | null;
};

type UpcomingEventsProps = {
  events: Event[];
};

/** `office_hours` → `Office Hours`. The column stores raw enum values. */
const humanize = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatEventDate = (dateString: string) => {
  const date = new Date(dateString);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { day: date.getDate(), month: monthNames[date.getMonth()] };
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return null;
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
};

const isPastEvent = (dateString: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateString);
  eventDate.setHours(0, 0, 0, 0);
  return eventDate < today;
};

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className="py-20 border-y border-studio-border bg-studio-cardWarm">
      <div className="container mx-auto px-4 max-w-6xl">
        <Reveal>
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">Events & Workshops</h2>
              <p className="mt-3 text-studio-muted max-w-2xl">
                Live sessions, office hours and review calls you can join.
              </p>
            </div>
            <Button
              variant="ghost"
              asChild
              className="group text-studio-lavDeep hover:text-studio-lavDeeper"
            >
              <Link to="/events" className="flex items-center">
                View All{' '}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {events.map((event, index) => {
            const { day, month } = formatEventDate(event.date);
            const past = isPastEvent(event.date);
            const time = formatTime(event.start_time);

            return (
              <Reveal key={event.id} delay={stagger(index)}>
                <Link to={`/events/${event.id}`} className="block group h-full">
                  <div className="studio-card h-full p-6 flex flex-col hover:-translate-y-0.5 transition-transform duration-300">
                    <div className="flex items-start gap-4">
                      {/* Date block. Most rows carry no image, so the date carries the card. */}
                      <div className="shrink-0 w-14 rounded-xl bg-studio-lavChip text-center py-2">
                        <div className="text-xl font-bold text-studio-lavDeeper leading-none">
                          {day}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-studio-lavDeep mt-1">
                          {month}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-studio-peachDeep">
                            {humanize(event.type)}
                          </span>
                          {event.format && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-studio-muted">
                              · {humanize(event.format)}
                            </span>
                          )}
                          {past && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-studio-muted">
                              · Past
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 font-semibold text-studio-ink line-clamp-2 group-hover:text-studio-lavDeep transition-colors">
                          {event.title}
                        </h3>
                      </div>
                    </div>

                    <p className="mt-4 text-[15px] leading-relaxed text-studio-muted line-clamp-2">
                      {event.description}
                    </p>

                    <div className="mt-4 space-y-1.5 text-sm text-studio-muted">
                      {time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>{time}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                      {event.capacity && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0" />
                          <span>{event.capacity} spots</span>
                        </div>
                      )}
                    </div>

                    <span className="mt-5 pt-4 border-t border-studio-border inline-flex items-center gap-1 text-sm font-semibold text-studio-lavDeep">
                      {past ? 'View details' : 'Register'}
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
