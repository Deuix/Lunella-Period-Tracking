alter table public.cycle_push_profiles disable row level security;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
