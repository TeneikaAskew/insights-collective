import { Calendar, Clock, MapPin, Link, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { sanitizeUserInput } from '@/config/security';
interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    type: string;
    format: string;
    location?: string | null;
    link?: string | null;
    date: string;
    startTime?: string;
    endTime?: string;
    image?: string;
    capacity?: number | null;
    registrations: number;
    calendlyLink?: string;
  };
  onRegister?: (eventId: string) => void;
  isRegistered?: boolean; // Add isRegistered prop
  isRegistering?: boolean;
}
export function EventCard({
  event,
  onRegister,
  isRegistered = false,
  isRegistering = false
}: EventCardProps) {
  const {
    isAuthenticated,
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      return sanitizeUserInput(dateString, 50); // Sanitize fallback
    }
  };
  const handleRegister = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking button
    
    if (!isAuthenticated) {
      // Redirect to login page if not authenticated
      toast({
        title: "Authentication Required",
        description: "Please log in to register for this event.",
        variant: "default"
      });
      navigate('/login', {
        state: {
          redirectTo: `/events/${event.id}`
        }
      });
      return;
    }

    // If user is logged in, handle registration (toggle)
    onRegister?.(event.id);
  };
  
  const handleCardClick = () => {
    navigate(`/events/${event.id}`);
  };
  const isAtCapacity = event.capacity !== null && event.registrations >= event.capacity;
  return <Card 
    className="h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-200"
    onClick={handleCardClick}
  >
      <div className="relative w-full pt-[50%] overflow-hidden">
        <img src={event.image || "https://via.placeholder.com/600x300?text=Event"} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
        <Badge className="absolute top-2 right-2 text-white bg-energeticAmber">{event.type}</Badge>
        {isRegistered && <Badge className="absolute top-2 left-2 bg-green-500 text-white">Registered</Badge>}
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">{sanitizeUserInput(event.title, 200)}</CardTitle>
        <CardDescription className="space-y-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(event.date)}</span>
          </span>
          {event.startTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</span>
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </span>
          )}
          {event.link && (
            <span className="flex items-center gap-1">
              <Link className="h-4 w-4" />
              <span className="truncate">Virtual Event</span>
            </span>
          )}
          {event.capacity && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{event.registrations} / {event.capacity} registered</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground line-clamp-3">{sanitizeUserInput(event.description, 500)}</p>
      </CardContent>
      <CardFooter>
        {onRegister ? (
          isRegistered ? (
            <Button 
              disabled
              className="w-full bg-gray-100 text-gray-600 cursor-not-allowed"
              onClick={(e) => e.stopPropagation()}
            >
              Already Registered
            </Button>
          ) : isAtCapacity ? (
            <Button disabled className="w-full" onClick={(e) => e.stopPropagation()}>Event Full</Button>
          ) : (
            <Button 
              onClick={handleRegister} 
              disabled={isRegistering}
              className="w-full text-white bg-insightBlue hover:bg-insightBlue/90"
            >
              {isRegistering ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                'Register'
              )}
            </Button>
          )
        ) : (
          <Button disabled className="w-full" onClick={(e) => e.stopPropagation()}>Registration Closed</Button>
        )}
      </CardFooter>
    </Card>;
}