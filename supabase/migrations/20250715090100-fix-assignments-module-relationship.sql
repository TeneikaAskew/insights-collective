-- Add module_id to assignments table if it doesn't exist
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_module ON assignments(module_id);

-- Update the assignments table structure to match what we need
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;