
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EventFormFields, eventTypes, eventFormats } from '@/components/events/modals/EventFormFields';
import { useEventForm } from '@/components/events/hooks/useEventForm';
import { toast } from 'sonner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AddEventModal');

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
    
    logger.log('Form submission started');
    logger.log('Form state:', formState);
    
    // Validate required fields based on Supabase schema
    const errors: string[] = [];
    
    if (!formState.title) errors.push('Title is required');
    if (!formState.description) errors.push('Description is required');
    if (!formState.type) errors.push('Event type is required');
    if (!formState.eventFormat) errors.push('Event format is required');
    if (!formState.date) errors.push('Date is required');
    
    if (errors.length > 0) {
      logger.error('Validation errors:', errors);
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
      // Empty strings are not valid for the Postgres time column — send null.
      start_time: formState.startTime || null,
      end_time: formState.endTime || null,
      // No stock-photo fallback: an event without artwork stores null and the
      // UI renders a neutral placeholder instead of a fabricated image.
      image: formState.image || formState.imagePreview || null,
      capacity: formState.capacity ? parseInt(formState.capacity) : null,
      calendly_link: formState.calendlyLink,
    };
    
    // Add ID only for edits
    if (editEvent?.id) {
      eventData.id = editEvent.id;
    }
    
    logger.log('Submitting event data:', eventData);
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
