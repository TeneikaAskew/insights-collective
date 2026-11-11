-- ABOUTME: LOCAL-SHIM ONLY. A pg_net-shaped request queue for plain PostgreSQL so the egress guard, its sentinels and its
-- ABOUTME: negative controls can be exercised without Supabase. It is NOT pg_net and proves nothing about installed pg_net.
--
-- Shape copied from pg_net's queue design (net.http_request_queue + net.http_get/post/delete that INSERT into it and
-- return the new id). No worker exists here: rows that reach the queue simply stay there, which is what the
-- unguarded control relies on to show the queue really is the delivery path. Never loaded by the CI job; the guard
-- refuses this shim unless psql passes -v allow_shim=1, and refuses it outright when real pg_net is installed.
\set ON_ERROR_STOP 1
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pgnet-queue-shim: real pg_net is installed; the shim must never be loaded over it';
  end if;
  -- Roles are cluster-wide and can linger on a scratch cluster, so the database's extensions decide instead.
  if exists (select 1 from pg_extension where extname in ('supabase_vault', 'pg_graphql', 'pgsodium')) then
    raise exception 'pgnet-queue-shim: this database has Supabase platform extensions; refusing';
  end if;
end $$;

create schema if not exists net;
create or replace function net._t09_local_shim_marker() returns text language sql immutable as $$ select 'LOCAL-SHIM'::text $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'net' and t.typname = 'http_method') then
    create domain net.http_method as text check (value ilike 'get' or value ilike 'post' or value ilike 'delete');
  end if;
end $$;

create unlogged table if not exists net.http_request_queue (
  id bigserial not null,
  method net.http_method not null,
  url text not null,
  headers jsonb not null,
  body bytea,
  timeout_milliseconds integer not null
);

-- The older local shim (scripts/local-db/supabase-shim.sql) defined net.http_post as a recorder into
-- net._http_response. Replace it with the queue form so the guard sees the real design.
drop function if exists net.http_post(text, jsonb, jsonb, jsonb, integer);

create or replace function net.http_get(url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
                                        timeout_milliseconds integer default 5000) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $$
declare request_id bigint;
begin
  insert into net.http_request_queue (method, url, headers, timeout_milliseconds)
  values ('GET', url, headers, timeout_milliseconds) returning id into request_id;
  return request_id;
end $$;

create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                                         headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
                                         timeout_milliseconds integer default 5000) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $$
declare request_id bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds) returning id into request_id;
  return request_id;
end $$;

create or replace function net.http_delete(url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
                                           timeout_milliseconds integer default 5000) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $$
declare request_id bigint;
begin
  insert into net.http_request_queue (method, url, headers, timeout_milliseconds)
  values ('DELETE', url, headers, timeout_milliseconds) returning id into request_id;
  return request_id;
end $$;

-- The request functions are SECURITY DEFINER here (their INSERT ... RETURNING needs SELECT on the queue otherwise).
-- That is a shim choice, not a claim about installed pg_net: the guard reads the authentic definitions on the real stack.
-- Mirrors the broad grants Supabase gives the net schema, so cross-role sentinels exercise the same reachability.
grant usage on schema net to anon, authenticated, service_role;
grant execute on function net.http_get(text, jsonb, jsonb, integer), net.http_post(text, jsonb, jsonb, jsonb, integer),
  net.http_delete(text, jsonb, jsonb, integer) to anon, authenticated, service_role;
grant insert on net.http_request_queue to anon, authenticated, service_role;
grant usage on sequence net.http_request_queue_id_seq to anon, authenticated, service_role;
