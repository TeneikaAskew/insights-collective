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
        return 'bg-blue-100 text-blue-600';
      case 'webinar':
        return 'bg-purple-100 text-purple-600';
      case 'conference':
        return 'bg-amber-100 text-amber-600';
      case 'meetup':
        return 'bg-green-100 text-green-600';
      case 'hackathon':
        return 'bg-orange-100 text-orange-600';
      case 'panel':
        return 'bg-pink-100 text-pink-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Get format badge style
  const getFormatStyle = (format?: string): string => {
    switch (format?.toLowerCase()) {
      case 'virtual':
      case 'online':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'in-person':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'hybrid':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
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

  // Get default image based on event type
  const getDefaultImage = (type: string): string => {
    const images = {
      workshop: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=450&fit=crop',
      webinar: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=450&fit=crop',
      conference: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=450&fit=crop',
      meetup: 'https://images.unsplash.com/photo-1515169067868-5387ec356754?w=800&h=450&fit=crop',
      hackathon: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=450&fit=crop',
      panel: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=800&h=450&fit=crop',
    };
    return images[type.toLowerCase()] || images.conference;
  };

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
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
                  <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                    <div className="aspect-video overflow-hidden relative">
                      <img 
                        src={event.image || getDefaultImage(event.type)} 
                        alt={event.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                      
                      {/* Date overlay */}
                      <div className="absolute top-3 left-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg p-2.5 text-center shadow-lg">
                        <div className="text-2xl font-bold text-primary">{dateObj.day}</div>
                        <div className="text-xs uppercase text-gray-600 dark:text-gray-400">{dateObj.month}</div>
                      </div>
                      
                      {/* Past event badge */}
                      {isPast && (
                        <div className="absolute top-3 right-3 bg-gray-900/80 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg">
                          Past Event
                        </div>
                      )}
                      
                      {/* Popular badge for high capacity events */}
                      {!isPast && event.capacity && event.capacity >= 100 && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg flex items-center">
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
                    
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
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