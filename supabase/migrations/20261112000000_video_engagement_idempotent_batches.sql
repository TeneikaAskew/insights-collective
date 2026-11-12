-- Durable idempotency for learner video engagement writes.
--
-- The watch-progress producer (TrackedVideoPlayer -> WatchReporter) retries a
-- failed batch as the identical batch. Before this migration the client
-- applied it with a read-then-compare-and-set update, so a write whose outcome
-- was unknown and that DID commit, then was changed by another writer before
-- the retry, was added twice; a coincidental match could also skip a batch.
--
-- apply_video_engagement_batch records each batch id once, in the same
-- transaction as the atomic increment. A retry of a committed batch finds its
-- id and changes nothing. Additive only: no existing table, policy or row is
-- changed. The caller is always auth.uid(); no user id is accepted.

CREATE TABLE IF NOT EXISTS public.video_engagement_batches (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_video_engagement_batches_item
  ON public.video_engagement_batches (content_item_id);

COMMENT ON TABLE public.video_engagement_batches IS
  'One row per applied video engagement batch; makes apply_video_engagement_batch retries idempotent.';

ALTER TABLE public.video_engagement_batches ENABLE ROW LEVEL SECURITY;

-- Learners only ever add or read their own ledger rows (through the function).
REVOKE ALL ON public.video_engagement_batches FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.video_engagement_batches TO authenticated;

CREATE POLICY "Users can view own video engagement batches"
  ON public.video_engagement_batches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record own video engagement batches"
  ON public.video_engagement_batches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_video_engagement_batch(
  p_content_item_id UUID,
  p_batch_id UUID,
  p_watch_time_delta INTEGER DEFAULT 0,
  p_play_count_delta INTEGER DEFAULT 0,
  p_pause_count_delta INTEGER DEFAULT 0,
  p_seek_count_delta INTEGER DEFAULT 0,
  p_last_position INTEGER DEFAULT NULL,
  p_video_duration INTEGER DEFAULT NULL,
  p_playback_speed NUMERIC DEFAULT NULL,
  p_completion_percentage INTEGER DEFAULT NULL
)
RETURNS TABLE (
  outcome TEXT,
  watch_time INTEGER,
  play_count INTEGER,
  pause_count INTEGER,
  seek_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_content_item_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'content item and batch id are required' USING ERRCODE = '22004';
  END IF;
  IF LEAST(p_watch_time_delta, p_play_count_delta, p_pause_count_delta, p_seek_count_delta) < 0 THEN
    RAISE EXCEPTION 'engagement deltas must not be negative' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.video_engagement_batches (user_id, batch_id, content_item_id)
  VALUES (v_uid, p_batch_id, p_content_item_id)
  ON CONFLICT (user_id, batch_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT 'already-applied'::TEXT, va.watch_time, va.play_count, va.pause_count, va.seek_count
      FROM public.video_analytics va
      WHERE va.user_id = v_uid AND va.content_item_id = p_content_item_id;
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.video_analytics AS va (
    user_id, content_item_id, watch_time, play_count, pause_count, seek_count,
    last_position, video_duration, playback_speed, completion_percentage
  )
  VALUES (
    v_uid, p_content_item_id,
    COALESCE(p_watch_time_delta, 0), COALESCE(p_play_count_delta, 0),
    COALESCE(p_pause_count_delta, 0), COALESCE(p_seek_count_delta, 0),
    GREATEST(COALESCE(p_last_position, 0), 0), p_video_duration,
    COALESCE(p_playback_speed, 1.0), LEAST(GREATEST(COALESCE(p_completion_percentage, 0), 0), 100)
  )
  ON CONFLICT (user_id, content_item_id) DO UPDATE SET
    watch_time = COALESCE(va.watch_time, 0) + COALESCE(p_watch_time_delta, 0),
    play_count = COALESCE(va.play_count, 0) + COALESCE(p_play_count_delta, 0),
    pause_count = COALESCE(va.pause_count, 0) + COALESCE(p_pause_count_delta, 0),
    seek_count = COALESCE(va.seek_count, 0) + COALESCE(p_seek_count_delta, 0),
    last_position = COALESCE(GREATEST(p_last_position, 0), va.last_position),
    video_duration = COALESCE(p_video_duration, va.video_duration),
    playback_speed = COALESCE(p_playback_speed, va.playback_speed),
    completion_percentage = COALESCE(LEAST(GREATEST(p_completion_percentage, 0), 100), va.completion_percentage),
    last_watched_at = now(),
    updated_at = now()
  RETURNING 'applied'::TEXT, va.watch_time, va.play_count, va.pause_count, va.seek_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_video_engagement_batch(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_video_engagement_batch(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER) TO authenticated;
