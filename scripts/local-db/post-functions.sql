-- ABOUTME: Applied after public functions exist: the auth-schema trigger Supabase wires for new users,
-- ABOUTME: so seeding auth.users locally creates profile rows the same way the platform does.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_new_user')
     and not exists (select 1 from pg_trigger where tgname='on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  end if;
end $$;
