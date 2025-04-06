
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Event = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
};

type UpcomingEventsProps = {
  events: Event[];
};

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Upcoming Events</h2>
          <Button variant="ghost" asChild>
            <Link to="/events" className="flex items-center">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video relative bg-primary/20">
                <div className="absolute inset-0 flex flex-col justify-center items-center">
                  <Calendar className="h-12 w-12 text-primary mb-2" />
                  <div className="text-center">
                    <p className="text-xl font-bold">{new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm">{new Date(event.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-2">
                  <span className="text-sm font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {event.category}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                <p className="text-muted-foreground mb-4 line-clamp-2">{event.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm">{event.location}</span>
                  <Button size="sm" asChild>
                    <Link to={`/events/${event.id}`}>Register</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
