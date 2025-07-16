import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('eventService');

export interface EventInput {
  title: string;
  description: string;
  type: string;
  format: string;
  location?: string | null;
  link?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  image?: string | null;
  capacity?: number | null;
  calendly_link?: string | null;
}

export const eventService = {
  async createEvent(event: EventInput) {
    const { data, error } = await supabase
      .from('events')
      .insert([event])
      .select()
      .single();

    if (error) {
      logger.error('Error creating event:', error);
      throw error;
    }

    return data;
  },

  async updateEvent(id: string, updates: Partial<EventInput>) {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating event:', error);
      throw error;
    }

    return data;
  },

  async deleteEvent(id: string) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting event:', error);
      throw error;
    }
  },

  async getEvent(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Error fetching event:', error);
      throw error;
    }

    return data;
  },

  async getAllEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      logger.error('Error fetching events:', error);
      throw error;
    }

    return data;
  },

  async getUpcomingEvents(limit?: number) {
    const today = new Date().toISOString().split('T')[0];
    
    let query = supabase
      .from('events')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching upcoming events:', error);
      throw error;
    }

    return data;
  },

  async getPastEvents(limit?: number) {
    const today = new Date().toISOString().split('T')[0];
    
    let query = supabase
      .from('events')
      .select('*')
      .lt('date', today)
      .order('date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching past events:', error);
      throw error;
    }

    return data;
  }
};