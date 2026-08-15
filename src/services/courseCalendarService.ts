import { supabase } from '@/integrations/supabase/client';
import { CourseCalendarEvent } from '@/types/course';

export interface ZoomRecurrence {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  repeat_interval?: number;
  end_date?: string;
  end_times?: number;
  weekly_days?: number[];
}

export interface CalendarEventInput {
  course_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  event_type?: string;
  location?: string;
  created_by?: string;
  link?: string;
  zoom_meeting_id?: number;
  zoom_start_url?: string;
  zoom_recurrence?: ZoomRecurrence;
}

export interface CalendarFilters {
  types?: string[];
  startDate?: Date;
  endDate?: Date;
  courseIds?: string[];
}

export const courseCalendarService = {
  // Get all calendar events for a course
  async getCourseCalendarEvents(
    courseId: string, 
    filters?: CalendarFilters
  ): Promise<CourseCalendarEvent[]> {
    const events: CourseCalendarEvent[] = [];

    // Get course info
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError) throw courseError;
    // A course the caller cannot read — an enrollment into a course whose row RLS
    // hides — has no calendar the caller can read either. This was .single(), whose
    // PGRST116 on zero rows rejected the whole user calendar because one enrollment
    // pointed at a hidden course; every other course's events vanished with it.
    if (!course) return events;

    const courseTitle = course.title;

    // Fetch assignments if not filtered out
    if (!filters?.types || filters.types.includes('assignment')) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          points,
          course_id,
          module_id
        `)
        .eq('course_id', courseId)
        .not('due_date', 'is', null);

      if (assignmentsError) throw assignmentsError;

      (assignments || []).forEach(assignment => {
        if (assignment.due_date) {
          events.push({
            id: `assignment-due-${assignment.id}`,
            title: `${assignment.title} - Due`,
            description: assignment.description || undefined,
            start_date: assignment.due_date,
            type: 'assignment',
            course_id: courseId,
            course_title: courseTitle,
            related_id: assignment.id,
            // Rarely set: 2 of 19 assignments have one, and none of the 17
            // that carry a due_date (so none that reach this list) do. The
            // card falls back to the assignments list rather than building a
            // URL that matches no route.
            module_id: assignment.module_id || undefined,
            course_color: '#3b82f6',
          });
        }
      });
    }

    // Fetch quizzes if not filtered out
    if (!filters?.types || filters.types.includes('quiz')) {
      const { data: quizzes, error: quizzesError } = await supabase
        .from('quizzes')
        .select(`
          id,
          title,
          description,
          due_at,
          unlock_at,
          lock_at,
          time_limit,
          allowed_attempts,
          content_item_id,
          content_items!inner(course_id, module_id)
        `)
        .eq('content_items.course_id', courseId);

      if (quizzesError) throw quizzesError;

      // PostgREST returns an embedded to-one either as an object or wrapped in
      // a single-element array depending on how it infers the relationship, so
      // normalise rather than assuming one shape.
      const moduleIdOf = (quiz: any): string | undefined => {
        const item = Array.isArray(quiz.content_items) ? quiz.content_items[0] : quiz.content_items;
        return item?.module_id || undefined;
      };

      (quizzes || []).forEach(quiz => {
        const moduleId = moduleIdOf(quiz);
        // The quiz PAGE is addressed by content item, not by quiz — the route
        // param is :contentItemId and CanvasQuizTaking calls
        // getContentItem/getQuiz with it. Passing quiz.id here produced a URL
        // that matched no route at all.
        const targetId = quiz.content_item_id || undefined;
        // Due date event
        if (quiz.due_at) {
          events.push({
            id: `quiz-due-${quiz.id}`,
            title: `${quiz.title} - Due`,
            description: quiz.description || `Quiz with ${quiz.time_limit || 'unlimited'} time limit`,
            start_date: quiz.due_at,
            type: 'quiz',
            course_id: courseId,
            course_title: courseTitle,
            related_id: targetId,
            module_id: moduleId,
            course_color: '#8b5cf6', // Purple for quizzes
          });
        }

        // Unlock date event
        if (quiz.unlock_at) {
          events.push({
            id: `quiz-unlock-${quiz.id}`,
            title: `${quiz.title} - Available`,
            description: `Quiz becomes available`,
            start_date: quiz.unlock_at,
            type: 'quiz',
            course_id: courseId,
            course_title: courseTitle,
            related_id: targetId,
            module_id: moduleId,
            course_color: '#10b981', // Green for unlock
          });
        }

        // Lock date event
        if (quiz.lock_at) {
          events.push({
            id: `quiz-lock-${quiz.id}`,
            title: `${quiz.title} - Closes`,
            description: `Quiz submissions close`,
            start_date: quiz.lock_at,
            type: 'quiz',
            course_id: courseId,
            course_title: courseTitle,
            related_id: targetId,
            module_id: moduleId,
            course_color: '#ef4444', // Red for lock
          });
        }
      });
    }

    // Fetch course announcements if not filtered out
    if (!filters?.types || filters.types.includes('announcement')) {
      const { data: announcements, error: announcementsError } = await supabase
        .from('course_announcements')
        .select(`
          id,
          title,
          content,
          created_at,
          is_pinned
        `)
        .eq('course_id', courseId);

      if (announcementsError) throw announcementsError;

      (announcements || []).forEach(announcement => {
        events.push({
          id: `announcement-${announcement.id}`,
          title: `${announcement.title}${announcement.is_pinned ? ' (Pinned)' : ''}`,
          description: announcement.content,
          start_date: announcement.created_at,
          type: 'announcement',
          course_id: courseId,
          course_title: courseTitle,
          related_id: announcement.id,
          course_color: '#f59e0b', // Orange for announcements
          all_day: true,
        });
      });
    }

    // Fetch custom course events if not filtered out
    if (!filters?.types || filters.types.includes('event')) {
      const { data: customEvents, error: customEventsError } = await (supabase
        .from('events')
        .select('id, title, description, date, end_time, location, link, zoom_meeting_id, zoom_start_url, zoom_recurrence') as any)
        .eq('course_id', courseId);

      if (customEventsError) throw customEventsError;

      (customEvents || []).forEach((e: any) => {
        if (e.date) {
          events.push({
            id: `event-${e.id}`,
            title: e.title,
            description: e.description,
            start_date: e.date,
            // events.end_time is a clock-only value ("17:00:00"); combining it
            // with the event date yields a parseable timestamp. A bare clock
            // string would make new Date(...) invalid and crash the ICS export.
            end_date: e.end_time ? `${e.date}T${e.end_time}` : undefined,
            type: 'event',
            course_id: courseId,
            course_title: courseTitle,
            related_id: e.id,
            course_color: '#06b6d4',
            link: e.link || undefined,
            zoom_meeting_id: e.zoom_meeting_id || undefined,
            zoom_start_url: e.zoom_start_url || undefined,
            zoom_recurrence: e.zoom_recurrence || undefined,
          });
        }
      });
    }

    // Filter by date range if provided
    let filteredEvents = events;
    if (filters?.startDate || filters?.endDate) {
      filteredEvents = events.filter(event => {
        const eventDate = new Date(event.start_date);
        if (filters.startDate && eventDate < filters.startDate) return false;
        if (filters.endDate && eventDate > filters.endDate) return false;
        return true;
      });
    }

    // Sort by start date
    return filteredEvents.sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  },

  // Get calendar events for multiple courses (for global calendar)
  async getMultiCourseCalendarEvents(
    courseIds: string[],
    filters?: CalendarFilters
  ): Promise<CourseCalendarEvent[]> {
    const allEvents: CourseCalendarEvent[] = [];

    for (const courseId of courseIds) {
      const courseEvents = await this.getCourseCalendarEvents(courseId, filters);
      allEvents.push(...courseEvents);
    }

    // Sort all events by date
    return allEvents.sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  },

  // Get events for a user's enrolled courses
  async getUserCalendarEvents(
    userId: string,
    filters?: CalendarFilters
  ): Promise<CourseCalendarEvent[]> {
    // Get user's enrolled courses
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId);

    if (error) throw error;

    // Genuinely no enrollments — an empty calendar is the correct result.
    const courseIds = (enrollments || []).map(e => e.course_id);
    
    if (filters?.courseIds) {
      // Filter to only requested courses
      const requestedCourseIds = courseIds.filter(id => filters.courseIds!.includes(id));
      return this.getMultiCourseCalendarEvents(requestedCourseIds, filters);
    }

    return this.getMultiCourseCalendarEvents(courseIds, filters);
  },

  // events.end_time stores a clock-only value ("17:00:00"). Callers pass
  // end_date as either a full timestamp or a bare clock string — normalize to
  // the clock portion so we never write a timestamp into a time column.
  toClockTime(value: string | undefined | null): string | null {
    if (!value) return null;
    if (value.includes('T')) return value.split('T')[1].slice(0, 8) || null;
    return value;
  },

  // Create a custom calendar event
  async createCalendarEvent(event: CalendarEventInput): Promise<any> {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: event.title,
        description: event.description || '',
        date: event.start_date,
        // The events table stores the end of an event in end_time (there is
        // no end_date column) — previously this input was silently dropped.
        end_time: this.toClockTime(event.end_date),
        location: event.location,
        link: event.link,
        type: event.link ? 'virtual' : (event.event_type || 'event'),
        format: event.link ? 'online' : 'in-person',
        course_id: event.course_id,
        zoom_meeting_id: event.zoom_meeting_id,
        zoom_start_url: event.zoom_start_url,
        zoom_recurrence: event.zoom_recurrence,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a calendar event
  async updateCalendarEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<any> {
    const { data, error } = await supabase
      .from('events')
      .update({
        title: updates.title,
        description: updates.description,
        date: updates.start_date,
        // The events table has end_time, NOT end_date — writing end_date
        // made every update 400.
        end_time: this.toClockTime(updates.end_date),
        location: updates.location,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a calendar event
  async deleteCalendarEvent(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  },

  // Get upcoming events for a course (next 7 days)
  async getUpcomingEvents(courseId: string, days: number = 7): Promise<CourseCalendarEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);

    return this.getCourseCalendarEvents(courseId, {
      startDate: now,
      endDate: future
    });
  },

  // Get events for a specific date
  async getEventsForDate(courseId: string, date: Date): Promise<CourseCalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getCourseCalendarEvents(courseId, {
      startDate: startOfDay,
      endDate: endOfDay
    });
  },

  // Get calendar statistics for a course
  async getCalendarStats(courseId: string): Promise<{
    total_events: number;
    upcoming_assignments: number;
    upcoming_quizzes: number;
    overdue_items: number;
  }> {
    const now = new Date();
    const allEvents = await this.getCourseCalendarEvents(courseId);
    
    const upcomingAssignments = allEvents.filter(e => 
      e.type === 'assignment' && 
      e.title.includes('Due') && 
      new Date(e.start_date) > now
    );
    
    const upcomingQuizzes = allEvents.filter(e => 
      e.type === 'quiz' && 
      e.title.includes('Due') && 
      new Date(e.start_date) > now
    );
    
    const overdueItems = allEvents.filter(e => 
      (e.type === 'assignment' || e.type === 'quiz') && 
      e.title.includes('Due') && 
      new Date(e.start_date) < now
    );

    return {
      total_events: allEvents.length,
      upcoming_assignments: upcomingAssignments.length,
      upcoming_quizzes: upcomingQuizzes.length,
      overdue_items: overdueItems.length,
    };
  }
};