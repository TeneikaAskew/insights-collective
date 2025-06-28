
import { useState, useRef } from 'react';

export interface EventFormState {
  title: string;
  description: string;
  type: string;
  eventFormat: string;
  location: string;
  link: string;
  date: Date | undefined;
  startTime: string;
  endTime: string;
  image: string;
  capacity: string;
  calendlyLink: string;
  imageFile: File | null;
  imagePreview: string | null;
  calendarOpen: boolean;
}

interface EventData {
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  format?: string;
  location?: string | null;
  link?: string | null;
  date?: string;
  startTime?: string;
  endTime?: string | null;
  image?: string;
  capacity?: number | null;
  registrations?: number;
  calendlyLink?: string;
}

export function useEventForm(editEvent?: EventData) {
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

  const resetForm = () => {
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
  };

  return {
    formState: {
      title,
      description,
      type,
      eventFormat,
      location,
      link,
      date,
      calendarOpen,
      startTime,
      endTime,
      image,
      capacity,
      calendlyLink,
      imageFile,
      imagePreview,
    },
    handlers: {
      setTitle,
      setDescription,
      setType,
      setEventFormat,
      setLocation,
      setLink,
      setDate,
      setCalendarOpen,
      setStartTime,
      setEndTime,
      setImage,
      setCapacity,
      setCalendlyLink,
      setImageFile,
      setImagePreview,
      handleImageChange,
      handleTriggerFileInput,
      resetForm,
    },
    fileInputRef,
  };
}
