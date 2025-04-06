
import React from 'react';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/events/EventCard';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Mock events data (upcoming events only)
const upcomingEvents = [
  {
    id: '1',
    title: 'Data Science Workshop',
    description: 'Learn the fundamentals of data science, from data preprocessing to model deployment.',
    type: 'workshop',
    format: 'in-person',
    location: 'San Francisco Tech Hub',
    link: null,
    date: '2025-05-15',
    startTime: '09:00',
    endTime: '17:00',
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODY2OA&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 50,
    registrations: 32,
  },
  {
    id: '3',
    title: 'Python for Data Analysis Webinar',
    description: 'A comprehensive online workshop covering pandas, numpy, and data visualization with Python.',
    type: 'webinar',
    format: 'virtual',
    location: null,
    link: 'https://example.com/python-webinar',
    date: '2025-05-20',
    startTime: '14:00',
    endTime: '16:00',
    image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODcwNw&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: null,
    registrations: 215,
  },
  {
    id: '4',
    title: 'AI Ethics Meetup',
    description: 'A discussion group focused on ethical considerations in artificial intelligence development and deployment.',
    type: 'meetup',
    format: 'in-person',
    location: 'Boston Innovation Hub',
    link: null,
    date: '2025-05-25',
    startTime: '18:00',
    endTime: '20:00',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODg3Ng&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 30,
    registrations: 24,
  },
];

const EventsSection = () => {
  const handleRegister = (eventId: string) => {
    console.log(`Registered for event: ${eventId}`);
  };

  return (
    <section className="py-12 px-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Upcoming Events</h2>
          <Button variant="outline" asChild>
            <Link to="/events" className="flex items-center">
              View all events
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents.map((event) => (
            <EventCard key={event.id} event={event} onRegister={handleRegister} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;
