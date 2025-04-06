
import { useState } from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddEventModalProps {
  onAddEvent: (event: any) => void;
}

const eventTypes = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'conference', label: 'Conference' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'hackathon', label: 'Hackathon' },
];

const eventFormats = [
  { value: 'in-person', label: 'In-Person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
];

export function AddEventModal({ onAddEvent }: AddEventModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [format, setFormat] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [image, setImage] = useState('');
  const [capacity, setCapacity] = useState('');
  
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!title || !description || !type || !format || !date) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const newEvent = {
      id: Date.now().toString(),
      title,
      description,
      type,
      format,
      location: format !== 'virtual' ? location : null,
      link: format !== 'in-person' ? link : null,
      date: date ? date.toISOString().split('T')[0] : '',
      startTime,
      endTime,
      image: image || 'https://via.placeholder.com/600x300?text=Event+Image',
      capacity: capacity ? parseInt(capacity) : null,
      registrations: 0,
    };

    onAddEvent(newEvent);
    
    toast({
      title: 'Event Added',
      description: 'The event has been successfully added.',
    });
    
    // Reset form
    setTitle('');
    setDescription('');
    setType('');
    setFormat('');
    setLocation('');
    setLink('');
    setDate(undefined);
    setStartTime('');
    setEndTime('');
    setImage('');
    setCapacity('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
          <DialogDescription>
            Create a new event for users to register and attend.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Event title"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              placeholder="Event description"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Event Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type" className="col-span-3">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="format" className="col-span-3">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {eventFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {(format === 'in-person' || format === 'hybrid') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="col-span-3"
                placeholder="Physical location"
              />
            </div>
          )}
          
          {(format === 'virtual' || format === 'hybrid') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="link" className="text-right">
                Virtual Link
              </Label>
              <Input
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="col-span-3"
                placeholder="https://meeting.example.com"
              />
            </div>
          )}
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Date</Label>
            <div className="col-span-3">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => {
                      setDate(date);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startTime" className="text-right">
              Start Time
            </Label>
            <div className="relative col-span-3">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endTime" className="text-right">
              End Time
            </Label>
            <div className="relative col-span-3">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right">
              Image URL
            </Label>
            <Input
              id="image"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="col-span-3"
              placeholder="https://example.com/image.jpg (optional)"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="capacity" className="text-right">
              Capacity
            </Label>
            <Input
              id="capacity"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="col-span-3"
              placeholder="Maximum number of attendees (optional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
