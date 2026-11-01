-- ABOUTME: TEST FIXTURE ONLY. Makes a plain local PostgreSQL look like an authentic Supabase stack to the
-- ABOUTME: bootstrap's authenticity checks: managed-role ownership of GoTrue/Storage objects, the two
-- ABOUTME: service migration ledgers, and vault.update_secret. This SIMULATES the documented layout; it is
-- ABOUTME: not evidence about a real `supabase start` database (that run is a separate, unexecuted gate).
-- Prerequisite: scripts/local-db/supabase-shim.sql applied; roles created by the test runner.
alter schema auth owner to supabase_admin;      -- official init: CREATE SCHEMA auth AUTHORIZATION supabase_admin
alter schema storage owner to supabase_admin;
alter table auth.users owner to supabase_auth_admin;
alter table auth.identities owner to supabase_auth_admin;
create table if not exists auth.schema_migrations (version varchar(255) primary key);
alter table auth.schema_migrations owner to supabase_auth_admin;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
create table if not exists storage.migrations (id int primary key, name varchar(100) not null unique, hash varchar(40) not null, executed_at timestamp default current_timestamp);
alter table storage.migrations owner to supabase_storage_admin;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
returns void language plpgsql as $$
begin
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name), description = coalesce(new_description, description), updated_at = now() where id = secret_id;
end $$;
grant usage on schema vault to postgres;
