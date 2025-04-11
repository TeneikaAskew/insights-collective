
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Users, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    type: string;
    format: string;
    location: string | null;
    link: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    image: string | null;
    capacity: number | null;
    registrations: number;
    calendlyLink: string | null;
  };
  onRegister?: (eventId: string, userData?: any) => void;
  isPast?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onRegister, isPast = false }) => {
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Generate a valid UUID for this event based on its ID
  const getValidEventUuid = () => {
    // For real implementation, events in DB would already have proper UUIDs
    // This is just for mock data compatibility
    const storedId = localStorage.getItem(`event_${event.id}_uuid`);
    if (storedId) return storedId;
    
    const newId = uuidv4();
    localStorage.setItem(`event_${event.id}_uuid`, newId);
    return newId;
  };

  const validEventUuid = getValidEventUuid();

  // Check if user is registered for this event
  useEffect(() => {
    if (isAuthenticated && user) {
      const checkRegistration = async () => {
        try {
          const { data, error } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_id', validEventUuid)
            .maybeSingle();
          
          if (!error && data) {
            setIsRegistered(true);
          }
        } catch (error) {
          console.error('Error checking event registration:', error);
        }
      };
      
      checkRegistration();
    }
  }, [isAuthenticated, user, validEventUuid]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      // Store current path for redirect after login
      localStorage.setItem('redirectAfterLogin', '/events');
      navigate('/login', { state: { from: '/events' } });
      return;
    }
    
    setRegistering(true);
    
    try {
      const { error } = await supabase
        .from('event_registrations')
        .insert({
          user_id: user.id,
          event_id: validEventUuid
        });
      
      if (error) throw error;
      
      setIsRegistered(true);
      toast({
        title: "Registration successful!",
        description: `You have registered for ${event.title}`,
      });
      
      // Call parent onRegister if provided
      if (onRegister) {
        onRegister(event.id);
      }
    } catch (error: any) {
      console.error('Error registering for event:', error);
      toast({
        title: "Registration failed",
        description: error.message || "There was an error registering for this event",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isFull = event.capacity !== null && event.registrations >= event.capacity;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all">
      <div className="aspect-video overflow-hidden bg-muted">
        {event.image ? (
          <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
            <Calendar className="h-16 w-16 text-white opacity-50" />
          </div>
        )}
      </div>
      
      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge>{event.type}</Badge>
            <Badge variant="outline">{event.format}</Badge>
            {isPast && <Badge variant="secondary">Past</Badge>}
          </div>
          
          <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>
          
          <p className="text-muted-foreground text-sm line-clamp-2">
            {event.description}
          </p>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{formatDate(event.date)}</span>
          </div>
          
          {(event.startTime || event.endTime) && (
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-4 w-4 mr-2" />
              <span>
                {event.startTime ? formatTime(event.startTime) : ''} 
                {event.startTime && event.endTime ? ' - ' : ''} 
                {event.endTime ? formatTime(event.endTime) : ''}
              </span>
            </div>
          )}
          
          {event.location && (
            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-2" />
              <span>{event.location}</span>
            </div>
          )}
          
          {event.capacity && (
            <div className="flex items-center text-muted-foreground">
              <Users className="h-4 w-4 mr-2" />
              <span>{event.registrations} / {event.capacity} registered</span>
            </div>
          )}
        </div>
        
        <div className="pt-2">
          {isPast ? (
            <Button variant="outline" className="w-full" disabled>
              Event Ended
            </Button>
          ) : isRegistered ? (
            <Button variant="outline" className="w-full" disabled>
              Already Registered
            </Button>
          ) : isFull ? (
            <Button variant="outline" className="w-full" disabled>
              Event Full
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={handleRegister} 
              disabled={registering}
            >
              {registering ? 'Registering...' : 'Register Now'}
            </Button>
          )}
          
          {event.link && (
            <Button variant="link" className="w-full mt-2" asChild>
              <a href={event.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Event Details
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
