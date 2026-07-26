-- Track per-user completion of action plan milestones so the plan behaves as a
-- living checklist instead of a one-time printout.
create table if not exists public.action_plan_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  timeframe text not null,
  milestone_index integer not null,
  milestone_text text not null default '',
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, timeframe, milestone_index)
);

alter table public.action_plan_progress enable row level security;

create policy "Users can view their own action plan progress"
  on public.action_plan_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own action plan progress"
  on public.action_plan_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own action plan progress"
  on public.action_plan_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete their own action plan progress"
  on public.action_plan_progress for delete
  using (auth.uid() = user_id);
