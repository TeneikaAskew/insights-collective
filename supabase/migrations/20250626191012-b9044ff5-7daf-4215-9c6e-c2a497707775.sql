-- Add foreign key constraints for event_registrations table
-- This will fix the relationship queries for fetching registration data with user profiles

-- Add foreign key constraint from event_registrations.user_id to profiles.id
ALTER TABLE public.event_registrations 
ADD CONSTRAINT fk_event_registrations_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key constraint from event_registrations.event_id to events.id  
ALTER TABLE public.event_registrations 
ADD CONSTRAINT fk_event_registrations_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;