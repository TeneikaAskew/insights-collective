import { useParams } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvents';
import { useEventRegistrationCount, useIsRegisteredForEvent, useRegisterForEvent, useUnregisterFromEvent } from '@/hooks/useEventRegistrations';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, Users, Video, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: event, isLoading } = useEvent(eventId!);
  const { data: registrationCount = 0 } = useEventRegistrationCount(eventId!);
  const { data: isRegistered = false } = useIsRegisteredForEvent(eventId!);
  const registerMutation = useRegisterForEvent();
  const unregisterMutation = useUnregisterFromEvent();

  const handleRegister = async () => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to register for events.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isRegistered) {
        await unregisterMutation.mutateAsync(eventId!);
        toast({
          title: 'Registration Cancelled',
          description: 'You have been unregistered from this event.',
        });
      } else {
        await registerMutation.mutateAsync(eventId!);
        toast({
          title: 'Registration Successful',
          description: 'You have been registered for this event.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update registration.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString?: string) => {
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

  const isPastEvent = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateString);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Skeleton className="h-64 w-full mb-6" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
            <p className="text-muted-foreground">The event you're looking for doesn't exist or has been removed.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isPast = isPastEvent(event.date);
  const isRegistering = registerMutation.isPending || unregisterMutation.isPending;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Badge className={`font-medium px-3 py-1 ${getTypeColor(event.type)}`}>
                  {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                </Badge>
                <Badge variant="outline" className={`${getFormatStyle(event.format)} font-medium`}>
                  {event.format}
                </Badge>
                {isPast && (
                  <Badge variant="secondary">Past Event</Badge>
                )}
              </div>
              
              <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
              
              <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  <span>{formatDate(event.date)}</span>
                </div>
                {event.start_time && (
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    <span>{formatTime(event.start_time)}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    <span>{event.location}</span>
                  </div>
                )}
                {event.capacity && (
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    <span>{registrationCount} / {event.capacity} registered</span>
                  </div>
                )}
              </div>
            </div>

            {/* Event Image */}
            {event.image && (
              <div className="mb-6">
                <img 
                  src={event.image} 
                  alt={event.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <Card>
              <CardHeader>
                <CardTitle>Registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isPast && (
                  <Button 
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="w-full"
                    variant={isRegistered ? "outline" : "default"}
                  >
                    {isRegistering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isRegistered ? 'Cancel Registration' : 'Register for Event'}
                  </Button>
                )}
                
                {event.calendly_link && !isPast && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={event.calendly_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Schedule via Calendly
                    </a>
                  </Button>
                )}

                {event.link && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={event.link} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4 mr-2" />
                      Join Event
                    </a>
                  </Button>
                )}

                <div className="text-sm text-muted-foreground">
                  <p><strong>{registrationCount}</strong> people registered</p>
                  {event.capacity && (
                    <p><strong>{event.capacity - registrationCount}</strong> spots remaining</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">Type</p>
                  <p className="text-muted-foreground">{event.type}</p>
                </div>
                <div>
                  <p className="font-medium">Format</p>
                  <p className="text-muted-foreground">{event.format}</p>
                </div>
                <div>
                  <p className="font-medium">Date</p>
                  <p className="text-muted-foreground">{formatDate(event.date)}</p>
                </div>
                {event.start_time && (
                  <div>
                    <p className="font-medium">Time</p>
                    <p className="text-muted-foreground">
                      {formatTime(event.start_time)}
                      {event.end_time && ` - ${formatTime(event.end_time)}`}
                    </p>
                  </div>
                )}
                {event.location && (
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-muted-foreground">{event.location}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}