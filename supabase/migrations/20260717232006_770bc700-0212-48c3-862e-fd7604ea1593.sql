
-- The old FOR ALL policy's USING clause returns false on INSERT because the
-- new row's id doesn't exist yet, and a NULL WITH CHECK on a FOR ALL policy
-- falls back to the USING clause. Replace it with a SELECT-only policy.
DROP POLICY IF EXISTS "Users can access content items" ON public.content_items;
CREATE POLICY "Users can read content items"
ON public.content_items FOR SELECT TO authenticated
USING (public.can_access_content_item(auth.uid(), id));
