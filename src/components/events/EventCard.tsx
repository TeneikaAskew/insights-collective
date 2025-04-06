
import { Calendar, Clock, MapPin, Link, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

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
  onRegister?: (eventId: string, userData?: any) => void;
}

export function EventCard({ event, onRegister }: EventCardProps) {
  const { isAuthenticated, user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };
  
  const handleRegister = () => {
    if (!isAuthenticated) {
      // Redirect to login page if not authenticated
      toast({
        title: "Authentication Required",
        description: "Please log in to register for this event.",
      });
      navigate('/login');
      return;
    }
    
    if (isAuthenticated) {
      // If user is logged in, use their account info
      onRegister?.(event.id, { name: user?.name, email: user?.email });
      toast({
        title: 'Registration Successful',
        description: 'You have been registered for this event.',
      });
      
      // Redirect to Calendly if available
      if (event.calendlyLink) {
        window.open(event.calendlyLink, '_blank');
      }
      
      setOpenDialog(false);
    } else if (name && email) {
      // For non-logged in users, collect their info
      onRegister?.(event.id, { name, email });
      toast({
        title: 'Registration Successful',
        description: 'You have been registered for this event.',
      });
      
      // Redirect to Calendly if available
      if (event.calendlyLink) {
        window.open(event.calendlyLink, '_blank');
      }
      
      setName('');
      setEmail('');
      setOpenDialog(false);
    } else {
      toast({
        title: 'Missing Information',
        description: 'Please provide your name and email to register.',
        variant: 'destructive',
      });
    }
  };
  
  const isAtCapacity = event.capacity !== null && event.registrations >= event.capacity;
  
  return (
    <Card className="h-full flex flex-col">
      <div className="relative w-full pt-[50%] overflow-hidden">
        <img 
          src={event.image || "https://via.placeholder.com/600x300?text=Event"} 
          alt={event.title} 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <Badge className="absolute top-2 right-2 bg-primary/90">{event.type}</Badge>
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
        <CardDescription>
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(event.date)}</span>
          </div>
          {event.startTime && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-4 w-4" />
              <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
          )}
          {event.link && (
            <div className="flex items-center gap-1 mt-1">
              <Link className="h-4 w-4" />
              <span className="truncate">Virtual Event</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-1 mt-1">
              <Users className="h-4 w-4" />
              <span>{event.registrations} / {event.capacity} registered</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground line-clamp-3">{event.description}</p>
      </CardContent>
      <CardFooter>
        {isAtCapacity ? (
          <Button disabled className="w-full">Event Full</Button>
        ) : (
          <Button className="w-full bg-primary text-white" onClick={handleRegister}>Register</Button>
        )}
      </CardFooter>
    </Card>
  );
}
