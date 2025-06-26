
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EventFormFields, eventTypes, eventFormats } from '@/components/events/modals/EventFormFields';
import { useEventForm } from '@/components/events/hooks/useEventForm';

interface AddEventModalProps {
  open: boolean;
  onAddEvent: (event: any) => void;
  editEvent?: any;
  onClose: () => void;
  children?: React.ReactNode;
}

export function AddEventModal({ open, onAddEvent, editEvent, onClose, children }: AddEventModalProps) {
  const {
    formState,
    handlers,
    fileInputRef
  } = useEventForm(editEvent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started');
    console.log('Form state:', formState);
    
    // Validate required fields based on Supabase schema
    const errors: string[] = [];
    
    if (!formState.title) errors.push('Title is required');
    if (!formState.description) errors.push('Description is required');
    if (!formState.type) errors.push('Event type is required');
    if (!formState.eventFormat) errors.push('Event format is required');
    if (!formState.date) errors.push('Date is required');
    
    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      alert('Please fill in all required fields:\n' + errors.join('\n'));
      return;
    }
    
    // Create a formatted date string
    const dateString = formState.date.toISOString().split('T')[0];
    
    // Build the event object - remove ID for new events (let database auto-generate)
    const eventData: any = {
      title: formState.title,
      description: formState.description,
      type: formState.type,
      format: formState.eventFormat,
      location: (formState.eventFormat === 'in-person' || formState.eventFormat === 'hybrid') ? formState.location : null,
      link: (formState.eventFormat === 'virtual' || formState.eventFormat === 'hybrid') ? formState.link : null,
      date: dateString,
      start_time: formState.startTime,
      end_time: formState.endTime || null,
      image: formState.image || formState.imagePreview || 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODY2OA&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
      capacity: formState.capacity ? parseInt(formState.capacity) : null,
      calendly_link: formState.calendlyLink,
    };
    
    // Add ID only for edits
    if (editEvent?.id) {
      eventData.id = editEvent.id;
    }
    
    console.log('Submitting event data:', eventData);
    onAddEvent(eventData);
  };
  
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
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
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {editEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {children}
    </Dialog>
  );
}
