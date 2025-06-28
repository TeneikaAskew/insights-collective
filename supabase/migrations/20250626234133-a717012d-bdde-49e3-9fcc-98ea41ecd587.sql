-- Check if there's a unique constraint preventing duplicate registrations
-- and add one if it doesn't exist
ALTER TABLE public.event_registrations 
ADD CONSTRAINT unique_user_event_registration 
UNIQUE (user_id, event_id);