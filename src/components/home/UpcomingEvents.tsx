import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, Users, Video, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

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

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  // If no events, don't render the section
  if (!events || events.length === 0) {
    return null;
  }

  // Get event type badge color
  const getTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'workshop':
        return 'bg-ss-teal-chip text-ss-teal';
      case 'webinar':
        return 'bg-ss-lav-chip text-ss-lav-deep';
      case 'conference':
        return 'bg-ss-warn-chip text-ss-warn';
      case 'meetup':
        return 'bg-ss-good-chip text-ss-good';
      case 'hackathon':
        return 'bg-ss-warn-chip text-ss-peach-deep';
      case 'panel':
        return 'bg-ss-bad-chip text-ss-bad';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Get format badge style
  const getFormatStyle = (format?: string): string => {
    switch (format?.toLowerCase()) {
      case 'virtual':
      case 'online':
        return 'bg-ss-teal-chip text-ss-teal border-border';
      case 'in-person':
        return 'bg-ss-good-chip text-ss-good border-border';
      case 'hybrid':
        return 'bg-ss-lav-chip text-ss-lav-deep border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Format date nicely
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return {
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
      fullDate: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric',
        month: 'long', 
        day: 'numeric' 
      })
    };
  };

  // Format time
  const formatTime = (timeString?: string | null) => {
    if (!timeString) return null;
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  // Check if event is past
  const isPastEvent = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateString);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  };


  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
            Events & Workshops
          </h2>
          <Button variant="ghost" asChild className="group">
            <Link to="/events" className="flex items-center">
              View All <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event, index) => {
            const dateObj = formatEventDate(event.date);
            const isPast = isPastEvent(event.date);
            const timeFormatted = formatTime(event.start_time);
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link to={`/events/${event.id}`} className="block group">
                  <div className="rounded-xl overflow-hidden border border-border bg-card shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                    <div className="aspect-video overflow-hidden relative">
                      {/* No stock-photo fallback: events without real artwork
                          render a neutral gradient block instead. */}
                      {event.image ? (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full bg-ss-lav-chip flex items-center justify-center"
                          aria-hidden="true"
                        >
                          <Calendar className="h-10 w-10 text-primary/40" />
                        </div>
                      )}
                      
                      {/* Date overlay */}
                      <div className="absolute top-3 left-3 bg-card/95 backdrop-blur-sm rounded-lg p-2.5 text-center shadow-lg">
                        <div className="text-2xl font-bold text-primary">{dateObj.day}</div>
                        <div className="text-xs uppercase text-muted-foreground">{dateObj.month}</div>
                      </div>
                      
                      {/* Past event badge */}
                      {isPast && (
                        <div className="absolute top-3 right-3 bg-foreground/80 text-background text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg">
                          Past Event
                        </div>
                      )}
                      
                      {/* Popular badge for high capacity events */}
                      {!isPast && event.capacity && event.capacity >= 100 && (
                        <div className="absolute top-3 right-3 bg-ss-peach-deep text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg flex items-center">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Popular
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 flex-grow flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={`font-medium px-2.5 py-1 ${getTypeColor(event.type)}`}>
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </Badge>
                        {event.format && (
                          <Badge variant="outline" className={`${getFormatStyle(event.format)} font-medium text-xs`}>
                            {event.format}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-semibold mb-3 line-clamp-1 group-hover:text-primary transition-colors duration-300">
                        {event.title}
                      </h3>
                      <p className="text-muted-foreground mb-4 line-clamp-2">{event.description}</p>
                      
                      <div className="mt-auto space-y-2">
                        {timeFormatted && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{timeFormatted}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="line-clamp-1">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="px-6 py-4 border-t border-border bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-muted-foreground text-sm">
                          {event.capacity && (
                            <>
                              <Users className="h-4 w-4 mr-1" />
                              <span>{event.capacity} spots</span>
                            </>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-primary hover:text-primary hover:bg-primary/10 -mr-2 px-2 py-1 h-7"
                        >
                          <span className="mr-1">{isPast ? 'View' : 'Register'}</span>
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform duration-300" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;