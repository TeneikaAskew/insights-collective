-- Fix search path for remaining SECURITY DEFINER functions

-- Update find_one_on_one_conversation function
CREATE OR REPLACE FUNCTION public.find_one_on_one_conversation(user1_id uuid, user2_id uuid)
RETURNS TABLE(conversation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM conversations c
  WHERE c.is_group = false
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp1 
      WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2 
      WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*) FROM conversation_participants cp 
      WHERE cp.conversation_id = c.id
    ) = 2;
END;
$$;

-- Update get_blog_post_with_tags function
CREATE OR REPLACE FUNCTION public.get_blog_post_with_tags(post_slug text)
RETURNS TABLE(id uuid, title text, content text, excerpt text, slug text, author_id uuid, image_url text, status text, featured boolean, seo_title text, seo_description text, category_name text, view_count integer, read_time integer, published_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, tags text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.content,
    bp.excerpt,
    bp.slug,
    bp.author_id,
    bp.image_url,
    bp.status,
    bp.featured,
    bp.seo_title,
    bp.seo_description,
    bc.name as category_name,
    bp.view_count,
    bp.read_time,
    bp.published_at,
    bp.created_at,
    bp.updated_at,
    COALESCE(
      ARRAY(
        SELECT bpt.tag_name 
        FROM blog_post_tags bpt 
        WHERE bpt.blog_post_id = bp.id
      ), 
      ARRAY[]::text[]
    ) as tags
  FROM blog_posts bp
  LEFT JOIN blog_categories bc ON bp.category_id = bc.id
  WHERE bp.slug = post_slug;
END;
$$;

-- Update get_course_stats function
CREATE OR REPLACE FUNCTION public.get_course_stats(course_id_param uuid)
RETURNS TABLE(enrollment_count bigint, completion_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id) as enrollment_count,
    CASE 
      WHEN COUNT(e.id) > 0 THEN 
        ROUND(AVG(e.completion_status), 2)
      ELSE 0
    END as completion_rate
  FROM enrollments e
  WHERE e.course_id = course_id_param;
END;
$$;

-- Update get_user_conversations function
CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id_param uuid)
RETURNS TABLE(id uuid, subject text, is_group boolean, archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, participants jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.subject,
    c.is_group,
    c.archived,
    c.created_at,
    c.updated_at,
    c.created_by,
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
      WHERE cp.conversation_id = c.id
    ) AS participants
  FROM conversations c
  JOIN conversation_participants cp ON c.id = cp.conversation_id
  WHERE cp.user_id = user_id_param
    AND c.deleted_at IS NULL;
END;
$$;

-- Update get_user_conversations_secure function
CREATE OR REPLACE FUNCTION public.get_user_conversations_secure(user_id_param uuid)
RETURNS TABLE(id uuid, subject text, is_group boolean, archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to query their own conversations
  IF auth.uid() != user_id_param THEN
    RAISE EXCEPTION 'Access denied: You can only view your own conversations';
  END IF;
  
  RETURN QUERY
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
  WHERE cp.user_id = user_id_param
    AND c.deleted_at IS NULL;
END;
$$;

-- Update get_user_id function
CREATE OR REPLACE FUNCTION public.get_user_id(email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = email;
$$;

-- Update get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, roles)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'student',
    ARRAY['student'::text]
  );
  RETURN NEW;
END;
$$;