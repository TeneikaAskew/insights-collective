
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, Users, Video, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
};

type UpcomingEventsProps = {
  events: Event[];
};

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  // If no events, don't render the section
  if (!events || events.length === 0) {
    return null;
  }
  // Get event type icon
  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'workshop':
        return Users;
      case 'webinar':
        return Video;
      case 'conference':
        return Users;
      case 'meetup':
        return Users;
      case 'hackathon':
        return Users;
      default:
        return Calendar;
    }
  };
  
  // Get type badge style
  const getTypeStyle = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'workshop':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'webinar':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'conference':
        return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'meetup':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'hackathon':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };
  
  // Format date nicely
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleString('default', { month: 'short' }),
      time: date.toLocaleString('default', { hour: '2-digit', minute: '2-digit' }),
      fullDate: date.toLocaleDateString('default', { 
        weekday: 'short', 
        month: 'long', 
        day: 'numeric' 
      })
    };
  };

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-800/50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display">Events & Workshops</h2>
          <Button variant="ghost" asChild className="group">
            <Link to="/events" className="flex items-center">
              View All <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
            const EventIcon = getEventIcon(event.type);
            const dateObj = formatEventDate(event.date);
            const today = new Date().toISOString().split('T')[0];
            const isPastEvent = event.date < today;
            
            return (
              <div 
                key={event.id} 
                className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-all duration-300 group relative"
              >
                {isPastEvent && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      Past Event
                    </Badge>
                  </div>
                )}
                <div className="aspect-video relative bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="absolute inset-0 flex justify-between p-4">
                    <div className="flex flex-col justify-center items-center bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md border border-gray-100 dark:border-gray-700 w-20 h-20">
                      <p className="text-2xl font-bold text-primary">{dateObj.day}</p>
                      <p className="text-sm uppercase text-gray-500">{dateObj.month}</p>
                    </div>
                    
                    <Badge variant="outline" className={`${getTypeStyle(event.type)} h-fit font-medium flex items-center`}>
                      <EventIcon className="h-3 w-3 mr-1" />
                      {event.type}
                    </Badge>
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Calendar className="text-primary/20 h-20 w-20" />
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300">{event.title}</h3>
                  <p className="text-muted-foreground mb-4 line-clamp-2">{event.description}</p>
                  
                  <div className="flex flex-col space-y-2 mb-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground/70" /> 
                      <span>{event.start_time || dateObj.time}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground/70" /> 
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Link 
                      to={`/events/${event.id}`}
                      className="text-primary text-sm font-medium hover:underline flex items-center group-hover:translate-x-1 transition-transform duration-300"
                    >
                      Event details <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                    <Button size="sm" asChild>
                      <Link to={`/events/${event.id}`}>Register</Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
