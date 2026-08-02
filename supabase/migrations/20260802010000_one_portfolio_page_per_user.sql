-- One portfolio page per person.
--
-- A portfolio is the thing you link to. Letting one account hold several means
-- several links, several share buttons and several exports, and no answer to
-- "which one is mine?" — the product decision is one page, always at the same
-- URL, with finished projects added to it.
--
-- Safe to apply: checked against the live table on 2026-08-02 via PostgREST as
-- both the admin and member roles. The whole table is 2 rows, owned by 2
-- different accounts, one page each — no account has a second page, so this
-- constraint cannot fail on existing data and nothing has to be merged or
-- archived. Re-check before applying if that is no longer today:
--
--   select count(*) from (
--     select user_id from portfolio_pages group by user_id having count(*) > 1
--   ) x;
--
-- If that ever returns non-zero, do NOT force this through. Deleting somebody's
-- second portfolio to satisfy a constraint is a product decision, not a
-- migration.

alter table public.portfolio_pages
  add constraint portfolio_pages_user_id_key unique (user_id);

comment on constraint portfolio_pages_user_id_key on public.portfolio_pages is
  'One portfolio page per account. The app creates the page lazily and edits it in place; it never offers a second.';
