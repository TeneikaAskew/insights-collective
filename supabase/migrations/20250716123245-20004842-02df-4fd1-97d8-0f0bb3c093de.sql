-- Add foreign key constraints for content_items relationships

-- Add foreign key constraint from assignments.content_item_id to content_items.id
ALTER TABLE public.assignments 
ADD CONSTRAINT assignments_content_item_id_fkey 
FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE;

-- Add foreign key constraint from quizzes.content_item_id to content_items.id  
ALTER TABLE public.quizzes 
ADD CONSTRAINT quizzes_content_item_id_fkey 
FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON public.assignments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);