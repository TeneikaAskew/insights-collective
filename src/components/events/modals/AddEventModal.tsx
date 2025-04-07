
import { useState } from 'react';
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
import { useEventForm } from '../hooks/useEventForm';
import { EventFormFields } from './EventFormFields';
import { useToast } from '@/hooks/use-toast';

interface AddEventModalProps {
  onAddEvent: (event: any) => void;
  children?: React.ReactNode;
  editEvent?: any;
}

export function AddEventModal({ onAddEvent, children, editEvent }: AddEventModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const { formState, handlers, fileInputRef } = useEventForm(editEvent);
  
  const handleSubmit = () => {
    const { 
      title, description, type, eventFormat, date, 
      imageFile, imagePreview, image 
    } = formState;
    
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
      title: formState.title,
      description: formState.description,
      type: formState.type,
      format: formState.eventFormat,
      location: formState.eventFormat !== 'virtual' ? formState.location : null,
      link: formState.eventFormat !== 'in-person' ? formState.link : null,
      date: formState.date ? formState.date.toISOString().split('T')[0] : '',
      startTime: formState.startTime,
      endTime: formState.endTime,
      image: imageUrl,
      capacity: formState.capacity ? parseInt(formState.capacity) : null,
      registrations: editEvent?.registrations || 0,
      calendlyLink: formState.calendlyLink
    };

    onAddEvent(eventData);
    
    toast({
      title: editEvent ? 'Event Updated' : 'Event Added',
      description: editEvent 
        ? 'The event has been successfully updated.' 
        : 'The event has been successfully added.',
    });
    
    // Reset form
    handlers.resetForm();
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
        <EventFormFields
          title={formState.title}
          setTitle={handlers.setTitle}
          description={formState.description}
          setDescription={handlers.setDescription}
          type={formState.type}
          setType={handlers.setType}
          eventFormat={formState.eventFormat}
          setEventFormat={handlers.setEventFormat}
          location={formState.location}
          setLocation={handlers.setLocation}
          link={formState.link}
          setLink={handlers.setLink}
          date={formState.date}
          setDate={handlers.setDate}
          calendarOpen={formState.calendarOpen}
          setCalendarOpen={handlers.setCalendarOpen}
          startTime={formState.startTime}
          setStartTime={handlers.setStartTime}
          endTime={formState.endTime}
          setEndTime={handlers.setEndTime}
          image={formState.image}
          setImage={handlers.setImage}
          capacity={formState.capacity}
          setCapacity={handlers.setCapacity}
          calendlyLink={formState.calendlyLink}
          setCalendlyLink={handlers.setCalendlyLink}
          imageFile={formState.imageFile}
          setImageFile={handlers.setImageFile}
          imagePreview={formState.imagePreview}
          setImagePreview={handlers.setImagePreview}
          fileInputRef={fileInputRef}
          handleImageChange={handlers.handleImageChange}
          handleTriggerFileInput={handlers.handleTriggerFileInput}
        />
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
