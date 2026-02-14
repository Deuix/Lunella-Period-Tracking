alter table public.cycle_push_profiles
  add column if not exists fertility_reminders_enabled boolean not null default false,
  add column if not exists ovulation_reminders_enabled boolean not null default false,
  add column if not exists last_fertility_notification_on date,
  add column if not exists last_ovulation_notification_on date;
