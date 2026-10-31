-- ABOUTME: Minimal stand-ins for the Supabase platform objects the migrations reference, so the
-- ABOUTME: repo's migrations can be replayed on a plain, disposable local PostgreSQL for RLS/trigger tests.
--
-- This is NOT a Supabase stack. It provides just enough of auth/storage/vault/cron/net for
-- `supabase/migrations/*.sql` to apply, and for tests to impersonate a user with
--   set role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
-- Nothing here ever talks to the live project.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;
create extension if not exists citext;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists vault;
create schema if not exists cron;
create schema if not exists net;
create schema if not exists extensions;
create schema if not exists supabase_migrations;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- auth -----------------------------------------------------------------------
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token text default '',
  confirmation_sent_at timestamptz,
  recovery_token text default '',
  recovery_sent_at timestamptz,
  email_change_token_new text default '',
  email_change text default '',
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text default '',
  phone_change_token text default '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current text default '',
  email_change_confirm_status smallint default 0,
  banned_until timestamptz,
  reauthentication_token text default '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  email text generated always as (lower(identity_data ->> 'email')) stored,
  unique (provider_id, provider)
);
grant select on auth.users to service_role;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon')
$$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;

-- storage --------------------------------------------------------------------
create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin _parts := string_to_array(name, '/'); return _parts[1:array_length(_parts,1)-1]; end $$;
create or replace function storage.filename(name text) returns text language plpgsql immutable as $$
declare _parts text[];
begin _parts := string_to_array(name, '/'); return _parts[array_length(_parts,1)]; end $$;
create or replace function storage.extension(name text) returns text language plpgsql immutable as $$
declare _parts text[]; _filename text;
begin _parts := string_to_array(name, '/'); _filename := _parts[array_length(_parts,1)];
  return reverse(split_part(reverse(_filename), '.', 1)); end $$;

-- vault ----------------------------------------------------------------------
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text default '',
  secret text not null,
  key_id uuid,
  nonce bytea,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into vault.secrets (secret, name, description, key_id) values (new_secret, new_name, coalesce(new_description,''), new_key_id)
  on conflict (name) do update set secret = excluded.secret, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- cron -----------------------------------------------------------------------
create table if not exists cron.job (
  jobid bigserial primary key,
  schedule text,
  command text,
  nodename text default 'localhost',
  nodeport int default 5432,
  database text default current_database(),
  username text default current_user,
  active boolean default true,
  jobname text unique
);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare v bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into v;
  return v;
end $$;
create or replace function cron.schedule(schedule text, command text) returns bigint language plpgsql as $$
declare v bigint;
begin insert into cron.job (schedule, command) values (schedule, command) returning jobid into v; return v; end $$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin delete from cron.job where jobname = job_name; return found; end $$;
create or replace function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$
begin delete from cron.job where jobid = job_id; return found; end $$;

-- net ------------------------------------------------------------------------
create table if not exists net._http_response (
  id bigserial primary key,
  status_code int,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz default now()
);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$
declare v bigint;
begin
  -- Never performs network I/O: records the call so a test can assert it was attempted.
  insert into net._http_response (status_code, content_type, headers, content) values (0, 'stub', headers, body::text) returning id into v;
  return v;
end $$;

-- extensions -----------------------------------------------------------------
create or replace function extensions.crypt(text, text) returns text language sql immutable as $$ select public.crypt($1, $2) $$;
create or replace function extensions.gen_salt(text) returns text language sql volatile as $$ select public.gen_salt($1) $$;
create or replace function extensions.gen_salt(text, integer) returns text language sql volatile as $$ select public.gen_salt($1, $2) $$;
create or replace function extensions.gen_random_uuid() returns uuid language sql volatile as $$ select gen_random_uuid() $$;
create or replace function extensions.gen_random_bytes(integer) returns bytea language sql volatile as $$ select public.gen_random_bytes($1) $$;
create or replace function extensions.uuid_generate_v4() returns uuid language sql volatile as $$ select public.uuid_generate_v4() $$;
create or replace function extensions.digest(data text, type text) returns bytea language sql immutable as $$
  select public.digest(data, type)
$$;
create or replace function extensions.digest(data bytea, type text) returns bytea language sql immutable as $$
  select public.digest(data, type)
$$;

-- migrations ledger -----------------------------------------------------------
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
