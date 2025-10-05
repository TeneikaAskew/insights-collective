import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseCalendarService, CalendarEventInput, CalendarFilters } from '@/services/courseCalendarService';
import { CourseCalendarEvent } from '@/types/course';
import { toast } from 'sonner';

// Course Calendar hooks
export const useCourseCalendar = (courseId?: string, filters?: CalendarFilters) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['course-calendar', courseId, filters],
    queryFn: () => courseCalendarService.getCourseCalendarEvents(courseId!, filters),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    events,
    isLoading,
    error,
  };
};

// Multi-course calendar hook
export const useMultiCourseCalendar = (courseIds?: string[], filters?: CalendarFilters) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['multi-course-calendar', courseIds, filters],
    queryFn: () => courseCalendarService.getMultiCourseCalendarEvents(courseIds!, filters),
    enabled: !!courseIds && courseIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    events,
    isLoading,
    error,
  };
};

// User's enrolled courses calendar
export const useUserCalendar = (userId?: string, filters?: CalendarFilters) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['user-calendar', userId, filters],
    queryFn: () => courseCalendarService.getUserCalendarEvents(userId!, filters),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    events,
    isLoading,
    error,
  };
};

// Upcoming events hook
export const useUpcomingEvents = (courseId?: string, days: number = 7) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['upcoming-events', courseId, days],
    queryFn: () => courseCalendarService.getUpcomingEvents(courseId!, days),
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    events,
    isLoading,
    error,
  };
};

// Events for specific date
export const useEventsForDate = (courseId?: string, date?: Date) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events-for-date', courseId, date?.toISOString()],
    queryFn: () => courseCalendarService.getEventsForDate(courseId!, date!),
    enabled: !!courseId && !!date,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return {
    events,
    isLoading,
    error,
  };
};

// Calendar statistics
export const useCalendarStats = (courseId?: string) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['calendar-stats', courseId],
    queryFn: () => courseCalendarService.getCalendarStats(courseId!),
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    stats,
    isLoading,
    error,
  };
};

// Calendar event mutations
export const useCalendarEventMutations = (courseId?: string) => {
  const queryClient = useQueryClient();

  const createEventMutation = useMutation({
    mutationFn: (event: CalendarEventInput) => courseCalendarService.createCalendarEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-calendar', courseId] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-stats', courseId] });
      toast.success('Event created successfully');
    },
    onError: () => {
      toast.error('Failed to create event');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CalendarEventInput> }) =>
      courseCalendarService.updateCalendarEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-calendar', courseId] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar'] });
      toast.success('Event updated successfully');
    },
    onError: () => {
      toast.error('Failed to update event');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => courseCalendarService.deleteCalendarEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-calendar', courseId] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-stats', courseId] });
      toast.success('Event deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  return {
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
};