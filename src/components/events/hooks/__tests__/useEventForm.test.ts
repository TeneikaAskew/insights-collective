import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventForm } from '../useEventForm';

describe('useEventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty form data when no editEvent provided', () => {
      const { result } = renderHook(() => useEventForm());

      expect(result.current.formState).toEqual({
        title: '',
        description: '',
        type: '',
        eventFormat: '',
        location: '',
        link: '',
        date: undefined,
        calendarOpen: false,
        startTime: '',
        endTime: '',
        image: '',
        capacity: '',
        calendlyLink: '',
        imageFile: null,
        imagePreview: null,
      });
      expect(result.current.handlers).toBeDefined();
      expect(result.current.fileInputRef).toBeDefined();
    });

    it('should initialize with editEvent data when provided', () => {
      const editEvent = {
        id: '1',
        title: 'Existing Event',
        description: 'Existing Description',
        date: '2025-01-15',
        startTime: '14:00',
        endTime: '16:00',
        type: 'webinar',
        format: 'virtual',
        location: null,
        link: 'https://zoom.us/meeting/123',
        capacity: 100,
        image: 'https://example.com/image.jpg',
        calendlyLink: 'https://calendly.com/event',
      };

      const { result } = renderHook(() => useEventForm(editEvent));

      expect(result.current.formState.title).toBe('Existing Event');
      expect(result.current.formState.description).toBe('Existing Description');
      expect(result.current.formState.type).toBe('webinar');
      expect(result.current.formState.eventFormat).toBe('virtual');
      expect(result.current.formState.link).toBe('https://zoom.us/meeting/123');
      expect(result.current.formState.capacity).toBe('100');
      expect(result.current.formState.imagePreview).toBe('https://example.com/image.jpg');
    });
  });

  describe('handlers', () => {
    it('should update title when setTitle is called', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setTitle('New Event Title');
      });

      expect(result.current.formState.title).toBe('New Event Title');
    });

    it('should update description when setDescription is called', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setDescription('New Description');
      });

      expect(result.current.formState.description).toBe('New Description');
    });

    it('should update type when setType is called', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setType('webinar');
      });

      expect(result.current.formState.type).toBe('webinar');
    });

    it('should update eventFormat when setEventFormat is called', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setEventFormat('virtual');
      });

      expect(result.current.formState.eventFormat).toBe('virtual');
    });

    it('should update date when setDate is called', () => {
      const { result } = renderHook(() => useEventForm());
      const testDate = new Date('2025-01-15');

      act(() => {
        result.current.handlers.setDate(testDate);
      });

      expect(result.current.formState.date).toEqual(testDate);
    });

    it('should handle image file change', () => {
      const { result } = renderHook(() => useEventForm());
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');

      act(() => {
        result.current.handlers.handleImageChange({
          target: { files: [mockFile] },
        } as any);
      });

      expect(result.current.formState.imageFile).toBe(mockFile);
      expect(result.current.formState.imagePreview).toBe('blob:test-url');
      expect(result.current.formState.image).toBe('');
    });

    it('should reset form when resetForm is called', () => {
      const { result } = renderHook(() => useEventForm());

      // Set some values first
      act(() => {
        result.current.handlers.setTitle('Test Event');
        result.current.handlers.setDescription('Test Description');
        result.current.handlers.setType('workshop');
      });

      // Reset the form
      act(() => {
        result.current.handlers.resetForm();
      });

      expect(result.current.formState.title).toBe('');
      expect(result.current.formState.description).toBe('');
      expect(result.current.formState.type).toBe('');
    });

    it('should trigger file input when handleTriggerFileInput is called', () => {
      const { result } = renderHook(() => useEventForm());
      
      // Create a mock click function
      const mockClick = vi.fn();
      result.current.fileInputRef.current = { click: mockClick } as any;

      act(() => {
        result.current.handlers.handleTriggerFileInput();
      });

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('calendar state', () => {
    it('should toggle calendar open state', () => {
      const { result } = renderHook(() => useEventForm());

      expect(result.current.formState.calendarOpen).toBe(false);

      act(() => {
        result.current.handlers.setCalendarOpen(true);
      });

      expect(result.current.formState.calendarOpen).toBe(true);

      act(() => {
        result.current.handlers.setCalendarOpen(false);
      });

      expect(result.current.formState.calendarOpen).toBe(false);
    });
  });

  describe('time fields', () => {
    it('should update start and end times', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setStartTime('14:00');
        result.current.handlers.setEndTime('16:00');
      });

      expect(result.current.formState.startTime).toBe('14:00');
      expect(result.current.formState.endTime).toBe('16:00');
    });
  });

  describe('location and link fields', () => {
    it('should update location for in-person events', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setEventFormat('in-person');
        result.current.handlers.setLocation('Conference Room A');
      });

      expect(result.current.formState.location).toBe('Conference Room A');
    });

    it('should update link for virtual events', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setEventFormat('virtual');
        result.current.handlers.setLink('https://zoom.us/meeting/123');
      });

      expect(result.current.formState.link).toBe('https://zoom.us/meeting/123');
    });
  });

  describe('capacity', () => {
    it('should update capacity', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setCapacity('50');
      });

      expect(result.current.formState.capacity).toBe('50');
    });
  });

  describe('calendly link', () => {
    it('should update calendly link', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handlers.setCalendlyLink('https://calendly.com/event/123');
      });

      expect(result.current.formState.calendlyLink).toBe('https://calendly.com/event/123');
    });
  });
});