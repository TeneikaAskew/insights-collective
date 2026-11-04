-- ABOUTME: READ-ONLY null-state inspection of the EXACT quiz-lifecycle synthetic learner's auth rows. Emits one line of
-- ABOUTME: fixed key=true|false pairs; no column value (id, email, hash, token, timestamp) is ever selected out.
-- Run inside a READ ONLY transaction by learner-auth-state.sh. Every output field is a boolean computed in SQL, or
-- 'absent' when the exact learner row does not exist (so a missing row is never reported as null columns).
begin transaction read only;
with u as (
  select * from auth.users where id = '9c000000-0000-4000-8000-0000000000a1'::uuid
), i as (
  select count(*) as n from auth.identities where user_id = '9c000000-0000-4000-8000-0000000000a1'::uuid
)
select concat_ws(' ',
  'auth-state',
  'user_row=' || (select count(*) = 1 from u)::text,
  'email_matches=' || coalesce((select (email = 'qlc-learner@insightscollective.local')::text from u), 'absent'),
  'instance_id_null=' || coalesce((select (instance_id is null)::text from u), 'absent'),
  'aud_authenticated=' || coalesce((select (aud = 'authenticated')::text from u), 'absent'),
  'role_authenticated=' || coalesce((select (role = 'authenticated')::text from u), 'absent'),
  'password_hash_present=' || coalesce((select (encrypted_password is not null and encrypted_password <> '')::text from u), 'absent'),
  'email_confirmed=' || coalesce((select (email_confirmed_at is not null)::text from u), 'absent'),
  'created_at_null=' || coalesce((select (created_at is null)::text from u), 'absent'),
  'updated_at_null=' || coalesce((select (updated_at is null)::text from u), 'absent'),
  'confirmation_token_null=' || coalesce((select (confirmation_token is null)::text from u), 'absent'),
  'recovery_token_null=' || coalesce((select (recovery_token is null)::text from u), 'absent'),
  'email_change_token_new_null=' || coalesce((select (email_change_token_new is null)::text from u), 'absent'),
  'email_change_null=' || coalesce((select (email_change is null)::text from u), 'absent'),
  'email_change_token_current_null=' || coalesce((select (email_change_token_current is null)::text from u), 'absent'),
  'phone_change_null=' || coalesce((select (phone_change is null)::text from u), 'absent'),
  'phone_change_token_null=' || coalesce((select (phone_change_token is null)::text from u), 'absent'),
  'reauthentication_token_null=' || coalesce((select (reauthentication_token is null)::text from u), 'absent'),
  'banned=' || coalesce((select (banned_until is not null and banned_until > now())::text from u), 'absent'),
  'deleted=' || coalesce((select (deleted_at is not null)::text from u), 'absent'),
  'identity_rows=' || (select case when n = 0 then 'zero' when n = 1 then 'one' else 'many' end from i)
) as line;
rollback;
