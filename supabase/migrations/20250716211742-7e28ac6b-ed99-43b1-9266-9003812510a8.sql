-- Add module_id to quizzes table to match assignments structure
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_module_id ON public.quizzes(module_id);

-- Update existing quizzes to set module_id based on content_items relationship
UPDATE public.quizzes 
SET module_id = (
  SELECT ci.module_id 
  FROM public.content_items ci 
  WHERE ci.id = quizzes.content_item_id
)
WHERE module_id IS NULL AND content_item_id IS NOT NULL;