
import { useState, useRef } from 'react';
import { CalendarIcon, Clock, Upload } from 'lucide-react';
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
import { format as formatDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddEventModalProps {
  onAddEvent: (event: any) => void;
  children?: React.ReactNode;
  editEvent?: any;
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

export function AddEventModal({ onAddEvent, children, editEvent }: AddEventModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(editEvent?.title || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [type, setType] = useState(editEvent?.type || '');
  const [eventFormat, setEventFormat] = useState(editEvent?.format || '');
  const [location, setLocation] = useState(editEvent?.location || '');
  const [link, setLink] = useState(editEvent?.link || '');
  const [date, setDate] = useState<Date | undefined>(
    editEvent?.date ? new Date(editEvent.date) : undefined
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [startTime, setStartTime] = useState(editEvent?.startTime || '');
  const [endTime, setEndTime] = useState(editEvent?.endTime || '');
  const [image, setImage] = useState(editEvent?.image || '');
  const [capacity, setCapacity] = useState(editEvent?.capacity?.toString() || '');
  const [calendlyLink, setCalendlyLink] = useState(editEvent?.calendlyLink || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    editEvent?.image || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImage(''); // Clear the URL input when a file is selected
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = () => {
    if (!title || !description || !type || !eventFormat || !date) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // In a real app, you would upload the imageFile to your server or storage
    // and get a URL back. For this demo, we'll use the existing URL or preview
    const imageUrl = imageFile 
      ? imagePreview 
      : (image || 'https://via.placeholder.com/600x300?text=Event+Image');

    const eventData = {
      id: editEvent?.id || Date.now().toString(),
      title,
      description,
      type,
      format: eventFormat,
      location: eventFormat !== 'virtual' ? location : null,
      link: eventFormat !== 'in-person' ? link : null,
      date: date ? date.toISOString().split('T')[0] : '',
      startTime,
      endTime,
      image: imageUrl,
      capacity: capacity ? parseInt(capacity) : null,
      registrations: editEvent?.registrations || 0,
      calendlyLink
    };

    onAddEvent(eventData);
    
    toast({
      title: editEvent ? 'Event Updated' : 'Event Added',
      description: editEvent 
        ? 'The event has been successfully updated.' 
        : 'The event has been successfully added.',
    });
    
    // Reset form
    setTitle('');
    setDescription('');
    setType('');
    setEventFormat('');
    setLocation('');
    setLink('');
    setDate(undefined);
    setStartTime('');
    setEndTime('');
    setImage('');
    setCapacity('');
    setCalendlyLink('');
    setImageFile(null);
    setImagePreview(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>{editEvent ? 'Edit Event' : 'Add Event'}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
          <DialogDescription>
            {editEvent ? 'Update event details.' : 'Create a new event for users to register and attend.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Title field */}
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
          
          {/* Description field */}
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
          
          {/* Event Type field */}
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
          
          {/* Format field */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Select value={eventFormat} onValueChange={setEventFormat}>
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
          
          {/* Location field (conditional) */}
          {(eventFormat === 'in-person' || eventFormat === 'hybrid') && (
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
          
          {/* Virtual Link field (conditional) */}
          {(eventFormat === 'virtual' || eventFormat === 'hybrid') && (
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
          
          {/* Date field */}
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
                    {date ? formatDate(date, "PPP") : <span>Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      setDate(newDate);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Time fields */}
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
          
          {/* Image upload */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Event Image
            </Label>
            <div className="col-span-3 space-y-4">
              {imagePreview && (
                <div className="relative w-full h-32 overflow-hidden rounded-md border">
                  <img 
                    src={imagePreview} 
                    alt="Event preview" 
                    className="object-cover w-full h-full" 
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTriggerFileInput}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Image</span>
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <span className="text-sm text-muted-foreground">or</span>
              </div>
              <Input
                placeholder="Image URL (optional)"
                value={image}
                onChange={(e) => {
                  setImage(e.target.value);
                  if (e.target.value) {
                    setImagePreview(e.target.value);
                    setImageFile(null);
                  } else {
                    setImagePreview(null);
                  }
                }}
              />
            </div>
          </div>
          
          {/* Calendly link field */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="calendlyLink" className="text-right">
              Calendly Link
            </Label>
            <Input
              id="calendlyLink"
              value={calendlyLink}
              onChange={(e) => setCalendlyLink(e.target.value)}
              className="col-span-3"
              placeholder="https://calendly.com/your-account/event"
            />
          </div>
          
          {/* Capacity field */}
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
          <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700 text-white">
            {editEvent ? 'Update Event' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
