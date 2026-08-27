-- mock_sessions had INSERT/SELECT/UPDATE policies for participants but no
-- DELETE: nothing short of service role could remove a session row. The e2e
-- booking spec books a real session on every run, and CI runs without the
-- service key — so its only cleanup was flipping the row to 'canceled',
-- leaving one abandoned row per run to pile up in previousSessions counts and
-- the Past Sessions list (flagged by Codex review on PR #129).
--
-- Both participants can already rewrite every column of the row through the
-- UPDATE policy, canceling included, so letting the same pair delete grants
-- nothing they could not effectively do — and gives tests and future UI a
-- real cleanup path. peer_reviews keeps its plain FK, so a session with
-- recorded reviews still refuses deletion; no_show_reports cascades by design.

create policy "Users can delete mock sessions they're part of"
  on public.mock_sessions
  for delete
  using ((auth.uid() = user1_id) or (auth.uid() = user2_id));
