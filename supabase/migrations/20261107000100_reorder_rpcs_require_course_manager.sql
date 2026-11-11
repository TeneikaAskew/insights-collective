-- PREPARED ON A BRANCH. Apply only through db-migrate.yml after review.
--
-- reorder_content_items and reorder_modules (20260412000000_add_reorder_rpcs) are SECURITY DEFINER, so they run
-- past the row policies on content_items and modules, and they checked neither the caller nor the list. Postgres
-- grants EXECUTE on a new function to PUBLIC, so anon could call them too. Any caller could rewrite the positions
-- in any course, and a list with duplicates, foreign ids or missing ids was applied as far as it matched.
--
-- Now each function:
--   * runs only for service_role or a caller who can manage the course (can_manage_course_content: admin, the
--     course's instructor, or a co-instructor), the same people the UPDATE policies on these tables allow;
--   * applies the order only when the list is exactly the current members of the module or course, each once,
--     so a stale or partial list is refused instead of half-applied (the builder sends the whole list and
--     restores its own order on an error);
--   * keeps its signature, so the client call is unchanged.
-- EXECUTE goes to authenticated and service_role only.
--
-- Behavioural test: scripts/local-db/tests/11_reorder_rpc_ownership.sql. Static check:
-- src/test/ci/reorderRpcOwnershipMigration.test.ts.

CREATE OR REPLACE FUNCTION public.reorder_content_items(p_module_id uuid, p_item_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role   text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_course uuid;
  v_n      integer := COALESCE(cardinality(p_item_ids), 0);
BEGIN
  SELECT m.course_id INTO v_course FROM public.modules m WHERE m.id = p_module_id;

  -- One message for "no such section" and "not yours", so the error does not reveal which ids exist.
  IF v_course IS NULL
     OR NOT (v_role = 'service_role' OR public.can_manage_course_content(auth.uid(), v_course)) THEN
    RAISE EXCEPTION 'not allowed to reorder this section' USING ERRCODE = '42501';
  END IF;

  IF v_n = 0
     OR (SELECT count(DISTINCT x) FROM unnest(p_item_ids) AS x) <> v_n
     OR array_position(p_item_ids, NULL) IS NOT NULL
     OR (SELECT count(*) FROM public.content_items ci WHERE ci.module_id = p_module_id) <> v_n
     OR (SELECT count(*) FROM public.content_items ci
         WHERE ci.module_id = p_module_id AND ci.id = ANY (p_item_ids)) <> v_n THEN
    RAISE EXCEPTION 'lesson order must list every lesson in the section exactly once' USING ERRCODE = '22023';
  END IF;

  -- Defer the unique (module_id, position) constraint so intermediate positions do not collide.
  SET CONSTRAINTS unique_position_per_module DEFERRED;

  UPDATE public.content_items ci
  SET position = o.ord - 1   -- 0-indexed to match the client
  FROM unnest(p_item_ids) WITH ORDINALITY AS o(id, ord)
  WHERE ci.id = o.id
    AND ci.module_id = p_module_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reorder_modules(p_course_id uuid, p_module_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_n    integer := COALESCE(cardinality(p_module_ids), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p_course_id)
     OR NOT (v_role = 'service_role' OR public.can_manage_course_content(auth.uid(), p_course_id)) THEN
    RAISE EXCEPTION 'not allowed to reorder this course' USING ERRCODE = '42501';
  END IF;

  IF v_n = 0
     OR (SELECT count(DISTINCT x) FROM unnest(p_module_ids) AS x) <> v_n
     OR array_position(p_module_ids, NULL) IS NOT NULL
     OR (SELECT count(*) FROM public.modules m WHERE m.course_id = p_course_id) <> v_n
     OR (SELECT count(*) FROM public.modules m
         WHERE m.course_id = p_course_id AND m.id = ANY (p_module_ids)) <> v_n THEN
    RAISE EXCEPTION 'section order must list every section in the course exactly once' USING ERRCODE = '22023';
  END IF;

  UPDATE public.modules m
  SET position = o.ord - 1
  FROM unnest(p_module_ids) WITH ORDINALITY AS o(id, ord)
  WHERE m.id = o.id
    AND m.course_id = p_course_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reorder_content_items(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_modules(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_content_items(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_modules(uuid, uuid[]) TO authenticated, service_role;

-- Fail loudly if anon can still call either function.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.reorder_content_items(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reorder_modules(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'reorder functions are still executable by anon';
  END IF;
END $$;
