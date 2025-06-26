-- Add policy to allow authenticated users to create events
-- This is needed for event creation to work for all logged-in users

CREATE POLICY "Authenticated users can create events" 
ON public.events 
FOR INSERT 
TO authenticated
WITH CHECK (true);