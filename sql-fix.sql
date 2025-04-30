
-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid);

-- Create a view that will help us access conversation data without recursion issues
CREATE OR REPLACE VIEW public.user_conversation_view AS
SELECT 
  c.id,
  c.subject,
  c.is_group,
  c.archived,
  c.created_at,
  c.updated_at,
  c.created_by,
  cp.user_id
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
WHERE c.deleted_at IS NULL;

-- Then, create an improved function to get user conversations using the view
CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id_param UUID)
RETURNS TABLE(
  id UUID, 
  subject TEXT, 
  is_group BOOLEAN,
  archived BOOLEAN, 
  created_at TIMESTAMP WITH TIME ZONE, 
  updated_at TIMESTAMP WITH TIME ZONE, 
  created_by UUID,
  participants JSONB,
  last_message JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ucv.id,
    ucv.subject,
    ucv.is_group,
    ucv.archived,
    ucv.created_at,
    ucv.updated_at,
    ucv.created_by,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', cp.user_id,
          'added_at', cp.added_at,
          'profile', (
            SELECT jsonb_build_object(
              'id', p.id,
              'first_name', p.first_name,
              'last_name', p.last_name,
              'avatar_url', p.avatar_url
            )
            FROM profiles p
            WHERE p.id = cp.user_id
          )
        )
      )
      FROM conversation_participants cp
      WHERE cp.conversation_id = ucv.id
    ) AS participants,
    (
      SELECT jsonb_build_object(
        'id', m.id,
        'content', m.content,
        'created_at', m.created_at,
        'sender_id', m.sender_id,
        'read', m.read
      )
      FROM messages m
      WHERE m.conversation_id = ucv.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message
  FROM user_conversation_view ucv
  WHERE ucv.user_id = user_id_param;
END;
$$;

-- Drop the user_conversations table if it exists (we're now using a view approach)
DROP TABLE IF EXISTS public.user_conversations;

-- Add RLS to the conversation_participants table if not already present
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'conversation_participants' 
    AND policyname = 'Users can view their own conversation participants'
  ) THEN
    CREATE POLICY "Users can view their own conversation participants" 
      ON public.conversation_participants 
      FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'conversation_participants' 
    AND policyname = 'Users can insert conversation participants'
  ) THEN
    CREATE POLICY "Users can insert conversation participants" 
      ON public.conversation_participants 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid()
      ));
  END IF;
END;
$$;

-- Also make sure conversations table has proper RLS policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'conversations' 
    AND policyname = 'Users can view conversations they participate in'
  ) THEN
    CREATE POLICY "Users can view conversations they participate in" 
      ON public.conversations 
      FOR SELECT 
      USING (EXISTS (
        SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'conversations' 
    AND policyname = 'Users can insert their own conversations'
  ) THEN
    CREATE POLICY "Users can insert their own conversations" 
      ON public.conversations 
      FOR INSERT 
      WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'conversations' 
    AND policyname = 'Users can update conversations they created'
  ) THEN
    CREATE POLICY "Users can update conversations they created" 
      ON public.conversations 
      FOR UPDATE 
      USING (auth.uid() = created_by);
  END IF;
END;
$$;
