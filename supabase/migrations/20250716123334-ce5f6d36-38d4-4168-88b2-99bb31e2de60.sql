-- Add foreign key constraint for assignments only (quizzes already has it)

-- Add foreign key constraint from assignments.content_item_id to content_items.id
ALTER TABLE public.assignments 
ADD CONSTRAINT assignments_content_item_id_fkey 
FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON public.assignments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);