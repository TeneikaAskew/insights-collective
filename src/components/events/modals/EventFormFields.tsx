
import { useState } from 'react';
import { CalendarIcon, Clock, Upload } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

export const eventTypes = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'conference', label: 'Conference' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'hackathon', label: 'Hackathon' },
];

export const eventFormats = [
  { value: 'in-person', label: 'In-Person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
];

interface EventFormFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  eventFormat: string;
  setEventFormat: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  date: Date | undefined;
  setDate: (value: Date | undefined) => void;
  calendarOpen: boolean;
  setCalendarOpen: (value: boolean) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  image: string;
  setImage: (value: string) => void;
  capacity: string;
  setCapacity: (value: string) => void;
  calendlyLink: string;
  setCalendlyLink: (value: string) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTriggerFileInput: () => void;
}

export function EventFormFields({
  title,
  setTitle,
  description,
  setDescription,
  type,
  setType,
  eventFormat,
  setEventFormat,
  location,
  setLocation,
  link,
  setLink,
  date,
  setDate,
  calendarOpen,
  setCalendarOpen,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  image,
  setImage,
  capacity,
  setCapacity,
  calendlyLink,
  setCalendlyLink,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  fileInputRef,
  handleImageChange,
  handleTriggerFileInput,
}: EventFormFieldsProps) {
  return (
    <div className="grid gap-4 py-4">
      {/* Title field */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-3"
          placeholder="Event title"
          required
        />
      </div>
      
      {/* Description field */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="col-span-3"
          placeholder="Event description"
          required
        />
      </div>
      
      {/* Event Type field */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="type" className="text-right">
          Event Type <span className="text-destructive">*</span>
        </Label>
        <Select value={type} onValueChange={setType} required>
          <SelectTrigger id="type" className="col-span-3">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((eventType) => (
              <SelectItem key={eventType.value} value={eventType.value}>
                {eventType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Format field */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="format" className="text-right">
          Format <span className="text-destructive">*</span>
        </Label>
        <Select value={eventFormat} onValueChange={setEventFormat} required>
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
        <Label className="text-right">Date <span className="text-destructive">*</span></Label>
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
  );
}
