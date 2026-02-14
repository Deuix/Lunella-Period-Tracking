create table if not exists public.cycle_push_profiles (
  installation_id text primary key,
  expo_push_token text,
  reminders_enabled boolean not null default false,
  cycle_length smallint not null check (cycle_length between 21 and 45),
  period_length smallint not null check (period_length between 1 and 14),
  last_period_start_date date not null,
  language text not null default 'en',
  timezone text not null default 'UTC',
  daily_reminder_hour smallint not null default 9 check (daily_reminder_hour between 0 and 23),
  last_support_notification_on date,
  last_support_period_day smallint,
  push_token_invalid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists cycle_push_profiles_due_idx
  on public.cycle_push_profiles (reminders_enabled, daily_reminder_hour)
  where expo_push_token is not null;

create index if not exists cycle_push_profiles_last_notification_idx
  on public.cycle_push_profiles (last_support_notification_on);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_cycle_push_profiles_updated_at on public.cycle_push_profiles;
create trigger trg_cycle_push_profiles_updated_at
before update on public.cycle_push_profiles
for each row
execute function public.set_current_timestamp_updated_at();

revoke all on public.cycle_push_profiles from anon, authenticated;
