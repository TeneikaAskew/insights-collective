import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventForm } from '../useEventForm';
import * as eventService from '@/services/eventService';
import { useToast } from '@/hooks/use-toast';

vi.mock('@/services/eventService');
vi.mock('@/hooks/use-toast');

describe('useEventForm', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);
  });

  describe('initialization', () => {
    it('should initialize with empty form data when no editEvent provided', () => {
      const { result } = renderHook(() => useEventForm());

      expect(result.current.formData).toEqual({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        type: 'workshop',
        format: 'in-person',
        location: '',
        link: '',
        capacity: null,
        image_url: '',
      });
      expect(result.current.errors).toEqual({});
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should initialize with editEvent data when provided', () => {
      const editEvent = {
        id: '1',
        title: 'Existing Event',
        description: 'Existing Description',
        date: '2025-01-15',
        start_time: '14:00',
        end_time: '16:00',
        type: 'webinar',
        format: 'virtual',
        location: null,
        link: 'https://zoom.us/meeting/123',
        capacity: 100,
        image_url: 'https://example.com/image.jpg',
      };

      const { result } = renderHook(() => useEventForm(editEvent as any));

      expect(result.current.formData).toEqual({
        title: 'Existing Event',
        description: 'Existing Description',
        date: '2025-01-15',
        start_time: '14:00',
        end_time: '16:00',
        type: 'webinar',
        format: 'virtual',
        location: '',
        link: 'https://zoom.us/meeting/123',
        capacity: 100,
        image_url: 'https://example.com/image.jpg',
      });
    });
  });

  describe('handleInputChange', () => {
    it('should update form data for text inputs', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handleInputChange({
          target: { name: 'title', value: 'New Event Title' },
        } as any);
      });

      expect(result.current.formData.title).toBe('New Event Title');
    });

    it('should update form data for number inputs', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handleInputChange({
          target: { name: 'capacity', value: '50', type: 'number' },
        } as any);
      });

      expect(result.current.formData.capacity).toBe(50);
    });

    it('should handle empty number input', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handleInputChange({
          target: { name: 'capacity', value: '', type: 'number' },
        } as any);
      });

      expect(result.current.formData.capacity).toBe(null);
    });

    it('should clear field error when updating', () => {
      const { result } = renderHook(() => useEventForm());

      // Set initial error
      act(() => {
        result.current.errors.title = 'Title is required';
      });

      // Update the field
      act(() => {
        result.current.handleInputChange({
          target: { name: 'title', value: 'New Title' },
        } as any);
      });

      expect(result.current.errors.title).toBeUndefined();
    });
  });

  describe('handleSelectChange', () => {
    it('should update select field values', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handleSelectChange('type', 'webinar');
      });

      expect(result.current.formData.type).toBe('webinar');
    });

    it('should clear field error when updating select', () => {
      const { result } = renderHook(() => useEventForm());

      // Set initial error
      act(() => {
        result.current.errors.type = 'Type is required';
      });

      // Update the field
      act(() => {
        result.current.handleSelectChange('type', 'webinar');
      });

      expect(result.current.errors.type).toBeUndefined();
    });
  });

  describe('handleDateChange', () => {
    it('should update date field', () => {
      const { result } = renderHook(() => useEventForm());
      const testDate = new Date('2025-01-15');

      act(() => {
        result.current.handleDateChange(testDate);
      });

      expect(result.current.formData.date).toBe('2025-01-15');
    });

    it('should handle null date', () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.handleDateChange(null as any);
      });

      expect(result.current.formData.date).toBe('');
    });

    it('should clear date error when updating', () => {
      const { result } = renderHook(() => useEventForm());

      // Set initial error
      act(() => {
        result.current.errors.date = 'Date is required';
      });

      // Update the date
      act(() => {
        result.current.handleDateChange(new Date('2025-01-15'));
      });

      expect(result.current.errors.date).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate required fields', async () => {
      const { result } = renderHook(() => useEventForm());

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any);
      });

      expect(result.current.errors).toEqual({
        title: 'Title is required',
        description: 'Description is required',
        date: 'Date is required',
      });
      expect(preventDefault).toHaveBeenCalled();
    });

    it('should validate location for in-person events', async () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.formData.title = 'Test Event';
        result.current.formData.description = 'Test Description';
        result.current.formData.date = '2025-01-15';
        result.current.formData.format = 'in-person';
        result.current.formData.location = '';
      });

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any);
      });

      expect(result.current.errors.location).toBe('Location is required for in-person events');
    });

    it('should validate link for virtual events', async () => {
      const { result } = renderHook(() => useEventForm());

      act(() => {
        result.current.formData.title = 'Test Event';
        result.current.formData.description = 'Test Description';
        result.current.formData.date = '2025-01-15';
        result.current.formData.format = 'virtual';
        result.current.formData.link = '';
      });

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any);
      });

      expect(result.current.errors.link).toBe('Meeting link is required for virtual events');
    });
  });

  describe('form submission', () => {
    it('should create new event when form is valid', async () => {
      const { result } = renderHook(() => useEventForm());
      const mockOnSuccess = vi.fn();

      vi.mocked(eventService.createEvent).mockResolvedValue({
        id: '1',
        title: 'New Event',
      } as any);

      act(() => {
        result.current.formData.title = 'New Event';
        result.current.formData.description = 'New Description';
        result.current.formData.date = '2025-01-15';
        result.current.formData.format = 'in-person';
        result.current.formData.location = 'Conference Room';
      });

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any, mockOnSuccess);
      });

      expect(eventService.createEvent).toHaveBeenCalledWith({
        title: 'New Event',
        description: 'New Description',
        date: '2025-01-15',
        start_time: '',
        end_time: '',
        type: 'workshop',
        format: 'in-person',
        location: 'Conference Room',
        link: '',
        capacity: null,
        image_url: '',
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Event created successfully',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should update existing event when editEvent is provided', async () => {
      const editEvent = {
        id: '1',
        title: 'Existing Event',
        description: 'Existing Description',
        date: '2025-01-15',
        type: 'workshop',
        format: 'in-person',
      };

      const { result } = renderHook(() => useEventForm(editEvent as any));
      const mockOnSuccess = vi.fn();

      vi.mocked(eventService.updateEvent).mockResolvedValue({
        id: '1',
        title: 'Updated Event',
      } as any);

      act(() => {
        result.current.formData.title = 'Updated Event';
      });

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any, mockOnSuccess);
      });

      expect(eventService.updateEvent).toHaveBeenCalledWith('1', expect.objectContaining({
        title: 'Updated Event',
      }));

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Event updated successfully',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle submission errors', async () => {
      const { result } = renderHook(() => useEventForm());

      vi.mocked(eventService.createEvent).mockRejectedValue(new Error('Creation failed'));

      act(() => {
        result.current.formData.title = 'New Event';
        result.current.formData.description = 'New Description';
        result.current.formData.date = '2025-01-15';
        result.current.formData.format = 'virtual';
        result.current.formData.link = 'https://zoom.us/meeting/123';
      });

      const preventDefault = vi.fn();
      await act(async () => {
        await result.current.handleSubmit({ preventDefault } as any);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error saving event',
        description: 'Creation failed',
        variant: 'destructive',
      });
    });

    it('should set isSubmitting during submission', async () => {
      const { result } = renderHook(() => useEventForm());

      vi.mocked(eventService.createEvent).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 100))
      );

      act(() => {
        result.current.formData.title = 'New Event';
        result.current.formData.description = 'New Description';
        result.current.formData.date = '2025-01-15';
        result.current.formData.format = 'virtual';
        result.current.formData.link = 'https://zoom.us/meeting/123';
      });

      const preventDefault = vi.fn();
      const submitPromise = act(async () => {
        await result.current.handleSubmit({ preventDefault } as any);
      });

      // Check isSubmitting is true during submission
      expect(result.current.isSubmitting).toBe(true);

      await submitPromise;

      // Check isSubmitting is false after submission
      expect(result.current.isSubmitting).toBe(false);
    });
  });
});