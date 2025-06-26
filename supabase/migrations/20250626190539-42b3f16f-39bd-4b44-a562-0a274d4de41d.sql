-- Create RLS policies for events table to fix insert errors

-- Policy for admins to manage all events
CREATE POLICY "Admins can manage all events" 
ON public.events 
FOR ALL 
USING (public.has_admin_access(auth.uid()));

-- Policy for all authenticated users to view events
CREATE POLICY "Users can view all events" 
ON public.events 
FOR SELECT 
USING (true);

-- Policy for instructors to manage events
CREATE POLICY "Instructors can manage events" 
ON public.events 
FOR ALL 
USING ('instructor' = ANY(public.get_user_roles(auth.uid())));