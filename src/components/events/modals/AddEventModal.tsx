
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EventFormFields, eventTypes, eventFormats } from '@/components/events/modals/EventFormFields';
import { useEventForm } from '@/components/events/hooks/useEventForm';
import { supabase } from '@/integrations/supabase/client';
import { validateFileUpload } from '@/config/security';
import { toast } from 'sonner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AddEventModal');

const EVENT_IMAGE_BUCKET = 'event-images';

// Upload a selected image File to Storage and return its durable public URL.
// Replaces the previous behavior of persisting an ephemeral blob: URL.
async function uploadEventImage(file: File): Promise<string> {
  const validation = validateFileUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to upload an image.');
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${user.id}/events/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(EVENT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (uploadError) {
    throw uploadError;
  }
  const { data: pub } = supabase.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    logger.log('Form submission started');

    // Validate required fields based on Supabase schema
    const errors: string[] = [];

    if (!formState.title) errors.push('Title is required');
    if (!formState.description) errors.push('Description is required');
    if (!formState.type) errors.push('Event type is required');
    if (!formState.eventFormat) errors.push('Event format is required');
    if (!formState.date) errors.push('Date is required');

    if (errors.length > 0) {
      logger.error('Validation errors:', errors);
      toast.error('Please fill in all required fields', { description: errors.join('\n') });
      return;
    }

    // Resolve the image to a durable URL. A newly-selected file is uploaded to
    // Storage; a typed URL is used as-is; on edit with no change we keep the
    // previously-stored URL. A blob: preview URL is never persisted.
    setIsSubmitting(true);
    let imageUrl: string | null = null;
    try {
      if (formState.imageFile) {
        imageUrl = await uploadEventImage(formState.imageFile);
      } else if (formState.image) {
        imageUrl = formState.image;
      } else if (formState.imagePreview && !formState.imagePreview.startsWith('blob:')) {
        imageUrl = formState.imagePreview;
      }
    } catch (err: any) {
      logger.error('Event image upload failed:', err);
      toast.error('Image upload failed', { description: err?.message || 'Could not upload the image.' });
      setIsSubmitting(false);
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
      image: imageUrl,
      capacity: formState.capacity ? parseInt(formState.capacity) : null,
      calendly_link: formState.calendlyLink,
    };

    // Add ID only for edits
    if (editEvent?.id) {
      eventData.id = editEvent.id;
    }

    logger.log('Submitting event data');
    onAddEvent(eventData);
    setIsSubmitting(false);
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {children}
    </Dialog>
  );
}
